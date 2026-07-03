-- =========================================================================
-- useAnchor Database Migration: Notification Pipeline Safety Patches
-- Description: Fixes retry state transitions for alert recipients and removes
--              broad direct contact UPDATE access in favor of acknowledge_alert().
-- =========================================================================

-- Contacts should acknowledge alerts through public.acknowledge_alert(), which
-- validates identity, updates both alert_recipients and session_contacts, and
-- writes the audit trail. Direct table UPDATE access is too broad for this table.
DROP POLICY IF EXISTS "alert_recipients_update_contact" ON public.alert_recipients;

-- Recreate mark_recipient_sent so retries from failed -> sent clear failure state.
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

    IF v_alert.id IS NULL THEN
        RAISE EXCEPTION 'Alert not found.';
    END IF;

    SELECT * INTO v_recipient
    FROM public.alert_recipients
    WHERE alert_id = p_alert_id AND session_contact_id = p_session_contact_id
    FOR UPDATE;

    IF v_recipient.alert_id IS NULL THEN
        RAISE EXCEPTION 'Alert recipient not found.';
    END IF;

    IF v_recipient.status = 'acknowledged' THEN
        RETURN;
    END IF;

    UPDATE public.alert_recipients
    SET status = 'sent',
        channel_used = p_channel,
        sent_at = NOW(),
        delivered_at = NULL,
        failed_at = NULL,
        error_message = NULL,
        updated_at = NOW()
    WHERE alert_id = p_alert_id AND session_contact_id = p_session_contact_id;

    UPDATE public.session_contacts
    SET notification_status = 'sent',
        channel_used = CASE
            WHEN p_channel IN ('push', 'sms') THEN p_channel::text::public.notification_preference
            ELSE channel_used
        END,
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

-- Recreate mark_recipient_delivered so retries from failed -> delivered clear failure state.
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

    IF v_alert.id IS NULL THEN
        RAISE EXCEPTION 'Alert not found.';
    END IF;

    SELECT * INTO v_recipient
    FROM public.alert_recipients
    WHERE alert_id = p_alert_id AND session_contact_id = p_session_contact_id
    FOR UPDATE;

    IF v_recipient.alert_id IS NULL THEN
        RAISE EXCEPTION 'Alert recipient not found.';
    END IF;

    IF v_recipient.status = 'acknowledged' THEN
        RETURN;
    END IF;

    UPDATE public.alert_recipients
    SET status = 'delivered',
        sent_at = COALESCE(sent_at, NOW()),
        delivered_at = NOW(),
        failed_at = NULL,
        error_message = NULL,
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

COMMENT ON FUNCTION public.mark_recipient_sent(UUID, UUID, UUID, public.alert_delivery_channel, UUID)
IS 'Marks an alert recipient as sent and clears stale failure fields so retries satisfy recipient state constraints.';

COMMENT ON FUNCTION public.mark_recipient_delivered(UUID, UUID, UUID, UUID)
IS 'Marks an alert recipient as delivered and clears stale failure fields so retries satisfy recipient state constraints.';
-- Atomically claim queued/failed recipients for a notification worker.
-- This avoids duplicate sends when multiple workers run concurrently.
CREATE OR REPLACE FUNCTION public.claim_alert_recipients(
    p_limit INTEGER DEFAULT 25,
    p_max_retries INTEGER DEFAULT 3
)
RETURNS TABLE (
    alert_id UUID,
    session_contact_id UUID,
    user_id UUID,
    session_id UUID,
    contact_name TEXT,
    contact_phone TEXT,
    notification_preference public.notification_preference,
    retry_count INTEGER,
    trigger_type public.alert_trigger_type,
    location_lat DOUBLE PRECISION,
    location_lng DOUBLE PRECISION,
    location_address TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    WITH claimable AS (
        SELECT ar.alert_id, ar.session_contact_id
        FROM public.alert_recipients ar
        JOIN public.alerts a ON a.id = ar.alert_id
        WHERE (
              ar.status IN ('queued', 'failed')
              OR (ar.status = 'sending' AND ar.updated_at < NOW() - INTERVAL '10 minutes')
          )
          AND ar.retry_count < p_max_retries
          AND a.status = 'active'
        ORDER BY ar.queued_at ASC, ar.last_retry_at ASC NULLS FIRST
        LIMIT GREATEST(p_limit, 1)
        FOR UPDATE OF ar SKIP LOCKED
    ), claimed AS (
        UPDATE public.alert_recipients ar
        SET status = 'sending',
            sent_at = NULL,
            delivered_at = NULL,
            failed_at = NULL,
            acknowledged_at = NULL,
            error_message = NULL,
            updated_at = NOW()
        FROM claimable c
        WHERE ar.alert_id = c.alert_id
          AND ar.session_contact_id = c.session_contact_id
        RETURNING ar.alert_id, ar.session_contact_id, ar.retry_count
    )
    SELECT
        c.alert_id,
        c.session_contact_id,
        a.user_id,
        a.session_id,
        sc.name AS contact_name,
        sc.phone AS contact_phone,
        sc.notification_preference,
        c.retry_count,
        a.trigger_type,
        a.location_lat,
        a.location_lng,
        a.location_address,
        a.created_at
    FROM claimed c
    JOIN public.alerts a ON a.id = c.alert_id
    JOIN public.session_contacts sc ON sc.id = c.session_contact_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION public.claim_alert_recipients(INTEGER, INTEGER)
IS 'Atomically claims queued or retryable failed alert recipients for notification workers using SKIP LOCKED.';