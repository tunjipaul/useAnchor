-- =========================================================================
-- useAnchor Database Migration: Audit Log Schema (Revised)
-- Description: Sets up the immutable audit_log forensic table, actor and event
--              category ENUMs, immutability triggers, indexes, and RLS policies.
-- =========================================================================

-- Create ENUM types for audit log actors and event categories.
-- Done conditionally to ensure script is fully idempotent.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'audit_actor_type') THEN
        CREATE TYPE public.audit_actor_type AS ENUM (
            'user',          -- Authenticated useAnchor application user.
            'contact',       -- Trusted contact performing an action (e.g. acknowledging alert).
            'system',        -- Automated database rules or system triggers.
            'service_role',   -- Internal backend workers (cron, Edge Functions, notification workers).
            'operator',      -- Customer support operators or emergency dispatchers.
            'admin'          -- System administrator executing platform actions.
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'audit_event_category') THEN
        CREATE TYPE public.audit_event_category AS ENUM (
            'profile',          -- User profile changes (creation, name updates, onboarding).
            'trusted_contact',   -- Circle changes (adding, modifying, soft-deleting contacts).
            'session',          -- Safety session lifecycle changes (start, end, extends).
            'checkin',          -- Check-in events (scheduled, completed, missed).
            'alert',            -- Emergency incidents (SOS triggers, resolutions).
            'notification',     -- Notification pipeline events (dispatches, retries, failures).
            'authentication',   -- Auth actions (signups, OTP verifications, logins).
            'system',           -- Automated system jobs, cron actions, and cleanups.
            'admin'             -- Operator interventions and administrative commands.
        );
    END IF;
END
$$;

-- Create audit_log table
-- Note: 'updated_at' is intentionally omitted from this table.
-- Audit logs represent chronological history and are strictly append-only;
-- updates and deletes are blocked, rendering modifications impossible.
CREATE TABLE IF NOT EXISTS public.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- The target user profile (public.profiles(id)) whom this data belongs to.
    -- Scopes RLS SELECT policies so users can audit their own account logs.
    -- Uses ON DELETE SET NULL to ensure audit trails remain intact if the user profile is deleted.
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    
    -- The specific user profile UUID executing the action. 
    -- Null if the action is triggered by 'system' or 'service_role'.
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    actor_type public.audit_actor_type NOT NULL,
    
    event_category public.audit_event_category NOT NULL,
    event_type TEXT NOT NULL,
    
    -- Generic entity design:
    -- Points to the specific database table and row ID affected by this log.
    -- Avoids creating numerous nullable foreign keys, ensuring new tables can be audited 
    -- in the future without schema changes. Foreign keys are omitted here so that logs 
    -- persist even if audited tables (e.g. sessions) are pruned or cascade-deleted.
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    
    -- Structured change diffs (e.g. {"before": {"status": "active"}, "after": {"status": "completed"}})
    changes JSONB DEFAULT NULL,
    
    -- Context metadata: IP addresses, user agents, device identifiers, 
    -- client application versions, and runtime errors.
    metadata JSONB DEFAULT NULL,
    
    -- A tracking UUID generated at the request/API level to link multiple associated dispatches.
    -- Enables tracing a single transaction (e.g. cron triggers missed checkin -> updates session 
    -- to emergency -> inserts alert -> dispatches 5 sms alerts) as one atomic operation.
    correlation_id UUID DEFAULT NULL,
    
    -- The real-world timestamp when the event actually occurred on the client device or API gateway.
    -- Distinguishes real-world event times from database write times (created_at), accommodating 
    -- offline-first caching, network synchronization latencies, and retries.
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    -- Prevent empty strings on identifiers
    CONSTRAINT chk_event_type_not_empty CHECK (char_length(trim(event_type)) > 0),
    CONSTRAINT chk_entity_type_not_empty CHECK (char_length(trim(entity_type)) > 0)
);

