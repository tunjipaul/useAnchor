-- =========================================================================
-- useAnchor Database Migration: Alert Recipients Schema
-- Description: Sets up the alert_recipients pipeline table, ENUMs,
--              constraints, performance indexes, and RLS policies.
-- =========================================================================

-- Create ENUM types for alert notification delivery channels and delivery states.
-- Done conditionally to ensure script is fully idempotent.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'alert_delivery_channel') THEN
        CREATE TYPE public.alert_delivery_channel AS ENUM (
            'push',      -- Firebase Cloud Messaging (FCM) primary channel.
            'sms',       -- Twilio SMS fallback channel.
            'email',      -- Email notification channel (future).
            'whatsapp',   -- WhatsApp API channel (future).
            'voice_call'  -- Automated text-to-speech phone call (future).
        );
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'alert_recipient_status') THEN
        CREATE TYPE public.alert_recipient_status AS ENUM (
            'queued',       -- Dispatch is queued for delivery processing.
            'sending',      -- Dispatch is currently executing in the gateway provider.
            'sent',         -- Gateway accepted the request (sent but not yet confirmed delivered).
            'delivered',    -- Successful client delivery confirmed by device receipt or SMS carrier.
            'failed',       -- Transmission failed (invalid token, network error, invalid number).
            'acknowledged', -- Human interaction completed: contact acknowledged seeing the emergency.
            'expired'       -- Incident resolved before this recipient was reached.
        );
    END IF;
END
$$;

-- Create alert_recipients table
CREATE TABLE IF NOT EXISTS public.alert_recipients (
    -- Unique composite primary key matching one recipient profile to one emergency incident.
    alert_id UUID NOT NULL REFERENCES public.alerts(id) ON DELETE CASCADE,
    
    -- References public.session_contacts(id) to maintain connection to the session's contact snapshot.
    -- Preserves historical snapshot properties (name, phone, nickname) even if the parent
    -- trusted_contact card is deleted or modified after the emergency incident has resolved.
    session_contact_id UUID NOT NULL REFERENCES public.session_contacts(id) ON DELETE RESTRICT,
    
    status public.alert_recipient_status NOT NULL DEFAULT 'queued',
    
    -- Tracks if the contact actively indicated they are responding/coordinating help.
    is_responding BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Dispatch pipeline telemetry fields
    channel_used public.alert_delivery_channel DEFAULT NULL,
    retry_count INTEGER NOT NULL DEFAULT 0,
    last_retry_at TIMESTAMPTZ DEFAULT NULL,
    error_message TEXT DEFAULT NULL,
    
    -- Detailed transmission lifecycle timestamps. 
    -- Tracks performance metrics and latency bottlenecks in the notification pipeline.
    queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMPTZ DEFAULT NULL,
    delivered_at TIMESTAMPTZ DEFAULT NULL,
    failed_at TIMESTAMPTZ DEFAULT NULL,
    acknowledged_at TIMESTAMPTZ DEFAULT NULL,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_alert_recipients PRIMARY KEY (alert_id, session_contact_id),

    -- Constraints
    -- Verify non-negative retry counter bounds
    CONSTRAINT chk_retry_count CHECK (retry_count >= 0),
    
    -- Time sequence logic constraints
    CONSTRAINT chk_timeline_sent CHECK (sent_at IS NULL OR sent_at >= queued_at),
    CONSTRAINT chk_timeline_delivered CHECK (delivered_at IS NULL OR (sent_at IS NOT NULL AND delivered_at >= sent_at)),
    CONSTRAINT chk_timeline_acknowledged CHECK (acknowledged_at IS NULL OR (sent_at IS NOT NULL AND acknowledged_at >= sent_at)),
    CONSTRAINT chk_timeline_failed CHECK (failed_at IS NULL OR (sent_at IS NOT NULL AND failed_at >= sent_at)),
    CONSTRAINT chk_timeline_retry CHECK (last_retry_at IS NULL OR last_retry_at >= queued_at),
    
    -- State integrity: Ensures status aligns logically with corresponding lifecycle timestamps.
    CONSTRAINT chk_status_timestamps CHECK (
        (status = 'queued' AND sent_at IS NULL AND delivered_at IS NULL AND failed_at IS NULL AND acknowledged_at IS NULL) OR
        (status = 'sending' AND sent_at IS NULL AND failed_at IS NULL) OR
        (status = 'sent' AND sent_at IS NOT NULL AND failed_at IS NULL) OR
        (status = 'delivered' AND delivered_at IS NOT NULL AND failed_at IS NULL) OR
        (status = 'failed' AND failed_at IS NOT NULL) OR
        (status = 'acknowledged' AND acknowledged_at IS NOT NULL) OR
        (status = 'expired')
    )
);

