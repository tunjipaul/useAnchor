-- =========================================================================
-- useAnchor Database Migration: Anchor Sessions Schema (Revised)
-- Description: Sets up the core anchor_sessions table, lifecycle ENUMs,
--              constraints, performance indexes, and RLS security policies.
-- =========================================================================

-- Create ENUM types for session lifecycle status and completion reason.
-- Done conditionally to ensure script is fully idempotent.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'session_status') THEN
        CREATE TYPE public.session_status AS ENUM (
            'draft',      -- Session created as template/draft.
            'scheduled',  -- Configured to start automatically or manually in the future.
            'active',     -- Currently in progress, safety monitoring active.
            'completed',  -- Finished safely by the user.
            'cancelled',  -- Cancelled by the user prior to starting.
            'emergency',  -- Session escalated (SOS triggered or missed check-in).
            'archived'    -- System/owner archived historical record.
        );
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'session_completion_reason') THEN
        CREATE TYPE public.session_completion_reason AS ENUM (
            'safe_checkin',        -- Completed normally by user safe-check-in verification.
            'cancelled_pre_start', -- Cancelled by user before actual start.
            'expired_no_start',    -- Scheduled session that was never activated.
            'emergency_resolved',  -- Ended because the active emergency was resolved.
            'system_timeout'       -- Long-running inactive session closed automatically by system.
        );
    END IF;
END
$$;

-- Create anchor_sessions table
CREATE TABLE IF NOT EXISTS public.anchor_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    -- Public-facing, human-friendly session identifier (e.g., ANC-X91L7P)
    -- Suitable for customer support, emergency dispatch, and public share links.
    -- Kept nullable initially to prevent insert failures before generator logic is wired up.
    session_code TEXT UNIQUE,
    
    title TEXT NOT NULL,
    description TEXT,
    meet_person TEXT,
    meet_phone TEXT,
    destination_address TEXT,
    
    -- Location coordinates are stored as double precision columns rather than PostGIS geography.
    -- Reasoning: This is highly portable, directly serializable to JSON/frontend APIs, 
    -- and indexable. Spatial computation (e.g. ST_MakePoint/ST_Distance) can still be run 
    -- on-the-fly using these columns if geofencing or distance checking is required.
    -- Historical tracking data (route paths) is intentionally kept out of this table and
    -- will live in a future dedicated session_location_history table to keep queries performant.
    destination_lat DOUBLE PRECISION,
    destination_lng DOUBLE PRECISION,
    start_lat DOUBLE PRECISION,
    start_lng DOUBLE PRECISION,
    last_known_lat DOUBLE PRECISION,
    last_known_lng DOUBLE PRECISION,
    last_known_address TEXT,
    
    -- Timezone tracking for travelling users and schedule offsets.
    timezone TEXT NOT NULL DEFAULT 'UTC',
    
    -- Client telemetry identifiers (e.g. mobile_app, desktop_web, watch_app).
    source_client TEXT NOT NULL DEFAULT 'web',
    
    scheduled_start TIMESTAMPTZ,
    actual_start TIMESTAMPTZ,
    expected_end TIMESTAMPTZ NOT NULL,
    actual_end TIMESTAMPTZ,
    
    checkin_interval_minutes INTEGER NOT NULL DEFAULT 15,
    
    -- Emergency tracking flags and timestamping.
    sos_triggered BOOLEAN NOT NULL DEFAULT FALSE,
    auto_escalated BOOLEAN NOT NULL DEFAULT FALSE,
    emergency_started_at TIMESTAMPTZ DEFAULT NULL,
    
    -- Future-proofing risk attributes. Enables ML neighborhood analytics 
    -- and custom insurance/compliance scoring without changing schema structure.
    risk_level TEXT DEFAULT NULL,
    risk_metadata JSONB DEFAULT NULL,
    
    status public.session_status NOT NULL DEFAULT 'draft',
    completion_reason public.session_completion_reason DEFAULT NULL,
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    -- Prevent empty/whitespace-only titles.
    CONSTRAINT chk_title_not_empty CHECK (char_length(trim(title)) > 0),
    
    -- Coordinate boundary validation checks
    CONSTRAINT chk_destination_lat CHECK (destination_lat IS NULL OR (destination_lat >= -90.0 AND destination_lat <= 90.0)),
    CONSTRAINT chk_destination_lng CHECK (destination_lng IS NULL OR (destination_lng >= -180.0 AND destination_lng <= 180.0)),
    CONSTRAINT chk_start_lat CHECK (start_lat IS NULL OR (start_lat >= -90.0 AND start_lat <= 90.0)),
    CONSTRAINT chk_start_lng CHECK (start_lng IS NULL OR (start_lng >= -180.0 AND start_lng <= 180.0)),
    CONSTRAINT chk_last_known_lat CHECK (last_known_lat IS NULL OR (last_known_lat >= -90.0 AND last_known_lat <= 90.0)),
    CONSTRAINT chk_last_known_lng CHECK (last_known_lng IS NULL OR (last_known_lng >= -180.0 AND last_known_lng <= 180.0)),
    
    -- Check-in interval validation
    CONSTRAINT chk_checkin_interval CHECK (checkin_interval_minutes > 0),
    
    -- Time sequence validation constraints
    CONSTRAINT chk_timestamps CHECK (
        (actual_start IS NULL OR actual_end IS NULL OR actual_start <= actual_end) AND
        (scheduled_start IS NULL OR expected_end > scheduled_start) AND
        (expected_end > created_at)
    ),
    
    -- State transitions safety: Active sessions must have an actual_start timestamp set.
    CONSTRAINT chk_active_needs_start CHECK (
        (status NOT IN ('active', 'completed', 'emergency') OR actual_start IS NOT NULL)
    ),
    
    -- Completion reason dependency: Completion reason should only be set on finalized states.
    CONSTRAINT chk_completion_reason CHECK (
        (status NOT IN ('completed', 'cancelled') OR completion_reason IS NOT NULL) AND
        (status IN ('completed', 'cancelled') OR completion_reason IS NULL)
    )
);

