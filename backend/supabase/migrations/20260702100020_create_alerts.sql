-- =========================================================================
-- useAnchor Database Migration: Alerts Schema (Revised)
-- Description: Sets up the alerts emergency incident table, lifecycle ENUMs,
--              validation checks, performance indexes, and RLS policies.
-- =========================================================================

-- Create ENUM types for alert trigger origin, emergency status, and resolution reasons.
-- Done conditionally to ensure script is fully idempotent.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'alert_trigger_type') THEN
        CREATE TYPE public.alert_trigger_type AS ENUM (
            'manual_sos',        -- Triggered manually by user pressing the SOS UI button.
            'missed_checkin',     -- Triggered automatically by pg_cron when check-in deadline expires.
            'wearable_fall',     -- Triggered by smartwatch/wearable accelerometer fall detection.
            'voice_trigger',     -- Triggered by microphone parsing local safe/help word.
            'geofence_violation', -- Triggered by spatial checks when user drifts out of bounds.
            'ai_anomaly',        -- Triggered by machine learning behavioral anomaly analysis.
            'other'              -- Reserved fallback category.
        );
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'alert_status') THEN
        CREATE TYPE public.alert_status AS ENUM (
            'active',     -- Emergency is current; dispatching alerts and displaying maps.
            'resolved',   -- Emergency resolved safely (user entered code, contact verified safety).
            'cancelled',  -- Marked as false alarm immediately.
            'expired'     -- Session closed or operator resolved without explicit outcome.
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'alert_resolution_reason') THEN
        CREATE TYPE public.alert_resolution_reason AS ENUM (
            'user_safe_entry',          -- User successfully entered their safe PIN or safety code.
            'user_false_alarm',         -- User manually cancelled the active alarm as a false alert.
            'contact_verified_safe',    -- Trusted contact confirmed the user was safe.
            'responder_intervention',   -- Emergency services/responders resolved the incident.
            'system_timeout',           -- Session expired or auto-closed by safety timeout jobs.
            'operator_closed'           -- Closed manually by a support operator.
        );
    END IF;
END
$$;

-- Create alerts table
CREATE TABLE IF NOT EXISTS public.alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- References public.anchor_sessions(id) that generated the alert.
    -- Uses ON DELETE SET NULL to preserve critical safety incident data for reporting/audits
    -- even if the user deletes the parent session from their active history.
    session_id UUID REFERENCES public.anchor_sessions(id) ON DELETE SET NULL,

    -- References public.checkins(id) if the alert originated from a missed check-in.
    -- Provides direct audit traceability back to the failed check-in event.
    checkin_id UUID REFERENCES public.checkins(id) ON DELETE SET NULL,
    
    -- The user in danger. Reference to public.profiles(id).
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    trigger_type public.alert_trigger_type NOT NULL,
    status public.alert_status NOT NULL DEFAULT 'active',
    
    -- Location coordinates captured at the exact moment the alert is triggered.
    -- Preserved here as an immutable snapshot for emergency response coordinates.
    -- Distinct from the planned session destination, check-in locations, or high-frequency
    -- GPS tracking logs (which reside in a future session_location_history table).
    location_lat DOUBLE PRECISION,
    location_lng DOUBLE PRECISION,
    location_accuracy_meters DOUBLE PRECISION,
    location_address TEXT,
    location_captured_at TIMESTAMPTZ,
    
    -- Resolution tracking metadata
    resolved_at TIMESTAMPTZ DEFAULT NULL,
    resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    resolution_reason public.alert_resolution_reason DEFAULT NULL,
    resolution_details TEXT,
    resolution_metadata JSONB DEFAULT NULL,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    -- Validate coordinate bounds
    CONSTRAINT chk_location_lat CHECK (location_lat IS NULL OR (location_lat >= -90.0 AND location_lat <= 90.0)),
    CONSTRAINT chk_location_lng CHECK (location_lng IS NULL OR (location_lng >= -180.0 AND location_lng <= 180.0)),
    
    -- Verify non-negative accuracy metrics
    CONSTRAINT chk_location_accuracy CHECK (location_accuracy_meters IS NULL OR location_accuracy_meters >= 0.0),
    
    -- Validate location timing: location cannot be newer than the database transaction.
    CONSTRAINT chk_location_captured_time CHECK (location_captured_at IS NULL OR location_captured_at <= created_at),
    
    -- Time sequence integrity check
    CONSTRAINT chk_resolved_at_after_created CHECK (resolved_at IS NULL OR resolved_at >= created_at),
    
    -- Resolution state machine integrity checks:
    -- 1. Active alerts must NOT contain any resolution details (timestamp, resolver, reason, or description).
    -- 2. Finalized states (resolved, cancelled, expired) must contain resolved_at and resolution_reason.
    CONSTRAINT chk_resolution_state CHECK (
        (status = 'active' AND resolved_at IS NULL AND resolved_by IS NULL AND resolution_reason IS NULL AND resolution_details IS NULL) OR
        (status IN ('resolved', 'cancelled', 'expired') AND resolved_at IS NOT NULL AND resolution_reason IS NOT NULL)
    )
);

