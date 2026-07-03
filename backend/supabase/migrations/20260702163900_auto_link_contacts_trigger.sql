-- 1. Extend Profiles SELECT Policy to allow trusted circle contacts to view profile info
DROP POLICY IF EXISTS "profiles_select_contact" ON public.profiles;
CREATE POLICY "profiles_select_contact"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.session_contacts sc
            JOIN public.anchor_sessions s ON s.id = sc.session_id
            WHERE s.user_id = public.profiles.id 
              AND sc.linked_profile_id = auth.uid()
        )
    );

-- 2. Trigger function to link profiles to contacts on registration or phone update
CREATE OR REPLACE FUNCTION public.sync_profile_contacts()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.phone IS NOT NULL AND NEW.phone != '' THEN
        UPDATE public.trusted_contacts
        SET linked_profile_id = NEW.id,
            updated_at = NOW()
        WHERE phone = NEW.phone AND linked_profile_id IS NULL;

        UPDATE public.session_contacts
        SET linked_profile_id = NEW.id,
            updated_at = NOW()
        WHERE phone = NEW.phone AND linked_profile_id IS NULL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Register the trigger on auth.users where the phone column actually resides
DROP TRIGGER IF EXISTS on_auth_user_sync_contacts ON auth.users;
CREATE TRIGGER on_auth_user_sync_contacts
    AFTER INSERT OR UPDATE OF phone ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_profile_contacts();

-- 3. Trigger function to auto-link on new trusted contact insert/update
CREATE OR REPLACE FUNCTION public.auto_link_trusted_contact()
RETURNS TRIGGER AS $$
DECLARE
    v_profile_id UUID;
BEGIN
    -- Query auth.users since it stores the phone numbers
    SELECT id INTO v_profile_id 
    FROM auth.users 
    WHERE phone = NEW.phone;

    IF v_profile_id IS NOT NULL THEN
        NEW.linked_profile_id := v_profile_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_trusted_contact_insert ON public.trusted_contacts;
CREATE TRIGGER on_trusted_contact_insert
    BEFORE INSERT OR UPDATE OF phone ON public.trusted_contacts
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_link_trusted_contact();

-- 4. Trigger function to auto-link on new session contact copy/insert
CREATE OR REPLACE FUNCTION public.auto_link_session_contact()
RETURNS TRIGGER AS $$
DECLARE
    v_profile_id UUID;
BEGIN
    IF NEW.linked_profile_id IS NULL THEN
        -- Query auth.users since it stores the phone numbers
        SELECT id INTO v_profile_id 
        FROM auth.users 
        WHERE phone = NEW.phone;

        IF v_profile_id IS NOT NULL THEN
            NEW.linked_profile_id := v_profile_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_session_contact_insert ON public.session_contacts;
CREATE TRIGGER on_session_contact_insert
    BEFORE INSERT OR UPDATE OF phone ON public.session_contacts
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_link_session_contact();

-- 5. One-time data synchronization for existing records joining auth.users
UPDATE public.trusted_contacts tc
SET linked_profile_id = u.id
FROM auth.users u
WHERE tc.phone = u.phone AND tc.linked_profile_id IS NULL;

UPDATE public.session_contacts sc
SET linked_profile_id = u.id
FROM auth.users u
WHERE sc.phone = u.phone AND sc.linked_profile_id IS NULL;

-- Direct PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
