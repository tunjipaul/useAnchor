-- =========================================================================
-- useAnchor Database Migration: Profiles Schema
-- Description: Sets up the initial user profiles database structure,
--              reusable utilities, and automatic user synchronizations.
--
-- TODO (Architectural Note):
-- In future scaling phases, global utilities (like the updated_at trigger helper),
-- shared helper functions, and global custom ENUM types will be centralized 
-- into an early dedicated migrations utility layer. For now, the core base 
-- helpers are initialized here.
-- =========================================================================

-- Create utility function for updating updated_at timestamp.
-- This is a generic, reusable trigger function intended to be applied to 
-- any table containing an 'updated_at' column to automate timestamp management.
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    avatar_url TEXT,
    onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Comments on table & columns for self-documentation
COMMENT ON TABLE public.profiles IS 'Stores user profile details tied directly to their auth account. Authentication details (like phone number) reside in auth.users.';
COMMENT ON COLUMN public.profiles.id IS 'References the auth.users primary key UUID.';
COMMENT ON COLUMN public.profiles.full_name IS 'The full name of the user. Left nullable initially during signup.';
COMMENT ON COLUMN public.profiles.avatar_url IS 'URL of the profile avatar image hosted in Supabase storage.';
COMMENT ON COLUMN public.profiles.onboarding_completed IS 'Flag indicating whether the user completed the onboarding flow.';

-- Idempotent Trigger Registration: Update Updated_At Timestamp
-- Fires automatically BEFORE an UPDATE operation executes on any row in the profiles table.
-- Ensures 'updated_at' is updated to the current database transaction timestamp (now()).
DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Auto-sync function on user signup
-- Creates a matching public profile row when a new record is added to auth.users.
-- Security Definer: Runs with security definer bypass permissions to allow writes
-- to the public schema from the auth schema trigger context.
-- Search Path: Explicitly locked to public to prevent search_path hijacking.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Inserts the new profile. Nullifies empty text strings ('') from metadata
    -- to maintain consistent NULL values for unset optional attributes.
    INSERT INTO public.profiles (id, full_name, avatar_url)
    VALUES (
        NEW.id,
        NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
        NULLIF(NEW.raw_user_meta_data->>'avatar_url', '')
    )
    -- Conflict Resolution Strategy:
    -- If a profile row with the same UUID already exists, we resolve the conflict by:
    -- 1. Using COALESCE to keep the existing profile data (profiles.full_name / avatar_url)
    --    if it is already populated, preventing trigger recalculations (e.g. on re-login) 
    --    from overwriting verified user modifications.
    -- 2. Falling back to the incoming EXCLUDED metadata if the current fields are NULL.
    ON CONFLICT (id) DO UPDATE
    SET full_name = COALESCE(profiles.full_name, EXCLUDED.full_name),
        avatar_url = COALESCE(profiles.avatar_url, EXCLUDED.avatar_url);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Idempotent Trigger Registration: Auto-Create Profile
-- Fires automatically AFTER an INSERT operation completes on the auth.users table.
-- Ensures every new user registered via Supabase Auth has a corresponding public profile row.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- SELECT: Users can only read their own profile row.
-- No public read access is enabled. When trusted contacts require access later, we will extend this or handle it securely.
CREATE POLICY "profiles_select_own" 
    ON public.profiles 
    FOR SELECT 
    TO authenticated 
    USING (auth.uid() = id);

-- UPDATE: Users can only edit their own profile details.
CREATE POLICY "profiles_update_own" 
    ON public.profiles 
    FOR UPDATE 
    TO authenticated 
    USING (auth.uid() = id) 
    WITH CHECK (auth.uid() = id);

-- Note on Policies:
-- 1. No INSERT policy is created because profiles are exclusively auto-generated via 
--    the auth.users trigger 'on_auth_user_created' which runs with bypass RLS system permissions.
-- 2. No DELETE policy is created because deleting a profile is cascadingly handled by deleting 
--    the parent auth.users record.
