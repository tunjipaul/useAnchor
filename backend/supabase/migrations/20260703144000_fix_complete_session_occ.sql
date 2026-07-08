-- =========================================================================
-- useAnchor Database Migration: Fix OCC Conflict on Session Completion
-- Description: Modifies complete_anchor_session to prevent circular updates
--              when resolving active emergency alerts, preventing stale version
--              clashes during manual de-escalation/completion.
-- =========================================================================

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
    -- Select the session FOR UPDATE to lock the row
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
        -- resolve_alert already updates the session status to 'completed', cancels remaining check-ins,
        -- increments the session_version, and logs the audit event.
        -- Running another update inside this function would trigger an OCC Conflict.
        PERFORM public.resolve_alert(p_user_id, v_active_alert_id, 'user_safe_entry', 'User safely completed session.', p_correlation_id);
        RETURN;
    END IF;

    -- Standard session completion path (when status is active and there's no active alert)
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

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
