-- =========================================================================
-- useAnchor Database Migration: Fix Audit Log Immutability Trigger
-- Description: Adjusts prevent_audit_modification trigger to allow
--              ON DELETE SET NULL actions when users delete their accounts.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
    -- Block all deletions completely
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Audit log entries are immutable and cannot be deleted.';
    END IF;

    -- For updates, only allow setting user_id or actor_id to NULL
    IF TG_OP = 'UPDATE' THEN
        -- If any field other than user_id or actor_id is changed, block the update
        IF (NEW.id IS DISTINCT FROM OLD.id OR
            NEW.event_category IS DISTINCT FROM OLD.event_category OR
            NEW.event_type IS DISTINCT FROM OLD.event_type OR
            NEW.entity_type IS DISTINCT FROM OLD.entity_type OR
            NEW.entity_id IS DISTINCT FROM OLD.entity_id OR
            NEW.changes IS DISTINCT FROM OLD.changes OR
            NEW.metadata IS DISTINCT FROM OLD.metadata OR
            NEW.correlation_id IS DISTINCT FROM OLD.correlation_id OR
            NEW.occurred_at IS DISTINCT FROM OLD.occurred_at OR
            NEW.created_at IS DISTINCT FROM OLD.created_at) THEN
            RAISE EXCEPTION 'Audit log entries are immutable and cannot be updated.';
        END IF;

        -- Ensure user_id and actor_id are only being set to NULL (not updated to other IDs)
        IF (NEW.user_id IS NOT NULL AND NEW.user_id IS DISTINCT FROM OLD.user_id) OR
           (NEW.actor_id IS NOT NULL AND NEW.actor_id IS DISTINCT FROM OLD.actor_id) THEN
            RAISE EXCEPTION 'Audit log entries are immutable and cannot be updated to other values.';
        END IF;

        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