-- Comments on table & columns for documentation
COMMENT ON TABLE public.audit_log IS 'Immutable append-only forensic event log. Serves as useAnchor''s black box recorder.';
COMMENT ON COLUMN public.audit_log.id IS 'Primary key UUID of the audit log record.';
COMMENT ON COLUMN public.audit_log.user_id IS 'Subject profile ID whom this record belongs to. Used to scope user RLS reads.';
COMMENT ON COLUMN public.audit_log.actor_id IS 'Profile ID of the user executing the action. NULL for automated system actions.';
COMMENT ON COLUMN public.audit_log.actor_type IS 'Actor type (user, contact, system, service_role, operator, admin) executing the action.';
COMMENT ON COLUMN public.audit_log.event_category IS 'Higher-level category grouping (profile, session, alert, etc.) for analytics.';
COMMENT ON COLUMN public.audit_log.event_type IS 'The specific name of the audit event (e.g., session_started, alert_resolved).';
COMMENT ON COLUMN public.audit_log.entity_type IS 'The database table name of the target affected entity.';
COMMENT ON COLUMN public.audit_log.entity_id IS 'The primary key UUID of the target affected entity.';
COMMENT ON COLUMN public.audit_log.changes IS 'JSONB object containing before/after diffs of modified fields.';
COMMENT ON COLUMN public.audit_log.metadata IS 'JSONB logging request context parameters (IP, User Agent, Correlation IDs, App Version).';
COMMENT ON COLUMN public.audit_log.correlation_id IS 'UUID linking multiple associated logs together into a single forensic event chain.';
COMMENT ON COLUMN public.audit_log.occurred_at IS 'Real-world event timestamp (accommodating offline synchronization delays).';

-- =========================================================================
-- DATABASE ENFORCED IMMUTABILITY (Append-Only)
-- Description: Blocks any UPDATE or DELETE operations on the audit_log table.
--              Guarantees the table functions as a permanent forensics archive.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit log entries are immutable and cannot be updated or deleted.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS enforce_audit_log_immutability ON public.audit_log;
CREATE TRIGGER enforce_audit_log_immutability
    BEFORE UPDATE OR DELETE ON public.audit_log
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_audit_modification();

-- Composite Indexes: Optimized for investigations, analytical timelines, and dashboard logs
CREATE INDEX IF NOT EXISTS idx_audit_log_user_created 
    ON public.audit_log(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_entity_created 
    ON public.audit_log(entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_category_created 
    ON public.audit_log(event_category, created_at DESC);

-- Index on occurred_at to support chronological timeline mapping, accounting for delayed syncs.
CREATE INDEX IF NOT EXISTS idx_audit_log_occurred_at 
    ON public.audit_log(occurred_at DESC);

-- Index on correlation_id to quickly reconstruct transaction event chains.
CREATE INDEX IF NOT EXISTS idx_audit_log_correlation_id 
    ON public.audit_log(correlation_id) 
    WHERE (correlation_id IS NOT NULL);

-- Index for global chronological database auditing
CREATE INDEX IF NOT EXISTS idx_audit_log_chronological 
    ON public.audit_log(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- SELECT POLICY:
--    - Allows the subject user (user_id) or the executing actor (actor_id) to read logs.
--    - Allows assigned trusted contacts to SELECT session/alert logs related to emergencies they monitor.
CREATE POLICY "audit_log_select" 
    ON public.audit_log 
    FOR SELECT 
    TO authenticated 
    USING (
        user_id = auth.uid() 
        OR actor_id = auth.uid()
        OR (
            entity_type IN ('anchor_sessions', 'alerts') 
            AND EXISTS (
                SELECT 1 
                FROM public.session_contacts sc 
                WHERE (
                    (entity_type = 'anchor_sessions' AND sc.session_id = entity_id)
                    OR
                    (entity_type = 'alerts' AND EXISTS (
                        SELECT 1 
                        FROM public.alerts a 
                        WHERE a.id = entity_id AND sc.session_id = a.session_id
                    ))
                )
                AND sc.linked_profile_id = auth.uid()
            )
        )
    );

-- Note: No INSERT policies exist for authenticated users.
-- To prevent direct client spoofing, audit logs are generated exclusively by database triggers, 
-- Edge Functions, or background workers executing under database service-role bypass credentials.
