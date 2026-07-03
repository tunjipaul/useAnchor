-- =========================================================================
-- useAnchor Database Migration: Checkins Schema (Revised)
-- Description: Sets up the checkins operational history table, lifecycle 
--              ENUMs, validation checks, indexes, and RLS policies.
-- =========================================================================

-- Create ENUM types for check-in status and confirmation method.
-- Done conditionally to ensure script is fully idempotent.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'checkin_status') THEN
        CREATE TYPE public.checkin_status AS ENUM (
            'scheduled', -- Check-in planned but scheduled time has not arrived yet.
            'pending',   -- Prompt active; currently waiting for user response.
            'completed', -- User safely checked in.
            'missed',    -- User went unresponsive; grace period expired, session escalated.
            'expired',   -- System-cleaned/abandoned without activation.
            'cancelled', -- Session cancelled prior to starting, check-in voided.
            'skipped'    -- Session extended or ended early, bypassing this check-in.
        );
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'checkin_method') THEN
        CREATE TYPE public.checkin_method AS ENUM (
            'manual',    -- Confirmed manually via PIN entry on the frontend client.
            'voice',     -- Confirmed via Voice Safe Word verification.
            'biometric', -- Confirmed via FaceID/Fingerprint authentication.
            'wearable',  -- Confirmed via smartwatch/accessory integration.
            'automatic', -- Geofence or sensor-based automatic check-in.
            'sms'        -- Confirmed remotely via a secure SMS verification link.
        );
    END IF;
END
$$;

-- Create checkins table
CREATE TABLE IF NOT EXISTS public.checkins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.anchor_sessions(id) ON DELETE CASCADE,
    
    -- Sequential identifier representing the order of this check-in within the session (e.g. 1, 2, 3).
    -- Ensures strict chronological ordering and easy sequence references.
    sequence_number INTEGER NOT NULL,
    
    scheduled_time TIMESTAMPTZ NOT NULL,
    
    -- The absolute time by which the check-in must be completed.
    -- Calculated as scheduled_time + grace_period. Cron jobs use this column to escalate.
    deadline_time TIMESTAMPTZ NOT NULL,
    
    actual_response_time TIMESTAMPTZ DEFAULT NULL,
    
    status public.checkin_status NOT NULL DEFAULT 'scheduled',
    method public.checkin_method DEFAULT NULL,
    
    -- Telemetry for multiple reminder notifications sent to the user's client.
    -- Avoids locking reminder attempts into a nested ENUM state.
    reminders_sent INTEGER NOT NULL DEFAULT 0,
    last_reminder_at TIMESTAMPTZ DEFAULT NULL,
    
    -- Location coordinates captured *at the exact moment* the check-in is completed.
    -- Stored directly in this table for safety audit traceability (where was the user last safe?).
    -- Distinct from the session's active/route-history coordinates.
    location_lat DOUBLE PRECISION,
    location_lng DOUBLE PRECISION,
    location_address TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    -- Enforce unique check-in sequences per session.
    -- Note: A unique constraint automatically creates and maintains a unique index on (session_id, sequence_number) in PostgreSQL.
    CONSTRAINT uq_session_sequence UNIQUE (session_id, sequence_number),
    
    -- Validate coordinate bounds
    CONSTRAINT chk_location_lat CHECK (location_lat IS NULL OR (location_lat >= -90.0 AND location_lat <= 90.0)),
    CONSTRAINT chk_location_lng CHECK (location_lng IS NULL OR (location_lng >= -180.0 AND location_lng <= 180.0)),
    
    -- Verify non-negative retry counters
    CONSTRAINT chk_reminders_count CHECK (reminders_sent >= 0),
    
    -- Verify telemetry sync: last_reminder_at must exist if and only if reminders_sent > 0.
    CONSTRAINT chk_reminders_match CHECK (
        (reminders_sent = 0 AND last_reminder_at IS NULL) OR 
        (reminders_sent > 0 AND last_reminder_at IS NOT NULL)
    ),
    
    -- Time sequence logic: deadline must happen after scheduled start, response must follow creation.
    CONSTRAINT chk_deadline_after_scheduled CHECK (deadline_time > scheduled_time),
    CONSTRAINT chk_response_after_created CHECK (actual_response_time IS NULL OR actual_response_time >= created_at),
    
    -- Ensure reminders are not sent out after the response is completed.
    CONSTRAINT chk_reminder_before_response CHECK (
        last_reminder_at IS NULL OR actual_response_time IS NULL OR last_reminder_at <= actual_response_time
    ),
    
    -- State transition integrity:
    -- 1. Completed check-ins must contain response times and confirmation methods.
    -- 2. Scheduled, pending, cancelled, skipped, or expired check-ins must NOT contain response metadata.
    -- 3. Missed check-ins can optionally contain response metadata (e.g. if resolved late by a delayed check-in).
    CONSTRAINT chk_response_metadata CHECK (
        (status = 'completed' AND actual_response_time IS NOT NULL AND method IS NOT NULL) OR
        (status IN ('scheduled', 'pending', 'cancelled', 'skipped', 'expired') AND actual_response_time IS NULL AND method IS NULL) OR
        (status = 'missed')
    )
);

