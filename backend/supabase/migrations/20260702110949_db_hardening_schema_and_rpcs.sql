-- =========================================================================
-- useAnchor Database Migration: DB Hardening and RPC Refactoring
-- Description: Alters schema to support Optimistic Concurrency Control (OCC),
--              cooldown windows, and deterministic checkins. Drops and recreates
--              all 18 RPC functions with row-locking and explicit auth contexts.
-- =========================================================================

-- 1. SCHEMA ALTERATIONS
-- Add version tracking and escalation trackers to sessions
ALTER TABLE public.anchor_sessions 
    ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS last_escalation_at TIMESTAMPTZ DEFAULT NULL;

-- Add final check-in indicator to checkins
ALTER TABLE public.checkins 
    ADD COLUMN IF NOT EXISTS is_final BOOLEAN NOT NULL DEFAULT FALSE;

-- =========================================================================
-- 2. DROP OLD RPC SIGNATURES TO PREVENT CONFLICTS
-- =========================================================================
DROP FUNCTION IF EXISTS public.start_anchor_session(UUID, UUID);
DROP FUNCTION IF EXISTS public.schedule_anchor_session(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID);
DROP FUNCTION IF EXISTS public.cancel_anchor_session(UUID, UUID);
DROP FUNCTION IF EXISTS public.complete_anchor_session(UUID, UUID);
DROP FUNCTION IF EXISTS public.create_checkins_for_session(UUID, UUID);
DROP FUNCTION IF EXISTS public.mark_checkin_completed(UUID, public.checkin_method, DOUBLE PRECISION, DOUBLE PRECISION, UUID);
DROP FUNCTION IF EXISTS public.mark_checkin_missed(UUID, UUID);
DROP FUNCTION IF EXISTS public.skip_checkin(UUID, UUID);
DROP FUNCTION IF EXISTS public.trigger_alert(UUID, public.alert_trigger_type, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, UUID, UUID);
DROP FUNCTION IF EXISTS public.resolve_alert(UUID, public.alert_resolution_reason, TEXT, UUID);
DROP FUNCTION IF EXISTS public.cancel_alert(UUID, UUID);
DROP FUNCTION IF EXISTS public.add_session_contacts(UUID, UUID[], UUID);
DROP FUNCTION IF EXISTS public.link_trusted_contact_to_profile(UUID, UUID, UUID);
DROP FUNCTION IF EXISTS public.acknowledge_alert(UUID, UUID, UUID);
DROP FUNCTION IF EXISTS public.queue_alert_recipients(UUID, UUID);
DROP FUNCTION IF EXISTS public.mark_recipient_sent(UUID, UUID, public.alert_delivery_channel, UUID);
DROP FUNCTION IF EXISTS public.mark_recipient_delivered(UUID, UUID, UUID);
DROP FUNCTION IF EXISTS public.mark_recipient_failed(UUID, UUID, TEXT, UUID);

-- =========================================================================
-- 3. DEFINE NEW HARDENED PL/PGSQL FUNCTIONS
-- =========================================================================

-- =========================================================================
-- GROUP 1: SESSION LIFECYCLE RPCS
-- =========================================================================

