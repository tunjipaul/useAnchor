-- =========================================================================
-- useAnchor Database Migration: Trusted Contacts Schema (Revised)
-- Description: Sets up the trusted contacts circles, invite statuses, 
--              notification preferences, soft deletes, and explicit RLS policies.
-- =========================================================================

-- Create ENUM types for invitation tracking and notifications preference.
-- Doing this conditionally using schema inspection to prevent compilation errors if run repeatedly.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contact_invite_status') THEN
        CREATE TYPE public.contact_invite_status AS ENUM ('pending', 'accepted', 'declined');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_preference') THEN
        CREATE TYPE public.notification_preference AS ENUM ('push', 'sms', 'both');
    END IF;
END
$$;

-- Create trusted_contacts table
CREATE TABLE IF NOT EXISTS public.trusted_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    linked_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    nickname TEXT,
    phone TEXT NOT NULL,
    relationship TEXT,
    status public.contact_invite_status NOT NULL DEFAULT 'pending',
    notification_preference public.notification_preference NOT NULL DEFAULT 'both',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    -- Prevent users from adding themselves as their own trusted contact.
    CONSTRAINT chk_not_self_contact CHECK (user_id != linked_profile_id),
    -- Validate that the phone number matches the E.164 standard (e.g. +15550000000)
    CONSTRAINT chk_phone_e164 CHECK (phone ~ '^\+[1-9]\d{1,14}$'),
    -- Prevent empty or whitespace-only contact names.
    CONSTRAINT chk_name_not_empty CHECK (char_length(trim(name)) > 0),
    -- Limit nickname to a reasonable maximum length for UI rendering safety.
    CONSTRAINT chk_nickname_length CHECK (nickname IS NULL OR char_length(nickname) <= 50)
);

-- Comments on table & columns for documentation
COMMENT ON TABLE public.trusted_contacts IS 'Manages the persistent network of trusted contacts added by users.';
COMMENT ON COLUMN public.trusted_contacts.id IS 'Primary key UUID of the contact connection card.';
COMMENT ON COLUMN public.trusted_contacts.user_id IS 'The profile ID of the user who owns this trusted contact network.';
COMMENT ON COLUMN public.trusted_contacts.linked_profile_id IS 'References public.profiles(id) once the contact registers as a useAnchor user. Distinguishes active app users from SMS-only contacts.';
COMMENT ON COLUMN public.trusted_contacts.name IS 'Real or saved name of the contact as imported or manually entered.';
COMMENT ON COLUMN public.trusted_contacts.nickname IS 'Optional nickname for personalizing how this contact is displayed (e.g., Mom ❤️).';
COMMENT ON COLUMN public.trusted_contacts.phone IS 'E.164 formatted phone number of the trusted contact.';
COMMENT ON COLUMN public.trusted_contacts.relationship IS 'Flexible relationship description (e.g., Friend, Spouse, Parent).';
COMMENT ON COLUMN public.trusted_contacts.status IS 'Current invite/linking status of this contact (pending, accepted, declined).';
COMMENT ON COLUMN public.trusted_contacts.notification_preference IS 'The contact''s choice of notification delivery channels.';
COMMENT ON COLUMN public.trusted_contacts.is_active IS 'Allows the owner to temporarily disable a contact without deleting the relationship.';
COMMENT ON COLUMN public.trusted_contacts.deleted_at IS 'Timestamp representing when this contact was soft-deleted, facilitating future auditing and recovery without losing historical session references.';

-- Idempotent Trigger Registration: Update Updated_At Timestamp
-- Reuses the shared public.handle_updated_at trigger function defined in the profiles migration.
DROP TRIGGER IF EXISTS set_trusted_contacts_updated_at ON public.trusted_contacts;
CREATE TRIGGER set_trusted_contacts_updated_at
    BEFORE UPDATE ON public.trusted_contacts
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Indexes for performance optimization on common query paths
CREATE INDEX IF NOT EXISTS idx_trusted_contacts_user_id ON public.trusted_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_trusted_contacts_linked_profile_id ON public.trusted_contacts(linked_profile_id);
CREATE INDEX IF NOT EXISTS idx_trusted_contacts_phone ON public.trusted_contacts(phone);
CREATE INDEX IF NOT EXISTS idx_trusted_contacts_status ON public.trusted_contacts(status);
CREATE INDEX IF NOT EXISTS idx_trusted_contacts_is_active ON public.trusted_contacts(is_active);

-- Composite index to optimize queries fetching active contacts for a user circle
CREATE INDEX IF NOT EXISTS idx_trusted_contacts_user_active ON public.trusted_contacts(user_id, is_active);

-- Partial Unique Index to enforce uniqueness on active (non-deleted) contacts only.
-- This allows soft-deleted records to remain in the database for session auditing histories,
-- while allowing the user to re-add the contact to their active circle without uniqueness conflicts.
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_user_id_phone 
    ON public.trusted_contacts (user_id, phone) 
    WHERE (deleted_at IS NULL);

-- Enable Row Level Security
ALTER TABLE public.trusted_contacts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Owner policies (least privilege, separate statements instead of FOR ALL):
CREATE POLICY "trusted_contacts_select_owner" 
    ON public.trusted_contacts 
    FOR SELECT 
    TO authenticated 
    USING (auth.uid() = user_id);

CREATE POLICY "trusted_contacts_insert_owner" 
    ON public.trusted_contacts 
    FOR INSERT 
    TO authenticated 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "trusted_contacts_update_owner" 
    ON public.trusted_contacts 
    FOR UPDATE 
    TO authenticated 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "trusted_contacts_delete_owner" 
    ON public.trusted_contacts 
    FOR DELETE 
    TO authenticated 
    USING (auth.uid() = user_id);

-- Contact policies (least privilege, relying strictly on linked_profile_id matching auth.uid()):
-- Allows a registered trusted contact to view the card they are associated with.
CREATE POLICY "trusted_contacts_select_contact" 
    ON public.trusted_contacts 
    FOR SELECT 
    TO authenticated 
    USING (linked_profile_id = auth.uid());

-- Note on Future Synchronization Workflow:
-- Contacts initially exist as SMS-only records (linked_profile_id = NULL). When a person with 
-- a matching phone number signs up to useAnchor, a background process (such as a database trigger 
-- on public.profiles or an Edge Function) will automatically search for matching phone numbers in 
-- trusted_contacts and update linked_profile_id with their profile UUID. This transitions the 
-- relationship from SMS-only to in-app notification compatibility seamlessly.

-- Note on Invitation Acceptance / Status Updates:
-- Column-level updates by the contact (accepting/declining an invite) are intentionally 
-- NOT implemented directly via RLS policies. RLS does not natively support column-level constraints 
-- on UPDATE operations, and emulating this through WITH CHECK has edge cases that reduce auditability.
-- Instead, status modifications will be performed through a secure backend service (such as 
-- Supabase RPC or Edge Functions) that enforces state-machine transition rules and writes to the DB.
