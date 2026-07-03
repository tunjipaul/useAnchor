-- =========================================================================
-- useAnchor Database Migration: Session Contacts Schema (Revised)
-- Description: Sets up the session_contacts join/snapshot table,
--              lifecycle ENUMs, constraints, performance indexes, and
--              strict RLS policies (including emergency access configurations).
-- =========================================================================

-- Create ENUM type for session-contact notification delivery tracking.
-- Done conditionally to ensure script is fully idempotent.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'session_contact_notification_status') THEN
        CREATE TYPE public.session_contact_notification_status AS ENUM (
            'queued',       -- Notification is queued for background processing.
            'sent',         -- Transport request submitted to provider (FCM or Twilio).
            'delivered',    -- Successful transport delivery acknowledgment received.
            'failed',       -- Transport delivery failed (FCM error or invalid SMS route).
            'acknowledged', -- Human interaction occurred: contact confirmed alert receipt.
            'unreachable'   -- Delivery attempts timed out or contact details were invalid.
        );
    END IF;
END
$$;

-- Create session_contacts table
CREATE TABLE IF NOT EXISTS public.session_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.anchor_sessions(id) ON DELETE CASCADE,
    
    -- References public.trusted_contacts(id) to maintain a link to the origin contact card.
    -- Set to NULL on delete because session records must remain structurally intact 
    -- and auditable even if the user deletes the contact from their network.
    trusted_contact_id UUID REFERENCES public.trusted_contacts(id) ON DELETE SET NULL,
    
    -- Stores the linked user profile UUID of the contact, if registered,
    -- allowing in-app notifications and emergency maps to associate this record.
    linked_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

    -- Immutable snapshot fields:
    -- Duplicating these fields preserves historical integrity. If the user later edits
    -- a contact's name, phone, nickname, or relationship, past session logs will 
    -- continue to show the exact information that was active at the time.
    name TEXT NOT NULL,
    nickname TEXT,
    phone TEXT NOT NULL,
    relationship TEXT,
    notification_preference public.notification_preference NOT NULL DEFAULT 'both',

    -- Notification and acknowledgment tracking attributes.
    -- Transport status is handled independently from human interaction to avoid mixing
    -- network delivery states with user behaviors.
    notification_status public.session_contact_notification_status NOT NULL DEFAULT 'queued',
    notified_at TIMESTAMPTZ DEFAULT NULL,
    acknowledged_at TIMESTAMPTZ DEFAULT NULL,
    channel_used public.notification_preference DEFAULT NULL,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    -- Prevent duplicate contact cards for the same phone number under one session.
    CONSTRAINT uq_session_contact_phone UNIQUE (session_id, phone),
    -- Validate that the phone number matches the E.164 standard (e.g. +15550000000)
    CONSTRAINT chk_phone_e164 CHECK (phone ~ '^\+[1-9]\d{1,14}$'),
    -- Prevent empty or whitespace-only contact names.
    CONSTRAINT chk_name_not_empty CHECK (char_length(trim(name)) > 0),
    -- Limit nickname to a reasonable maximum length for UI rendering safety.
    CONSTRAINT chk_nickname_length CHECK (nickname IS NULL OR char_length(nickname) <= 50),
    
    -- Ensure logical timeline sequence: notification must occur before acknowledgment.
    CONSTRAINT chk_notification_timeline CHECK (
        (notified_at IS NULL OR notified_at >= created_at) AND
        (acknowledged_at IS NULL OR (notified_at IS NOT NULL AND acknowledged_at >= notified_at))
    )
);

-- Comments on table & columns for documentation
COMMENT ON TABLE public.session_contacts IS 'Stores snapshots of trusted contacts assigned to individual sessions, preserving historical accuracy.';
COMMENT ON COLUMN public.session_contacts.id IS 'Primary key UUID of the session contact assignment.';
COMMENT ON COLUMN public.session_contacts.session_id IS 'References public.anchor_sessions(id) that this contact is monitoring.';
COMMENT ON COLUMN public.session_contacts.trusted_contact_id IS 'References the origin public.trusted_contacts(id) card.';
COMMENT ON COLUMN public.session_contacts.linked_profile_id IS 'References the contact''s app profile (public.profiles(id)) if they are registered.';

-- Snapshot documentation
COMMENT ON COLUMN public.session_contacts.name IS 'Snapshot of the contact''s name. Duplicated to preserve historical audit integrity if original contact is modified later.';
COMMENT ON COLUMN public.session_contacts.nickname IS 'Snapshot of the contact''s custom nickname. Duplicated to preserve historical audit integrity.';
COMMENT ON COLUMN public.session_contacts.phone IS 'Snapshot of the contact''s phone number. Duplicated to preserve historical audit integrity.';
COMMENT ON COLUMN public.session_contacts.relationship IS 'Snapshot of the contact''s relationship. Duplicated to preserve historical audit integrity.';
COMMENT ON COLUMN public.session_contacts.notification_preference IS 'Snapshot of the contact''s notification preference. Duplicated to preserve historical audit integrity.';