-- Comments on table & columns for documentation
COMMENT ON TABLE public.checkins IS 'Records the operational check-in intervals and outcomes for every session.';
COMMENT ON COLUMN public.checkins.id IS 'Primary key UUID of the check-in event.';
COMMENT ON COLUMN public.checkins.session_id IS 'References the public.anchor_sessions(id) this event is nested under.';
COMMENT ON COLUMN public.checkins.sequence_number IS 'Incremental index (1, 2, 3...) of the check-in within its parent session.';
COMMENT ON COLUMN public.checkins.scheduled_time IS 'Timestamp when the user is expected to check in.';
COMMENT ON COLUMN public.checkins.deadline_time IS 'Escalation threshold timestamp (scheduled_time + grace_period) after which alert creation triggers.';
COMMENT ON COLUMN public.checkins.actual_response_time IS 'Timestamp recording when the user actually completed the check-in.';
COMMENT ON COLUMN public.checkins.status IS 'Current check-in state (scheduled, pending, completed, missed, etc.).';
COMMENT ON COLUMN public.checkins.method IS 'The verification method used to confirm safety (PIN, voice, biometric, etc.).';
COMMENT ON COLUMN public.checkins.reminders_sent IS 'The total number of notification check-in alerts dispatched to the user''s client.';
COMMENT ON COLUMN public.checkins.location_lat IS 'Latitude coordinate captured at response time.';
COMMENT ON COLUMN public.checkins.location_lng IS 'Longitude coordinate captured at response time.';

-- Idempotent Trigger Registration: Update Updated_At Timestamp
DROP TRIGGER IF EXISTS set_checkins_updated_at ON public.checkins;
CREATE TRIGGER set_checkins_updated_at
    BEFORE UPDATE ON public.checkins
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Indexes for performance optimization on common query paths
CREATE INDEX IF NOT EXISTS idx_checkins_session_id ON public.checkins(session_id);
CREATE INDEX IF NOT EXISTS idx_checkins_scheduled_time ON public.checkins(scheduled_time);

-- Composite Index: Optimizes queries used by background cron escalation workers.
-- Targets only pending or scheduled rows to keep index tree small and lookups rapid.
CREATE INDEX IF NOT EXISTS idx_checkins_status_deadline 
    ON public.checkins(status, deadline_time) 
    WHERE (status IN ('scheduled', 'pending'));

-- Enable Row Level Security
ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Owner (least privilege, separate statements):
CREATE POLICY "checkins_select_owner" 
    ON public.checkins 
    FOR SELECT 
    TO authenticated 
    USING (
        EXISTS (
            SELECT 1 
            FROM public.anchor_sessions s
            WHERE s.id = checkins.session_id AND s.user_id = auth.uid()
        )
    );

CREATE POLICY "checkins_insert_owner" 
    ON public.checkins 
    FOR INSERT 
    TO authenticated 
    WITH CHECK (
        EXISTS (
            SELECT 1 
            FROM public.anchor_sessions s
            WHERE s.id = checkins.session_id AND s.user_id = auth.uid()
        )
    );

CREATE POLICY "checkins_update_owner" 
    ON public.checkins 
    FOR UPDATE 
    TO authenticated 
    USING (
        EXISTS (
            SELECT 1 
            FROM public.anchor_sessions s
            WHERE s.id = checkins.session_id AND s.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 
            FROM public.anchor_sessions s
            WHERE s.id = checkins.session_id AND s.user_id = auth.uid()
        )
    );

CREATE POLICY "checkins_delete_owner" 
    ON public.checkins 
    FOR DELETE 
    TO authenticated 
    USING (
        EXISTS (
            SELECT 1 
            FROM public.anchor_sessions s
            WHERE s.id = checkins.session_id AND s.user_id = auth.uid()
        )
    );

-- RLS Policies for Contacts:
-- EMERGENCY SELECT: Allows trusted contacts associated with a session to view its 
--                   check-in timeline history *only* during active emergencies.
CREATE POLICY "checkins_select_contact" 
    ON public.checkins 
    FOR SELECT 
    TO authenticated 
    USING (
        EXISTS (
            SELECT 1 
            FROM public.anchor_sessions s
            WHERE s.id = checkins.session_id 
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
-- Future Architectural Roadmap & Documentation:
-- 
-- 1. Detailed Reminder Logs:
--    To keep this checkins table highly performant and clean under massive transaction 
--    volumes, the detailed dispatch telemetry (like notification identifiers, channels, 
--    and delivery errors) will reside in a future checkin_reminder_logs table, while 
--    this table only aggregates counters.
-- 
-- 2. Location Tracking Strategy:
--    The location columns (lat, lng, address) stored here represent only a single event 
--    snapshot captured at the exact moment of check-in to confirm safety telemetry. 
--    Continuous GPS breadcrumbs and route tracking records will reside in a separate 
--    session_location_history table.
-- 
-- 3. Service-Role Permissions:
--    Future pg_cron workers, background execution functions, and SMS dispatchers 
--    run with database service-role bypass credentials, meaning they bypass these RLS 
--    policies to run overdue scans and updates securely.
-- =========================================================================
