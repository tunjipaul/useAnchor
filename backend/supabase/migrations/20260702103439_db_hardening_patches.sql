-- =========================================================================
-- useAnchor Database Migration: DB Hardening Patches
-- Description: Applies final security, immutability, and concurrency 
--              protections to the alerts table.
-- =========================================================================

-- 1. Create a trigger function to block updates to finalized alerts.
-- Security Definer: Runs with high permissions to audit table updates.
-- Search Path: Explicitly locked to public to prevent hijacking.
CREATE OR REPLACE FUNCTION public.prevent_resolved_alert_modification()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IN ('resolved', 'cancelled', 'expired') THEN
        RAISE EXCEPTION 'Finalized alerts (resolved, cancelled, or expired) are historically immutable and cannot be updated.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Register the immutability trigger on the alerts table.
-- Fires automatically BEFORE an UPDATE operation executes.
DROP TRIGGER IF EXISTS enforce_alerts_historical_immutability ON public.alerts;
CREATE TRIGGER enforce_alerts_historical_immutability
    BEFORE UPDATE ON public.alerts
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_resolved_alert_modification();

-- 2. Enforce alert race condition prevention.
-- A partial unique index that restricts each anchor session to having 
-- a maximum of one concurrent 'active' emergency alert.
-- Prevents duplicate alert entries from overlapping triggers or UI race conditions.
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_alert_per_session 
    ON public.alerts (session_id) 
    WHERE (status = 'active');