-- Comments on table & columns for documentation
COMMENT ON TABLE public.alert_recipients IS 'Tracks individual delivery dispatches and outcomes for emergency contacts during alerts.';
COMMENT ON COLUMN public.alert_recipients.alert_id IS 'References the public.alerts(id) emergency incident.';
COMMENT ON COLUMN public.alert_recipients.session_contact_id IS 'References the session contact snapshot public.session_contacts(id) to maintain historical integrity.';
COMMENT ON COLUMN public.alert_recipients.status IS 'Current transmission state (queued, sending, delivered, acknowledged, etc.).';
COMMENT ON COLUMN public.alert_recipients.is_responding IS 'Flags whether the contact checked "Responding" to coordinate emergency assistance.';
COMMENT ON COLUMN public.alert_recipients.channel_used IS 'The physical transmission channel (sms, push, etc.) used to successfully send this notification.';
COMMENT ON COLUMN public.alert_recipients.retry_count IS 'The number of fallback/retry dispatches attempted for this recipient.';
COMMENT ON COLUMN public.alert_recipients.error_message IS 'Stores the last provider error message (e.g. Twilio API code, invalid push payload text) for pipeline debugging.';
COMMENT ON COLUMN public.alert_recipients.acknowledged_at IS 'Timestamp recording when the user opened or responded to the alert, acknowledging its receipt.';

-- Idempotent Trigger Registration: Update Updated_At Timestamp
DROP TRIGGER IF EXISTS set_alert_recipients_updated_at ON public.alert_recipients;
CREATE TRIGGER set_alert_recipients_updated_at
    BEFORE UPDATE ON public.alert_recipients
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Indexes for performance optimization on common query paths
CREATE INDEX IF NOT EXISTS idx_alert_recipients_session_contact ON public.alert_recipients(session_contact_id);
CREATE INDEX IF NOT EXISTS idx_alert_recipients_status ON public.alert_recipients(status);

-- Composite Partial Index: Optimizes queries used by background dispatcher workers.
-- Pulls failed or pending alerts that require immediate retry scans.
CREATE INDEX IF NOT EXISTS idx_alert_recipients_retry 
    ON public.alert_recipients(status, last_retry_at) 
    WHERE (status IN ('queued', 'sending', 'failed'));

-- Enable Row Level Security
ALTER TABLE public.alert_recipients ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- 1. SELECT POLICIES: 
--    - Allows the emergency session owner to view all dispatches on their alert.
--    - Allows any contact assigned to the emergency session to view all other dispatches on the same alert.
CREATE POLICY "alert_recipients_select" 
    ON public.alert_recipients 
    FOR SELECT 
    TO authenticated 
    USING (
        EXISTS (
            SELECT 1 
            FROM public.alerts a 
            WHERE a.id = alert_recipients.alert_id 
              AND (
                  a.user_id = auth.uid()
                  OR EXISTS (
                      SELECT 1 
                      FROM public.session_contacts sc 
                      WHERE sc.session_id = a.session_id 
                        AND sc.linked_profile_id = auth.uid()
                  )
              )
        )
    );

-- 2. CONTACT UPDATE POLICY:
--    - Allows a registered contact to update their own acknowledgment time and responding flag.
CREATE POLICY "alert_recipients_update_contact" 
    ON public.alert_recipients 
    FOR UPDATE 
    TO authenticated 
    USING (
        EXISTS (
            SELECT 1 
            FROM public.session_contacts sc 
            WHERE sc.id = alert_recipients.session_contact_id 
              AND sc.linked_profile_id = auth.uid()
        )
    )
    WITH CHECK (
        alert_id = alert_id AND
        session_contact_id = session_contact_id
    );

-- Note: No INSERT or DELETE policies exist for users.
-- Insertion and deletion of dispatches are handled by trigger processes or the background dispatch
-- cron script running under database service-role bypass credentials.
