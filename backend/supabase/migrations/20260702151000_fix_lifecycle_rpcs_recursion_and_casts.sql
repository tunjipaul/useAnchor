-- 1. Drop old function signatures to prevent PostgREST confusion
DROP FUNCTION IF EXISTS public.start_anchor_session(uuid, int, uuid);
DROP FUNCTION IF EXISTS public.start_anchor_session(uuid, uuid, int, uuid);

DROP FUNCTION IF EXISTS public.schedule_anchor_session(uuid, int, timestamptz, timestamptz, uuid);
DROP FUNCTION IF EXISTS public.schedule_anchor_session(uuid, uuid, int, timestamptz, timestamptz, uuid);

DROP FUNCTION IF EXISTS public.cancel_anchor_session(uuid, int, uuid);
DROP FUNCTION IF EXISTS public.cancel_anchor_session(uuid, uuid, int, uuid);

DROP FUNCTION IF EXISTS public.complete_anchor_session(uuid, int, uuid);
DROP FUNCTION IF EXISTS public.complete_anchor_session(uuid, uuid, int, uuid);

DROP FUNCTION IF EXISTS public.create_checkins_for_session(uuid, uuid);
DROP FUNCTION IF EXISTS public.create_checkins_for_session(uuid, uuid, uuid);

-- 2. Define create_checkins_for_session with casts
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

    -- Final checkpoint marked as is_final
    INSERT INTO public.checkins (session_id, sequence_number, scheduled_time, deadline_time, status, is_final)
    VALUES (p_session_id, v_seq, v_end, v_end + INTERVAL '5 minutes', 'scheduled', TRUE)
    ON CONFLICT (session_id, sequence_number) DO NOTHING;
    
    PERFORM public.log_audit_event(
        v_session.user_id,
        p_user_id,
        'system'::public.audit_actor_type,
        'checkin'::public.audit_event_category,
        'checkins_created'::TEXT,
        'anchor_sessions'::TEXT,
        p_session_id,
        jsonb_build_object('checkin_count', v_seq),
        NULL::JSONB,
        p_correlation_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Define start_anchor_session with casts
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
    SELECT * INTO v_session 
    FROM public.anchor_sessions 
    WHERE id = p_session_id 
    FOR UPDATE;
    
    IF v_session.id IS NULL THEN
        RAISE EXCEPTION 'Session not found.';
    END IF;
    
    IF v_session.user_id != p_user_id THEN
        RAISE EXCEPTION 'Unauthorized: Only the session owner can start this session.';
    END IF;
    
    IF v_session.session_version != p_current_version THEN
        RAISE EXCEPTION 'OCC Conflict: Stale session version. Expected version %, found %.', p_current_version, v_session.session_version;
    END IF;
    
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
        'user'::public.audit_actor_type,
        'session'::public.audit_event_category,
        'session_started'::TEXT,
        'anchor_sessions'::TEXT,
        p_session_id,
        jsonb_build_object('status', 'active', 'actual_start', NOW(), 'version', p_current_version + 1),
        NULL::JSONB,
        p_correlation_id
    );

    -- Auto-initialize checkins for this session
    PERFORM public.create_checkins_for_session(p_user_id, p_session_id, p_correlation_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Define schedule_anchor_session with casts
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
        'user'::public.audit_actor_type,
        'session'::public.audit_event_category,
        'session_scheduled'::TEXT,
        'anchor_sessions'::TEXT,
        p_session_id,
        jsonb_build_object('status', 'scheduled', 'scheduled_start', p_scheduled_start, 'expected_end', p_expected_end, 'version', p_current_version + 1),
        NULL::JSONB,
        p_correlation_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. Define cancel_anchor_session with casts
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
        'user'::public.audit_actor_type,
        'session'::public.audit_event_category,
        'session_cancelled'::TEXT,
        'anchor_sessions'::TEXT,
        p_session_id,
        jsonb_build_object('status', 'cancelled', 'completion_reason', 'cancelled_pre_start', 'version', p_current_version + 1),
        NULL::JSONB,
        p_correlation_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. Define complete_anchor_session with casts
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
        'user'::public.audit_actor_type,
        'session'::public.audit_event_category,
        'session_completed'::TEXT,
        'anchor_sessions'::TEXT,
        p_session_id,
        jsonb_build_object('status', 'completed', 'completion_reason', v_completion_reason, 'version', p_current_version + 1),
        NULL::JSONB,
        p_correlation_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 7. Direct PostgREST to refresh its schema cache
NOTIFY pgrst, 'reload schema';