-- Comments on table & columns for documentation
COMMENT ON TABLE public.anchor_sessions IS 'Core safety monitoring sessions created and managed by users.';
COMMENT ON COLUMN public.anchor_sessions.id IS 'Primary key UUID of the safety session.';
COMMENT ON COLUMN public.anchor_sessions.session_code IS 'Unique public-facing session code (e.g., ANC-X91L7P) for support, lookup links, and debugging.';
COMMENT ON COLUMN public.anchor_sessions.user_id IS 'The profile ID of the user who owns/starts this session.';
COMMENT ON COLUMN public.anchor_sessions.destination_lat IS 'Latitude coordinate of the user''s target destination.';
COMMENT ON COLUMN public.anchor_sessions.destination_lng IS 'Longitude coordinate of the user''s target destination.';
COMMENT ON COLUMN public.anchor_sessions.timezone IS 'IANA timezone ID of the user when the session was created.';
COMMENT ON COLUMN public.anchor_sessions.source_client IS 'Identifies the client origin of the session (e.g., mobile_app, desktop_web, watch_app).';
COMMENT ON COLUMN public.anchor_sessions.expected_end IS 'The deadline timestamp by which the user must check in. Used by cron jobs to trigger alerts.';
COMMENT ON COLUMN public.anchor_sessions.completion_reason IS 'Provides granularity on why a session finalized (e.g. cancelled vs safe check-in).';
COMMENT ON COLUMN public.anchor_sessions.sos_triggered IS 'Indicates if the user manually or automatically initiated a panic SOS.';
COMMENT ON COLUMN public.anchor_sessions.auto_escalated IS 'Indicates if the session escalated to emergency state due to a missed check-in.';
COMMENT ON COLUMN public.anchor_sessions.emergency_started_at IS 'Timestamp recording when the session entered emergency status.';
COMMENT ON COLUMN public.anchor_sessions.risk_level IS 'Calculated risk index (e.g. low, medium, high) for audit triggers.';
COMMENT ON COLUMN public.anchor_sessions.deleted_at IS 'Soft delete timestamp. Safely hides the record from the user''s views while preserving historical audit paths.';

-- Idempotent Trigger Registration: Update Updated_At Timestamp
DROP TRIGGER IF EXISTS set_anchor_sessions_updated_at ON public.anchor_sessions;
CREATE TRIGGER set_anchor_sessions_updated_at
    BEFORE UPDATE ON public.anchor_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Indexes for performance optimization on common query paths
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON public.anchor_sessions(user_id);

-- Composite Index: Optimizes queries used by background cron escalation workers.
-- Targets only active/emergency states to minimize index tree size and speed up checks.
CREATE INDEX IF NOT EXISTS idx_sessions_status_expected_end 
    ON public.anchor_sessions(status, expected_end) 
    WHERE (status IN ('active', 'emergency'));

-- Composite Index: Optimizes fetching a user's active session on dashboard loads.
CREATE INDEX IF NOT EXISTS idx_sessions_user_status 
    ON public.anchor_sessions(user_id, status) 
    WHERE (deleted_at IS NULL);

-- Index for soft delete sweeps and cleanups
CREATE INDEX IF NOT EXISTS idx_sessions_deleted_at 
    ON public.anchor_sessions(deleted_at) 
    WHERE (deleted_at IS NOT NULL);

-- Business Rule: Enforce Active Session Uniqueness per User at the database level.
-- A user must never have more than one active or emergency monitoring session running concurrently.
-- Prevents race conditions and double check-in monitoring schedules.
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_session_per_user 
    ON public.anchor_sessions (user_id) 
    WHERE (status IN ('active', 'emergency'));

-- Enable Row Level Security
ALTER TABLE public.anchor_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- 1. OWNER SELECT: Owners can select their own sessions that have not been soft deleted.
CREATE POLICY "sessions_select_owner" 
    ON public.anchor_sessions 
    FOR SELECT 
    TO authenticated 
    USING (auth.uid() = user_id AND deleted_at IS NULL);

-- 2. OWNER INSERT: Owners can create new sessions for themselves.
CREATE POLICY "sessions_insert_owner" 
    ON public.anchor_sessions 
    FOR INSERT 
    TO authenticated 
    WITH CHECK (auth.uid() = user_id);

-- 3. OWNER UPDATE: Owners can update their own sessions (extend times, resolve alarms, edit drafts).
CREATE POLICY "sessions_update_owner" 
    ON public.anchor_sessions 
    FOR UPDATE 
    TO authenticated 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Note on Contact SELECT access:
-- Trusted contacts associated with a session must be authorized to select it 
-- only when the session enters the 'emergency' status.
-- Because this requires referencing the 'session_contacts' join table (which does not exist yet), 
-- the contact RLS select policy will be appended in the next migration file via an ALTER TABLE statement
-- to prevent circular dependency errors during SQL compilation.