-- Starts a session, shifting state draft/scheduled -> active with row-locking and version validation (OCC)
CREATE OR REPLACE FUNCTION public.start_anchor_session(
    p_user_id UUID,
    p_session_id UUID,
    p_current_version INT,
    p_correlation_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_session public.anchor_sessions%ROWTYPE;
    v_rows_updated INTEGER;
BEGIN
    -- Acquire exclusive row lock FOR UPDATE immediately
    SELECT * INTO v_session 
    FROM public.anchor_sessions 
    WHERE id = p_session_id 
    FOR UPDATE;
    
    IF v_session.id IS NULL THEN
        RAISE EXCEPTION 'Session not found.';
    END IF;
    
    -- Verify ownership explicitly via explicit actor ID parameter
    IF v_session.user_id != p_user_id THEN
        RAISE EXCEPTION 'Unauthorized: Only the session owner can start this session.';
    END IF;
    
    -- Enforce Optimistic Concurrency Control (OCC)
    IF v_session.session_version != p_current_version THEN
        RAISE EXCEPTION 'OCC Conflict: Stale session version. Expected version %, found %.', p_current_version, v_session.session_version;
    END IF;
    
    -- State machine transition checks
    IF v_session.status NOT IN ('draft', 'scheduled') THEN
        RAISE EXCEPTION 'State Conflict: Session in status % cannot transition to active.', v_session.status;
    END IF;

    UPDATE public.anchor_sessions
    SET status = 'active',
        actual_start = NOW(),
        session_version = session_version + 1,
        updated_at = NOW()
    WHERE id = p_session_id AND session_version = p_current_version;
    
    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
    IF v_rows_updated = 0 THEN
        RAISE EXCEPTION 'OCC Conflict: Concurrent update detected during session start.';
    END IF;

    -- Logs audit event
    PERFORM public.log_audit_event(
        v_session.user_id,
        p_user_id,
        'user',
        'session',
        'session_started',
        'anchor_sessions',
        p_session_id,
        jsonb_build_object('status', 'active', 'actual_start', NOW(), 'version', p_current_version + 1),
        NULL,
        p_correlation_id
    );

    -- Auto-initialize checkins for this session
    PERFORM public.create_checkins_for_session(p_user_id, p_session_id, p_correlation_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Schedules a session in the future, shifting state draft -> scheduled with version check (OCC)
CREATE OR REPLACE FUNCTION public.schedule_anchor_session(
    p_user_id UUID,
    p_session_id UUID,
    p_current_version INT,
    p_scheduled_start TIMESTAMPTZ,
    p_expected_end TIMESTAMPTZ,
    p_correlation_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_session public.anchor_sessions%ROWTYPE;
    v_rows_updated INTEGER;
BEGIN
    SELECT * INTO v_session 
    FROM public.anchor_sessions 
    WHERE id = p_session_id 
    FOR UPDATE;
    
    IF v_session.id IS NULL THEN
        RAISE EXCEPTION 'Session not found.';
    END IF;
    
    IF v_session.user_id != p_user_id THEN
        RAISE EXCEPTION 'Unauthorized: Only the session owner can schedule this session.';
    END IF;
    
    IF v_session.session_version != p_current_version THEN
        RAISE EXCEPTION 'OCC Conflict: Stale session version.';
    END IF;
    
    IF v_session.status != 'draft' THEN
        RAISE EXCEPTION 'State Conflict: Only draft sessions can be scheduled.';
    END IF;

    IF p_expected_end <= p_scheduled_start THEN
        RAISE EXCEPTION 'Validation Failed: expected_end must occur after scheduled_start.';
    END IF;

    UPDATE public.anchor_sessions
    SET status = 'scheduled',
        scheduled_start = p_scheduled_start,
        expected_end = p_expected_end,
        session_version = session_version + 1,
        updated_at = NOW()
    WHERE id = p_session_id AND session_version = p_current_version;
    
    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
    IF v_rows_updated = 0 THEN
        RAISE EXCEPTION 'OCC Conflict: Concurrent update detected during session scheduling.';
    END IF;

    PERFORM public.log_audit_event(
        v_session.user_id,
        p_user_id,
        'user',
        'session',
        'session_scheduled',
        'anchor_sessions',
        p_session_id,
        jsonb_build_object('status', 'scheduled', 'scheduled_start', p_scheduled_start, 'expected_end', p_expected_end, 'version', p_current_version + 1),
        NULL,
        p_correlation_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Cancels a session before or during execution, shifting status to cancelled
CREATE OR REPLACE FUNCTION public.cancel_anchor_session(
    p_user_id UUID,
    p_session_id UUID,
    p_current_version INT,
    p_correlation_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_session public.anchor_sessions%ROWTYPE;
    v_rows_updated INTEGER;
BEGIN
    SELECT * INTO v_session 
    FROM public.anchor_sessions 
    WHERE id = p_session_id 
    FOR UPDATE;
    
    IF v_session.id IS NULL THEN
        RAISE EXCEPTION 'Session not found.';
    END IF;
    
    IF v_session.user_id != p_user_id THEN
        RAISE EXCEPTION 'Unauthorized: Only the session owner can cancel this session.';
    END IF;
    
    IF v_session.session_version != p_current_version THEN
        RAISE EXCEPTION 'OCC Conflict: Stale session version.';
    END IF;
    
    IF v_session.status NOT IN ('draft', 'scheduled', 'active') THEN
        RAISE EXCEPTION 'State Conflict: Session in status % cannot be cancelled.', v_session.status;
    END IF;

    UPDATE public.anchor_sessions
    SET status = 'cancelled',
        completion_reason = 'cancelled_pre_start',
        actual_end = NOW(),
        session_version = session_version + 1,
        updated_at = NOW()
    WHERE id = p_session_id AND session_version = p_current_version;
    
    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
    IF v_rows_updated = 0 THEN
        RAISE EXCEPTION 'OCC Conflict: Concurrent update detected during session cancellation.';
    END IF;

    -- Lock and void all scheduled/pending check-ins
    UPDATE public.checkins
    SET status = 'cancelled',
        updated_at = NOW()
    WHERE session_id = p_session_id AND status IN ('scheduled', 'pending');

    PERFORM public.log_audit_event(
        v_session.user_id,
        p_user_id,
        'user',
        'session',
        'session_cancelled',
        'anchor_sessions',
        p_session_id,
        jsonb_build_object('status', 'cancelled', 'completion_reason', 'cancelled_pre_start', 'version', p_current_version + 1),
        NULL,
        p_correlation_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Completes a session safely, shifting active/emergency -> completed
CREATE OR REPLACE FUNCTION public.complete_anchor_session(
    p_user_id UUID,
    p_session_id UUID,
    p_current_version INT,
    p_correlation_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_session public.anchor_sessions%ROWTYPE;
    v_completion_reason public.session_completion_reason;
    v_active_alert_id UUID;
    v_rows_updated INTEGER;
BEGIN
    SELECT * INTO v_session 
    FROM public.anchor_sessions 
    WHERE id = p_session_id 
    FOR UPDATE;
    
    IF v_session.id IS NULL THEN
        RAISE EXCEPTION 'Session not found.';
    END IF;
    
    IF v_session.user_id != p_user_id THEN
        RAISE EXCEPTION 'Unauthorized: Only the session owner can complete this session.';
    END IF;
    
    IF v_session.session_version != p_current_version THEN
        RAISE EXCEPTION 'OCC Conflict: Stale session version.';
    END IF;
    
    IF v_session.status NOT IN ('active', 'emergency') THEN
        RAISE EXCEPTION 'State Conflict: Only active or emergency sessions can be completed.';
    END IF;

    v_completion_reason := CASE 
        WHEN v_session.status = 'emergency' THEN 'emergency_resolved'::public.session_completion_reason
        ELSE 'safe_checkin'::public.session_completion_reason
    END;

    -- Resolve any active emergency alert tied to this session
    SELECT id INTO v_active_alert_id 
    FROM public.alerts 
    WHERE session_id = p_session_id AND status = 'active'
    FOR UPDATE;
    
    IF v_active_alert_id IS NOT NULL THEN
        PERFORM public.resolve_alert(p_user_id, v_active_alert_id, 'user_safe_entry', 'User safely completed session.', p_correlation_id);
    END IF;

    UPDATE public.anchor_sessions
    SET status = 'completed',
        completion_reason = v_completion_reason,
        actual_end = NOW(),
        session_version = session_version + 1,
        updated_at = NOW()
    WHERE id = p_session_id AND session_version = p_current_version;
    
    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
    IF v_rows_updated = 0 THEN
        RAISE EXCEPTION 'OCC Conflict: Concurrent update detected during session completion.';
    END IF;

    -- Lock and skip any remaining un-executed checkins
    UPDATE public.checkins
    SET status = 'skipped',
        updated_at = NOW()
    WHERE session_id = p_session_id AND status IN ('scheduled', 'pending');

    PERFORM public.log_audit_event(
        v_session.user_id,
        p_user_id,
        'user',
        'session',
        'session_completed',
        'anchor_sessions',
        p_session_id,
        jsonb_build_object('status', 'completed', 'completion_reason', v_completion_reason, 'version', p_current_version + 1),
        NULL,
        p_correlation_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =========================================================================
-- GROUP 2: CHECK-IN ENGINE RPCS
-- =========================================================================

-- Generates scheduled check-ins sequentially for a session (Idempotent)
CREATE OR REPLACE FUNCTION public.create_checkins_for_session(
    p_user_id UUID,
    p_session_id UUID,
    p_correlation_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_session public.anchor_sessions%ROWTYPE;
    v_start TIMESTAMPTZ;
    v_end TIMESTAMPTZ;
    v_interval INTERVAL;
    v_curr TIMESTAMPTZ;
    v_seq INTEGER := 1;
BEGIN
    SELECT * INTO v_session 
    FROM public.anchor_sessions 
    WHERE id = p_session_id 
    FOR UPDATE;
    
    IF v_session.id IS NULL THEN
        RAISE EXCEPTION 'Session not found.';
    END IF;

    IF v_session.user_id != p_user_id THEN
        RAISE EXCEPTION 'Unauthorized: Only the session owner can initialize check-ins.';
    END IF;

    v_start := COALESCE(v_session.actual_start, v_session.scheduled_start, NOW());
    v_end := v_session.expected_end;
    v_interval := (v_session.checkin_interval_minutes || ' minutes')::INTERVAL;

    -- Clear any existing scheduled check-ins for idempotency
    DELETE FROM public.checkins WHERE session_id = p_session_id AND status = 'scheduled';

    v_curr := v_start + v_interval;
    WHILE v_curr < v_end LOOP
        INSERT INTO public.checkins (session_id, sequence_number, scheduled_time, deadline_time, status, is_final)
        VALUES (p_session_id, v_seq, v_curr, v_curr + INTERVAL '5 minutes', 'scheduled', FALSE)
        ON CONFLICT (session_id, sequence_number) DO NOTHING;
        
        v_seq := v_seq + 1;
        v_curr := v_curr + v_interval;
    END LOOP;

    -- Final checkpoint exactly at expected return time, marked as is_final
    INSERT INTO public.checkins (session_id, sequence_number, scheduled_time, deadline_time, status, is_final)
    VALUES (p_session_id, v_seq, v_end, v_end + INTERVAL '5 minutes', 'scheduled', TRUE)
    ON CONFLICT (session_id, sequence_number) DO NOTHING;
    
    PERFORM public.log_audit_event(
        v_session.user_id,
        p_user_id,
        'system',
        'checkin',
        'checkins_created',
        'anchor_sessions',
        p_session_id,
        jsonb_build_object('checkin_count', v_seq),
        NULL,
        p_correlation_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Marks a scheduled/pending check-in completed safely with row locking and is_final validation
CREATE OR REPLACE FUNCTION public.mark_checkin_completed(
    p_user_id UUID,
    p_checkin_id UUID,
    p_method public.checkin_method,
    p_lat DOUBLE PRECISION,
    p_lng DOUBLE PRECISION,
    p_correlation_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_checkin public.checkins%ROWTYPE;
    v_session public.anchor_sessions%ROWTYPE;
BEGIN
    -- Exclusive row lock FOR UPDATE on targets immediately
    SELECT * INTO v_checkin 
    FROM public.checkins 
    WHERE id = p_checkin_id 
    FOR UPDATE;
    
    IF v_checkin.id IS NULL THEN
        RAISE EXCEPTION 'Check-in not found.';
    END IF;

    SELECT * INTO v_session 
    FROM public.anchor_sessions 
    WHERE id = v_checkin.session_id 
    FOR UPDATE;

    IF v_session.user_id != p_user_id THEN
        RAISE EXCEPTION 'Unauthorized: Only the session owner can check in.';
    END IF;

    IF v_checkin.status NOT IN ('scheduled', 'pending') THEN
        -- Safely ignore if already resolved (idempotency support)
        RETURN;
    END IF;

    -- Mark check-in resolved
    UPDATE public.checkins
    SET status = 'completed',
        method = p_method,
        actual_response_time = NOW(),
        location_lat = p_lat,
        location_lng = p_lng,
        updated_at = NOW()
    WHERE id = p_checkin_id;

    -- Log audit event
    PERFORM public.log_audit_event(
        v_session.user_id,
        p_user_id,
        'user',
        'checkin',
        'checkin_completed',
        'checkins',
        p_checkin_id,
        jsonb_build_object('status', 'completed', 'method', p_method, 'location', jsonb_build_array(p_lat, p_lng)),
        NULL,
        p_correlation_id
    );

    -- If this is the deterministic final check-in, complete the parent session
    IF v_checkin.is_final = TRUE THEN
        PERFORM public.complete_anchor_session(p_user_id, v_session.id, v_session.session_version, p_correlation_id);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Marks a check-in missed (escalation worker trigger)
CREATE OR REPLACE FUNCTION public.mark_checkin_missed(
    p_user_id UUID,
    p_checkin_id UUID,
    p_correlation_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_checkin public.checkins%ROWTYPE;
    v_session public.anchor_sessions%ROWTYPE;
BEGIN
    SELECT * INTO v_checkin 
    FROM public.checkins 
    WHERE id = p_checkin_id 
    FOR UPDATE;
    
    IF v_checkin.id IS NULL THEN
        RAISE EXCEPTION 'Check-in not found.';
    END IF;

    SELECT * INTO v_session 
    FROM public.anchor_sessions 
    WHERE id = v_checkin.session_id 
    FOR UPDATE;

    -- Skip verification on automated cron workers (p_user_id is NULL)
    IF p_user_id IS NOT NULL AND v_session.user_id != p_user_id THEN
        RAISE EXCEPTION 'Unauthorized.';
    END IF;

    IF v_checkin.status NOT IN ('scheduled', 'pending') THEN
        RETURN;
    END IF;

    UPDATE public.checkins
    SET status = 'missed',
        updated_at = NOW()
    WHERE id = p_checkin_id;

    PERFORM public.log_audit_event(
        v_session.user_id,
        p_user_id,
        'system',
        'checkin',
        'checkin_missed',
        'checkins',
        p_checkin_id,
        jsonb_build_object('status', 'missed'),
        NULL,
        p_correlation_id
    );

    -- Missed check-in escalates the session directly to emergency alert status
    PERFORM public.trigger_alert(
        p_user_id,
        v_session.id,
        'missed_checkin',
        v_session.last_known_lat,
        v_session.last_known_lng,
        NULL,
        v_session.last_known_address,
        p_checkin_id,
        p_correlation_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Skips a check-in (used during session duration extensions)
CREATE OR REPLACE FUNCTION public.skip_checkin(
    p_user_id UUID,
    p_checkin_id UUID,
    p_correlation_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_checkin public.checkins%ROWTYPE;
    v_session public.anchor_sessions%ROWTYPE;
BEGIN
    SELECT * INTO v_checkin 
    FROM public.checkins 
    WHERE id = p_checkin_id 
    FOR UPDATE;
    
    IF v_checkin.id IS NULL THEN
        RAISE EXCEPTION 'Check-in not found.';
    END IF;

    SELECT * INTO v_session 
    FROM public.anchor_sessions 
    WHERE id = v_checkin.session_id 
    FOR UPDATE;

    IF v_session.user_id != p_user_id THEN
        RAISE EXCEPTION 'Unauthorized.';
    END IF;

    IF v_checkin.status NOT IN ('scheduled', 'pending') THEN
        RETURN;
    END IF;

    UPDATE public.checkins
    SET status = 'skipped',
        updated_at = NOW()
    WHERE id = p_checkin_id;

    PERFORM public.log_audit_event(
        v_session.user_id,
        p_user_id,
        'user',
        'checkin',
        'checkin_skipped',
        'checkins',
        p_checkin_id,
        jsonb_build_object('status', 'skipped'),
        NULL,
        p_correlation_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =========================================================================
-- GROUP 3: ALERT ENGINE RPCS
-- =========================================================================

-- Initiates or overrides an emergency alert with lock guards, severity prioritization, and cooldown filters
CREATE OR REPLACE FUNCTION public.trigger_alert(
    p_user_id UUID,
    p_session_id UUID,
    p_trigger_type public.alert_trigger_type,
    p_lat DOUBLE PRECISION,
    p_lng DOUBLE PRECISION,
    p_accuracy DOUBLE PRECISION,
    p_address TEXT,
    p_checkin_id UUID DEFAULT NULL,
    p_correlation_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_session public.anchor_sessions%ROWTYPE;
    v_existing_alert public.alerts%ROWTYPE;
    v_existing_rank INTEGER;
    v_new_rank INTEGER;
    v_alert_id UUID;
    v_actor_type public.audit_actor_type := 'user';
BEGIN
    SELECT * INTO v_session 
    FROM public.anchor_sessions 
    WHERE id = p_session_id 
    FOR UPDATE;
    
    IF v_session.id IS NULL THEN
        RAISE EXCEPTION 'Session not found.';
    END IF;

    -- Enforce ownership for manual triggers
    IF p_trigger_type = 'manual_sos' AND p_user_id IS NOT NULL AND v_session.user_id != p_user_id THEN
        RAISE EXCEPTION 'Unauthorized.';
    END IF;

    -- Severity Rank Evaluation:
    -- higher severity triggers take priority and overwrite existing ones
    v_new_rank := CASE p_trigger_type
        WHEN 'manual_sos' THEN 10
        WHEN 'wearable_fall' THEN 9
        WHEN 'voice_trigger' THEN 8
        WHEN 'geofence_violation' THEN 7
        WHEN 'ai_anomaly' THEN 6
        WHEN 'missed_checkin' THEN 5
        ELSE 1
    END;

    -- Check if an active emergency alert exists
    SELECT * INTO v_existing_alert 
    FROM public.alerts 
    WHERE session_id = p_session_id AND status = 'active'
    FOR UPDATE;

    -- Escalation storm protection cooldown
    -- If trigger is of same/lower severity and cooldown is active (< 1 min elapsed), reject to protect gateways
    IF v_session.last_escalation_at IS NOT NULL 
       AND NOW() - v_session.last_escalation_at < INTERVAL '1 minute' 
       AND v_existing_alert.id IS NOT NULL THEN
        
        v_existing_rank := CASE v_existing_alert.trigger_type
            WHEN 'manual_sos' THEN 10
            WHEN 'wearable_fall' THEN 9
            WHEN 'voice_trigger' THEN 8
            WHEN 'geofence_violation' THEN 7
            WHEN 'ai_anomaly' THEN 6
            WHEN 'missed_checkin' THEN 5
            ELSE 1
        END;

        IF v_new_rank <= v_existing_rank THEN
            RETURN v_existing_alert.id;
        END IF;
    END IF;

    IF v_existing_alert.id IS NOT NULL THEN
        v_existing_rank := CASE v_existing_alert.trigger_type
            WHEN 'manual_sos' THEN 10
            WHEN 'wearable_fall' THEN 9
            WHEN 'voice_trigger' THEN 8
            WHEN 'geofence_violation' THEN 7
            WHEN 'ai_anomaly' THEN 6
            WHEN 'missed_checkin' THEN 5
            ELSE 1
        END;

        IF v_new_rank > v_existing_rank THEN
            -- Severity escalation override
            UPDATE public.alerts
            SET trigger_type = p_trigger_type,
                location_lat = COALESCE(p_lat, location_lat),
                location_lng = COALESCE(p_lng, location_lng),
                location_accuracy_meters = COALESCE(p_accuracy, location_accuracy_meters),
                location_address = COALESCE(p_address, location_address),
                location_captured_at = NOW(),
                updated_at = NOW()
            WHERE id = v_existing_alert.id;

            -- Update cooldown timestamp
            UPDATE public.anchor_sessions
            SET last_escalation_at = NOW(),
                updated_at = NOW()
            WHERE id = p_session_id;

            PERFORM public.log_audit_event(
                v_session.user_id,
                p_user_id,
                CASE WHEN p_user_id IS NULL THEN 'system'::public.audit_actor_type ELSE 'user'::public.audit_actor_type END,
                'alert',
                'alert_escalated',
                'alerts',
                v_existing_alert.id,
                jsonb_build_object('status', 'active', 'trigger_type', p_trigger_type, 'previous_trigger', v_existing_alert.trigger_type),
                NULL,
                p_correlation_id
            );

            RETURN v_existing_alert.id;
        ELSE
            -- Idempotent bypass for same or lower severity alert triggers
            RETURN v_existing_alert.id;
        END IF;
    END IF;

    -- Create new active alert record (Atomic transaction guarantees recipients are created)
    INSERT INTO public.alerts (
        session_id,
        checkin_id,
        user_id,
        trigger_type,
        status,
        location_lat,
        location_lng,
        location_accuracy_meters,
        location_address,
        location_captured_at
    ) VALUES (
        p_session_id,
        p_checkin_id,
        v_session.user_id,
        p_trigger_type,
        'active',
        p_lat,
        p_lng,
        p_accuracy,
        p_address,
        CASE WHEN p_lat IS NOT NULL THEN NOW() ELSE NULL END
    )
    RETURNING id INTO v_alert_id;

    -- Shift parent session state
    UPDATE public.anchor_sessions
    SET status = 'emergency',
        sos_triggered = TRUE,
        auto_escalated = CASE WHEN p_trigger_type = 'missed_checkin' THEN TRUE ELSE FALSE END,
        emergency_started_at = NOW(),
        last_escalation_at = NOW(),
        updated_at = NOW()
    WHERE id = p_session_id;

    PERFORM public.log_audit_event(
        v_session.user_id,
        p_user_id,
        CASE WHEN p_user_id IS NULL THEN 'system'::public.audit_actor_type ELSE 'user'::public.audit_actor_type END,
        'alert',
        'alert_created',
        'alerts',
        v_alert_id,
        jsonb_build_object('status', 'active', 'trigger_type', p_trigger_type),
        NULL,
        p_correlation_id
    );

    -- Automatically queue all contacts assigned to this session for notifications
    PERFORM public.queue_alert_recipients(p_user_id, v_alert_id, p_correlation_id);

    RETURN v_alert_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Resolves an active emergency alert safely
CREATE OR REPLACE FUNCTION public.resolve_alert(
    p_user_id UUID,
    p_alert_id UUID,
    p_reason public.alert_resolution_reason,
    p_details TEXT DEFAULT NULL,
    p_correlation_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_alert public.alerts%ROWTYPE;
    v_session public.anchor_sessions%ROWTYPE;
    v_actor_type public.audit_actor_type := 'user';
BEGIN
    SELECT * INTO v_alert 
    FROM public.alerts 
    WHERE id = p_alert_id 
    FOR UPDATE;
    
    IF v_alert.id IS NULL THEN
        RAISE EXCEPTION 'Alert not found.';
    END IF;

    IF v_alert.status != 'active' THEN
        RETURN;
    END IF;

    -- Verify actor: only session owner or assigned contacts can resolve
    IF p_user_id IS NOT NULL AND v_alert.user_id != p_user_id THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.session_contacts 
            WHERE session_id = v_alert.session_id AND linked_profile_id = p_user_id
        ) THEN
            RAISE EXCEPTION 'Unauthorized: Responding contact must be assigned to this session circle.';
        END IF;
        v_actor_type := 'contact';
    END IF;

    -- Close the Alert File
    UPDATE public.alerts
    SET status = 'resolved',
        resolved_at = NOW(),
        resolved_by = p_user_id,
        resolution_reason = p_reason,
        resolution_details = p_details,
        updated_at = NOW()
    WHERE id = p_alert_id;

    PERFORM public.log_audit_event(
        v_alert.user_id,
        p_user_id,
        v_actor_type,
        'alert',
        'alert_resolved',
        'alerts',
        p_alert_id,
        jsonb_build_object('status', 'resolved', 'resolution_reason', p_reason),
        NULL,
        p_correlation_id
    );

    -- Close parent session
    SELECT * INTO v_session 
    FROM public.anchor_sessions 
    WHERE id = v_alert.session_id 
    FOR UPDATE;
    
    IF v_session.status = 'emergency' THEN
        UPDATE public.anchor_sessions
        SET status = 'completed',
            completion_reason = 'emergency_resolved',
            actual_end = NOW(),
            session_version = session_version + 1,
            updated_at = NOW()
        WHERE id = v_session.id;

        -- Cancel any remaining check-ins
        UPDATE public.checkins
        SET status = 'skipped',
            updated_at = NOW()
        WHERE session_id = v_session.id AND status IN ('scheduled', 'pending');

        PERFORM public.log_audit_event(
            v_session.user_id,
            p_user_id,
            v_actor_type,
            'session',
            'session_completed',
            'anchor_sessions',
            v_session.id,
            jsonb_build_object('status', 'completed', 'completion_reason', 'emergency_resolved', 'version', v_session.session_version + 1),
            NULL,
            p_correlation_id
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Cancels an alert (false alarm) returning the session to active state
CREATE OR REPLACE FUNCTION public.cancel_alert(
    p_user_id UUID,
    p_alert_id UUID,
    p_correlation_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_alert public.alerts%ROWTYPE;
    v_session public.anchor_sessions%ROWTYPE;
BEGIN
    SELECT * INTO v_alert 
    FROM public.alerts 
    WHERE id = p_alert_id 
    FOR UPDATE;
    
    IF v_alert.id IS NULL THEN
        RAISE EXCEPTION 'Alert not found.';
    END IF;

    IF p_user_id IS NOT NULL AND v_alert.user_id != p_user_id THEN
        RAISE EXCEPTION 'Unauthorized.';
    END IF;

    IF v_alert.status != 'active' THEN
        RETURN;
    END IF;

    -- Mark Alert cancelled
    UPDATE public.alerts
    SET status = 'cancelled',
        resolved_at = NOW(),
        resolved_by = p_user_id,
        resolution_reason = 'user_false_alarm',
        resolution_details = 'Cancelled as false alarm by user.',
        updated_at = NOW()
    WHERE id = p_alert_id;

    PERFORM public.log_audit_event(
        v_alert.user_id,
        p_user_id,
        'user',
        'alert',
        'alert_cancelled',
        'alerts',
        p_alert_id,
        jsonb_build_object('status', 'cancelled'),
        NULL,
        p_correlation_id
    );

    -- Revert Session back to active
    SELECT * INTO v_session 
    FROM public.anchor_sessions 
    WHERE id = v_alert.session_id 
    FOR UPDATE;
    
    UPDATE public.anchor_sessions
    SET status = 'active',
        sos_triggered = FALSE,
        auto_escalated = FALSE,
        emergency_started_at = NULL,
        session_version = session_version + 1,
        updated_at = NOW()
    WHERE id = v_alert.session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =========================================================================
-- GROUP 4: CONTACT SYSTEM RPCS
-- =========================================================================

-- Captures snapshotted contacts from user circle and writes to session_contacts
CREATE OR REPLACE FUNCTION public.add_session_contacts(
    p_user_id UUID,
    p_session_id UUID,
    p_trusted_contact_ids UUID[],
    p_correlation_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_session public.anchor_sessions%ROWTYPE;
    v_contact_id UUID;
    v_contact public.trusted_contacts%ROWTYPE;
BEGIN
    SELECT * INTO v_session 
    FROM public.anchor_sessions 
    WHERE id = p_session_id 
    FOR UPDATE;
    
    IF v_session.id IS NULL THEN
        RAISE EXCEPTION 'Session not found.';
    END IF;

    IF v_session.user_id != p_user_id THEN
        RAISE EXCEPTION 'Unauthorized.';
    END IF;

    FOREACH v_contact_id IN ARRAY p_trusted_contact_ids LOOP
        SELECT * INTO v_contact FROM public.trusted_contacts WHERE id = v_contact_id FOR SHARE;
        
        IF v_contact.id IS NOT NULL AND v_contact.user_id = v_session.user_id AND v_contact.is_active = TRUE AND v_contact.deleted_at IS NULL THEN
            -- Write Immutable snapshot representation
            INSERT INTO public.session_contacts (
                session_id,
                trusted_contact_id,
                linked_profile_id,
                name,
                nickname,
                phone,
                relationship,
                notification_preference
            ) VALUES (
                p_session_id,
                v_contact.id,
                v_contact.linked_profile_id,
                v_contact.name,
                v_contact.nickname,
                v_contact.phone,
                v_contact.relationship,
                v_contact.notification_preference
            )
            ON CONFLICT (session_id, phone) DO NOTHING;
        END IF;
    END LOOP;

    PERFORM public.log_audit_event(
        v_session.user_id,
        p_user_id,
        'user',
        'trusted_contact',
        'contacts_assigned_to_session',
        'anchor_sessions',
        p_session_id,
        jsonb_build_object('contact_count', array_length(p_trusted_contact_ids, 1)),
        NULL,
        p_correlation_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Links a registered profile ID to an SMS-only contact card (e.g. contact signs up)
CREATE OR REPLACE FUNCTION public.link_trusted_contact_to_profile(
    p_user_id UUID,
    p_contact_id UUID,
    p_profile_id UUID,
    p_correlation_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_contact public.trusted_contacts%ROWTYPE;
BEGIN
    SELECT * INTO v_contact 
    FROM public.trusted_contacts 
    WHERE id = p_contact_id 
    FOR UPDATE;
    
    IF v_contact.id IS NULL THEN
        RAISE EXCEPTION 'Contact not found.';
    END IF;

    IF v_contact.user_id != p_user_id THEN
        RAISE EXCEPTION 'Unauthorized.';
    END IF;

    -- Update future mapping link
    UPDATE public.trusted_contacts
    SET linked_profile_id = p_profile_id,
        updated_at = NOW()
    WHERE id = p_contact_id;

    -- Cascade update existing active snapshots
    UPDATE public.session_contacts
    SET linked_profile_id = p_profile_id,
        updated_at = NOW()
    WHERE trusted_contact_id = p_contact_id AND linked_profile_id IS NULL;

    PERFORM public.log_audit_event(
        v_contact.user_id,
        p_user_id,
        'user',
        'trusted_contact',
        'contact_linked_to_profile',
        'trusted_contacts',
        p_contact_id,
        jsonb_build_object('profile_id', p_profile_id),
        NULL,
        p_correlation_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Allows a contact to acknowledge receipt of an active alert
CREATE OR REPLACE FUNCTION public.acknowledge_alert(
    p_user_id UUID,
    p_alert_id UUID,
    p_session_contact_id UUID,
    p_correlation_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_recipient public.alert_recipients%ROWTYPE;
    v_contact public.session_contacts%ROWTYPE;
    v_alert public.alerts%ROWTYPE;
BEGIN
    SELECT * INTO v_alert 
    FROM public.alerts 
    WHERE id = p_alert_id 
    FOR SHARE;
    
    IF v_alert.id IS NULL THEN
        RAISE EXCEPTION 'Alert not found.';
    END IF;

    SELECT * INTO v_contact 
    FROM public.session_contacts 
    WHERE id = p_session_contact_id 
    FOR UPDATE;
    
    IF v_contact.id IS NULL THEN
        RAISE EXCEPTION 'Contact assignment not found.';
    END IF;

    IF v_contact.linked_profile_id != p_user_id THEN
        RAISE EXCEPTION 'Unauthorized: Acknowledger must match the contact identity.';
    END IF;

    SELECT * INTO v_recipient 
    FROM public.alert_recipients 
    WHERE alert_id = p_alert_id AND session_contact_id = p_session_contact_id 
    FOR UPDATE;

    IF v_recipient.status = 'acknowledged' THEN
        -- Idempotent return if already acknowledged
        RETURN;
    END IF;

    -- Acknowledge in pipeline tracking
    UPDATE public.alert_recipients
    SET status = 'acknowledged',
        is_responding = TRUE,
        acknowledged_at = NOW(),
        updated_at = NOW()
    WHERE alert_id = p_alert_id AND session_contact_id = p_session_contact_id;

    -- Write timestamp back to snapshot log
    UPDATE public.session_contacts
    SET acknowledged_at = NOW(),
        notification_status = 'acknowledged',
        updated_at = NOW()
    WHERE id = p_session_contact_id;

    PERFORM public.log_audit_event(
        v_alert.user_id,
        p_user_id,
        'contact',
        'notification',
        'recipient_acknowledged',
        'alert_recipients',
        p_alert_id,
        jsonb_build_object('contact_id', p_session_contact_id),
        NULL,
        p_correlation_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =========================================================================
-- GROUP 5: NOTIFICATION PIPELINE CONTROL RPCS
-- =========================================================================

-- Populates recipients queue based on active session circle contacts (Idempotent)
CREATE OR REPLACE FUNCTION public.queue_alert_recipients(
    p_user_id UUID,
    p_alert_id UUID,
    p_correlation_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_alert public.alerts%ROWTYPE;
    v_contact public.session_contacts%ROWTYPE;
    v_count INTEGER := 0;
BEGIN
    SELECT * INTO v_alert 
    FROM public.alerts 
    WHERE id = p_alert_id 
    FOR UPDATE;
    
    IF v_alert.id IS NULL THEN
        RAISE EXCEPTION 'Alert not found.';
    END IF;

    IF p_user_id IS NOT NULL AND v_alert.user_id != p_user_id THEN
        RAISE EXCEPTION 'Unauthorized.';
    END IF;

    FOR v_contact IN SELECT * FROM public.session_contacts WHERE session_id = v_alert.session_id FOR SHARE LOOP
        -- Unique composite PK (alert_id, session_contact_id) prevents duplicates
        INSERT INTO public.alert_recipients (
            alert_id,
            session_contact_id,
            status,
            is_responding,
            queued_at
        ) VALUES (
            p_alert_id,
            v_contact.id,
            'queued',
            FALSE,
            NOW()
        )
        ON CONFLICT (alert_id, session_contact_id) DO NOTHING;
        
        v_count := v_count + 1;
    END LOOP;

    PERFORM public.log_audit_event(
        v_alert.user_id,
        p_user_id,
        'system',
        'notification',
        'notification_recipients_queued',
        'alerts',
        p_alert_id,
        jsonb_build_object('queued_count', v_count),
        NULL,
        p_correlation_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Marks notification state sent to transport channel
CREATE OR REPLACE FUNCTION public.mark_recipient_sent(
    p_user_id UUID,
    p_alert_id UUID,
    p_session_contact_id UUID,
    p_channel public.alert_delivery_channel,
    p_correlation_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_alert public.alerts%ROWTYPE;
    v_recipient public.alert_recipients%ROWTYPE;
BEGIN
    SELECT * INTO v_alert 
    FROM public.alerts 
    WHERE id = p_alert_id 
    FOR SHARE;

    SELECT * INTO v_recipient 
    FROM public.alert_recipients 
    WHERE alert_id = p_alert_id AND session_contact_id = p_session_contact_id 
    FOR UPDATE;

    IF v_recipient.status = 'acknowledged' THEN
        -- Prevent overwriting human acknowledgment state due to network worker retries
        RETURN;
    END IF;
    
    UPDATE public.alert_recipients
    SET status = 'sent',
        channel_used = p_channel,
        sent_at = NOW(),
        updated_at = NOW()
    WHERE alert_id = p_alert_id AND session_contact_id = p_session_contact_id;

    UPDATE public.session_contacts
    SET notification_status = 'sent',
        channel_used = p_channel,
        notified_at = NOW(),
        updated_at = NOW()
    WHERE id = p_session_contact_id;

    PERFORM public.log_audit_event(
        v_alert.user_id,
        p_user_id,
        'service_role',
        'notification',
        'notification_sent',
        'alert_recipients',
        p_alert_id,
        jsonb_build_object('contact_id', p_session_contact_id, 'channel', p_channel),
        NULL,
        p_correlation_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Marks notification successfully delivered by device/carrier
CREATE OR REPLACE FUNCTION public.mark_recipient_delivered(
    p_user_id UUID,
    p_alert_id UUID,
    p_session_contact_id UUID,
    p_correlation_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_alert public.alerts%ROWTYPE;
    v_recipient public.alert_recipients%ROWTYPE;
BEGIN
    SELECT * INTO v_alert 
    FROM public.alerts 
    WHERE id = p_alert_id 
    FOR SHARE;

    SELECT * INTO v_recipient 
    FROM public.alert_recipients 
    WHERE alert_id = p_alert_id AND session_contact_id = p_session_contact_id 
    FOR UPDATE;

    IF v_recipient.status = 'acknowledged' THEN
        RETURN;
    END IF;
    
    UPDATE public.alert_recipients
    SET status = 'delivered',
        delivered_at = NOW(),
        updated_at = NOW()
    WHERE alert_id = p_alert_id AND session_contact_id = p_session_contact_id;

    UPDATE public.session_contacts
    SET notification_status = 'delivered',
        updated_at = NOW()
    WHERE id = p_session_contact_id;

    PERFORM public.log_audit_event(
        v_alert.user_id,
        p_user_id,
        'service_role',
        'notification',
        'notification_delivered',
        'alert_recipients',
        p_alert_id,
        jsonb_build_object('contact_id', p_session_contact_id),
        NULL,
        p_correlation_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Logs notification delivery failure and increments retry counter
CREATE OR REPLACE FUNCTION public.mark_recipient_failed(
    p_user_id UUID,
    p_alert_id UUID,
    p_session_contact_id UUID,
    p_error TEXT,
    p_correlation_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_alert public.alerts%ROWTYPE;
    v_recipient public.alert_recipients%ROWTYPE;
BEGIN
    SELECT * INTO v_alert 
    FROM public.alerts 
    WHERE id = p_alert_id 
    FOR SHARE;

    SELECT * INTO v_recipient 
    FROM public.alert_recipients 
    WHERE alert_id = p_alert_id AND session_contact_id = p_session_contact_id 
    FOR UPDATE;

    IF v_recipient.status = 'acknowledged' THEN
        RETURN;
    END IF;
    
    UPDATE public.alert_recipients
    SET status = 'failed',
        error_message = p_error,
        retry_count = retry_count + 1,
        last_retry_at = NOW(),
        failed_at = NOW(),
        updated_at = NOW()
    WHERE alert_id = p_alert_id AND session_contact_id = p_session_contact_id;

    UPDATE public.session_contacts
    SET notification_status = 'failed',
        updated_at = NOW()
    WHERE id = p_session_contact_id;

    PERFORM public.log_audit_event(
        v_alert.user_id,
        p_user_id,
        'service_role',
        'notification',
        'notification_failed',
        'alert_recipients',
        p_alert_id,
        jsonb_build_object('contact_id', p_session_contact_id, 'error', p_error),
        NULL,
        p_correlation_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
