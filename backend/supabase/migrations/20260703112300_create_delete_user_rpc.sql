-- =========================================================================
-- useAnchor Database Migration: Delete User RPC Function
-- Description: Sets up a SECURITY DEFINER function to allow users to 
--              self-delete their own authenticated account.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Retrieve the authenticated user ID of the client making the request
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: User is not authenticated.';
    END IF;

    -- Deleting from auth.users triggers cascading deletes in public tables
    -- (e.g. public.profiles, public.trusted_contacts, public.anchor_sessions)
    DELETE FROM auth.users WHERE id = v_user_id;
END;
$$;

COMMENT ON FUNCTION public.delete_user_account() IS 'Bypasses standard client limitations to allow a user to delete their own account from auth.users, cascading deletions throughout the database.';
