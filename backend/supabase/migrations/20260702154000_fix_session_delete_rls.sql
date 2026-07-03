-- Drop and recreate sessions_select_owner policy to allow owners to SELECT their own sessions even after soft delete
DROP POLICY IF EXISTS "sessions_select_owner" ON public.anchor_sessions;
CREATE POLICY "sessions_select_owner" 
    ON public.anchor_sessions 
    FOR SELECT 
    TO authenticated 
    USING (auth.uid() = user_id);

-- Direct PostgREST to refresh its schema cache
NOTIFY pgrst, 'reload schema';