-- Lifecycle and status documentation
COMMENT ON COLUMN public.session_contacts.notification_status IS 'Tracks the transport delivery state of session-level safety notifications (queued, sent, failed, etc.).';
COMMENT ON COLUMN public.session_contacts.acknowledged_at IS 'Tracks human interaction: timestamp recording when the contact clicked safe confirmation, acknowledging the notification.';
COMMENT ON COLUMN public.session_contacts.channel_used IS 'Logs the physical transport channel (sms or push) that successfully delivered the notification.';

-- Idempotent Trigger Registration: Update Updated_At Timestamp
DROP TRIGGER IF EXISTS set_session_contacts_updated_at ON public.session_contacts;
CREATE TRIGGER set_session_contacts_updated_at
    BEFORE UPDATE ON public.session_contacts
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Indexes for performance optimization on common query paths
CREATE INDEX IF NOT EXISTS idx_session_contacts_session_id ON public.session_contacts(session_id);
CREATE INDEX IF NOT EXISTS idx_session_contacts_trusted_contact_id ON public.session_contacts(trusted_contact_id);
CREATE INDEX IF NOT EXISTS idx_session_contacts_linked_profile_id ON public.session_contacts(linked_profile_id);
CREATE INDEX IF NOT EXISTS idx_session_contacts_phone ON public.session_contacts(phone);

-- Composite Index: Optimizes queries by background notification workers loading tasks to send or retry.
CREATE INDEX IF NOT EXISTS idx_session_contacts_session_status 
    ON public.session_contacts(session_id, notification_status);

-- Enable Row Level Security
ALTER TABLE public.session_contacts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Owner (least privilege, separate statements):
CREATE POLICY "session_contacts_select_owner" 
    ON public.session_contacts 
    FOR SELECT 
    TO authenticated 
    USING (
        EXISTS (
            SELECT 1 
            FROM public.anchor_sessions s
            WHERE s.id = session_contacts.session_id AND s.user_id = auth.uid()
        )
    );

CREATE POLICY "session_contacts_insert_owner" 
    ON public.session_contacts 
    FOR INSERT 
    TO authenticated 
    WITH CHECK (
        EXISTS (
            SELECT 1 
            FROM public.anchor_sessions s
            WHERE s.id = session_contacts.session_id AND s.user_id = auth.uid()
        )
    );

CREATE POLICY "session_contacts_update_owner" 
    ON public.session_contacts 
    FOR UPDATE 
    TO authenticated 
    USING (
        EXISTS (
            SELECT 1 
            FROM public.anchor_sessions s
            WHERE s.id = session_contacts.session_id AND s.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 
            FROM public.anchor_sessions s
            WHERE s.id = session_contacts.session_id AND s.user_id = auth.uid()
        )
    );

CREATE POLICY "session_contacts_delete_owner" 
    ON public.session_contacts 
    FOR DELETE 
    TO authenticated 
    USING (
        EXISTS (
            SELECT 1 
            FROM public.anchor_sessions s
            WHERE s.id = session_contacts.session_id AND s.user_id = auth.uid()
        )
    );

-- RLS Policies for Contacts:
-- 1. SELECT ASSIGNMENT: Allows a registered trusted contact to view their own session contact record.
-- 2. EMERGENCY VIEW: Allows other contacts on the same session to view this contact card ONLY during active emergencies.
CREATE POLICY "session_contacts_select_contact" 
    ON public.session_contacts 
    FOR SELECT 
    TO authenticated 
    USING (
        linked_profile_id = auth.uid()
        OR
        EXISTS (
            SELECT 1 
            FROM public.anchor_sessions s
            WHERE s.id = session_contacts.session_id 
              AND s.status = 'emergency'
              AND EXISTS (
                  SELECT 1 
                  FROM public.session_contacts sc 
                  WHERE sc.session_id = s.id 
                    AND sc.linked_profile_id = auth.uid()
              )
        )
    );

-- =========================================================================
-- Circular Dependency RLS Resolution: Add Policy to anchor_sessions
-- Description: Appends the selector permission to the anchor_sessions table.
--              Now that session_contacts exists, we can safely compile this
--              referencing policy. Allows contacts linked to a session to view
--              its detail card if and only if the session enters 'emergency' status.
-- =========================================================================
DROP POLICY IF EXISTS "sessions_select_contact" ON public.anchor_sessions;
CREATE POLICY "sessions_select_contact"
    ON public.anchor_sessions
    FOR SELECT
    TO authenticated
    USING (
        status = 'emergency'
        AND EXISTS (
            SELECT 1 
            FROM public.session_contacts sc 
            WHERE sc.session_id = anchor_sessions.id 
              AND sc.linked_profile_id = auth.uid()
        )
    );

-- =========================================================================
-- Future Architectural Roadmap & Documentation:
-- 
-- 1. Alerts & Alert Recipients:
--    Future emergency events will be modeled in the 'alerts' table. Recipients of those
--    alarms will reside in 'alert_recipients', which will reference public.session_contacts(id) 
--    (rather than public.trusted_contacts) to preserve audit trails against the historical snapshot.
-- 
-- 2. Future Response Workflows:
--    To keep this session_contacts table highly performant and focused on session assignment metadata,
--    extended interaction workflows (such as a contact opening a push link, marking themselves 
--    actively responding, or placing an emergency dispatch call) will be stored in a dedicated 
--    alert_response_logs table rather than extending columns here.
-- =========================================================================
