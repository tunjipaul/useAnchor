-- 1. Create helper function to check session contact membership bypassing RLS (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.is_session_contact(session_id uuid, profile_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.session_contacts
    WHERE session_id = $1 AND linked_profile_id = $2
  );
$$;

-- 2. Drop and Recreate Select Policy on public.anchor_sessions
DROP POLICY IF EXISTS "sessions_select_contact" ON public.anchor_sessions;
CREATE POLICY "sessions_select_contact"
    ON public.anchor_sessions
    FOR SELECT
    TO authenticated
    USING (
        status = 'emergency'
        AND public.is_session_contact(id, auth.uid())
    );

-- 3. Drop and Recreate Select Policy on public.session_contacts
DROP POLICY IF EXISTS "session_contacts_select_contact" ON public.session_contacts;
CREATE POLICY "session_contacts_select_contact" 
    ON public.session_contacts 
    FOR SELECT 
    TO authenticated 
    USING (
        linked_profile_id = auth.uid()
        OR 
        public.is_session_contact(session_id, auth.uid())
    );

-- 4. Drop and Recreate Select Policy on public.checkins
DROP POLICY IF EXISTS "checkins_select_contact" ON public.checkins;
CREATE POLICY "checkins_select_contact" 
    ON public.checkins 
    FOR SELECT 
    TO authenticated 
    USING (
        EXISTS (
            SELECT 1 
            FROM public.anchor_sessions s
            WHERE s.id = checkins.session_id 
              AND s.status = 'emergency'
        )
        AND public.is_session_contact(session_id, auth.uid())
    );

-- 5. Drop and Recreate Select Policy on public.alerts
DROP POLICY IF EXISTS "alerts_select_contact" ON public.alerts;
CREATE POLICY "alerts_select_contact" 
    ON public.alerts 
    FOR SELECT 
    TO authenticated 
    USING (
        public.is_session_contact(session_id, auth.uid())
    );

-- 6. Drop and Recreate Select Policy on public.alert_recipients
DROP POLICY IF EXISTS "alert_recipients_select" ON public.alert_recipients;
CREATE POLICY "alert_recipients_select" 
    ON public.alert_recipients 
    FOR SELECT 
    TO authenticated 
    USING (
        EXISTS (
            SELECT 1 
            FROM public.alerts a 
            WHERE a.id = alert_recipients.alert_id 
              AND (
                  a.user_id = auth.uid()
                  OR public.is_session_contact(a.session_id, auth.uid())
              )
        )
    );