-- Comments on table & columns for documentation
COMMENT ON TABLE public.alerts IS 'Definitive log of active and historical emergency incidents triggered by users.';
COMMENT ON COLUMN public.alerts.id IS 'Primary key UUID of the emergency alert incident.';
COMMENT ON COLUMN public.alerts.session_id IS 'References public.anchor_sessions(id) that generated this incident.';
COMMENT ON COLUMN public.alerts.checkin_id IS 'References the check-in event that triggered the alert, if originating from a missed check-in.';
COMMENT ON COLUMN public.alerts.user_id IS 'The user who triggered the alert (the person in danger).';
COMMENT ON COLUMN public.alerts.trigger_type IS 'The origin channel of the emergency trigger (manual, missed check-in, wearable, etc.).';
COMMENT ON COLUMN public.alerts.status IS 'Current state of the emergency itself (active, resolved, cancelled, expired).';
COMMENT ON COLUMN public.alerts.location_accuracy_meters IS 'Accuracy of the GPS fix in meters. Critical for search and rescue operations.';
COMMENT ON COLUMN public.alerts.resolved_by IS 'References the profile (public.profiles(id)) of the user or contact who resolved the incident. NULL if resolved by system automation.';
COMMENT ON COLUMN public.alerts.resolution_reason IS 'Strongly-typed categorization of why the alert resolved, optimized for query metrics.';
COMMENT ON COLUMN public.alerts.resolution_details IS 'Free-text space for operators or contacts to record detailed reports/comments on resolution.';

-- Idempotent Trigger Registration: Update Updated_At Timestamp
DROP TRIGGER IF EXISTS set_alerts_updated_at ON public.alerts;
CREATE TRIGGER set_alerts_updated_at
    BEFORE UPDATE ON public.alerts
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Composite Indexes: Optimized for chronological feeds, history pages, and tracking queries.
CREATE INDEX IF NOT EXISTS idx_alerts_user_created_at 
    ON public.alerts(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_alerts_session_created_at 
    ON public.alerts(session_id, created_at DESC);

-- Composite Index: Highly optimized for live emergency dispatch maps and operator dashboards
-- looking for active emergencies sorted by trigger time.
CREATE INDEX IF NOT EXISTS idx_alerts_status_created_at 
    ON public.alerts(status, created_at DESC) 
    WHERE (status = 'active');

-- Enable Row Level Security
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Owner (least privilege, separate statements):
CREATE POLICY "alerts_select_owner" 
    ON public.alerts 
    FOR SELECT 
    TO authenticated 
    USING (user_id = auth.uid());

CREATE POLICY "alerts_insert_owner" 
    ON public.alerts 
    FOR INSERT 
    TO authenticated 
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "alerts_update_owner" 
    ON public.alerts 
    FOR UPDATE 
    TO authenticated 
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- RLS Policies for Contacts:
-- EMERGENCY SELECT: Allows trusted contacts to SELECT details of the alert *only* if they are 
--                   assigned to the parent session related to this alert (validated via session_contacts).
CREATE POLICY "alerts_select_contact" 
    ON public.alerts 
    FOR SELECT 
    TO authenticated 
    USING (
        EXISTS (
            SELECT 1 
            FROM public.session_contacts sc 
            WHERE sc.session_id = alerts.session_id 
              AND sc.linked_profile_id = auth.uid()
        )
    );

-- =========================================================================
-- Future Architectural Roadmap & Documentation:
-- 
-- 1. Alerts vs. Communications (alert_recipients):
--    This table represents the emergency incident itself (immutable historical record).
--    The notification and delivery pipeline states (FCM push, SMS fallback, SMS link clicks)
--    reside in a separate alert_recipients table (migration #7) linked to this parent record.
-- 
-- 2. Audit Trails (audit_log):
--    Once an alert enters a resolved status (resolved, cancelled, expired), it is treated 
--    as a read-only historical file. Any subsequent edits are blocked by triggers, 
--    and changes are tracked in the global audit_log table.
-- 
-- 3. Service-Role Operations:
--    Pg_cron worker schedules, Edge Functions sending emergency SMS notifications, 
--    and support operators run database calls using Supabase bypass credentials (service role), 
--    which safely ignore these policies.
-- =========================================================================
