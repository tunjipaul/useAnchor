import { useState, useCallback } from "react";
import { supabase } from "../../../lib/supabase";
import { useAuthStore } from "../../auth/stores/useAuthStore";

export function useSession() {
  const user = useAuthStore((state) => state.user);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createAndStartSession = useCallback(async (
    sessionData: {
      title: string;
      meet_person?: string;
      meet_phone?: string;
      destination_address?: string;
      destination_lat?: number;
      destination_lng?: number;
      durationMinutes: number;
      notes?: string;
    },
    selectedContactIds: string[]
  ) => {
    if (!user) throw new Error("User not authenticated.");
    setIsLoading(true);
    setError(null);

    try {
      const now = new Date();
      const expectedEnd = new Date(now.getTime() + sessionData.durationMinutes * 60000).toISOString();

      // Step 1: Insert draft session
      const { data: session, error: insertError } = await supabase
        .from("anchor_sessions")
        .insert({
          user_id: user.id,
          title: sessionData.title,
          meet_person: sessionData.meet_person || null,
          meet_phone: sessionData.meet_phone || null,
          destination_address: sessionData.destination_address || null,
          destination_lat: sessionData.destination_lat || null,
          destination_lng: sessionData.destination_lng || null,
          expected_end: expectedEnd,
          checkin_interval_minutes: 15, // Default check-in interval for PWA MVP
          status: "draft",
          source_client: "web",
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        })
        .select()
        .single();

      if (insertError) throw insertError;
      if (!session) throw new Error("Failed to create session.");

      // Step 2: Add snapshot contacts to the session
      if (selectedContactIds.length > 0) {
        const { error: contactsError } = await supabase.rpc("add_session_contacts", {
          p_user_id: user.id,
          p_session_id: session.id,
          p_trusted_contact_ids: selectedContactIds,
        });
        if (contactsError) throw contactsError;
      }

      // Step 3: Transition status from draft to active (triggers checkin scheduler logic)
      const { error: startError } = await supabase.rpc("start_anchor_session", {
        p_user_id: user.id,
        p_session_id: session.id,
        p_current_version: session.session_version || 1,
      });
      if (startError) throw startError;

      setIsLoading(false);
      return session.id;
    } catch (err: any) {
      setIsLoading(false);
      setError(err.message || "Failed to initiate safety session.");
      throw err;
    }
  }, [user]);

  const completeSession = useCallback(async (sessionId: string, currentVersion: number) => {
    if (!user) throw new Error("User not authenticated.");
    setIsLoading(true);
    setError(null);

    try {
      const { error: completeError } = await supabase.rpc("complete_anchor_session", {
        p_user_id: user.id,
        p_session_id: sessionId,
        p_current_version: currentVersion,
      });

      if (completeError) throw completeError;
      setIsLoading(false);
    } catch (err: any) {
      setIsLoading(false);
      setError(err.message || "Failed to complete safety session.");
      throw err;
    }
  }, [user]);

  const triggerSOS = useCallback(async (
    sessionId: string,
    locationData: { lat: number | null; lng: number | null; accuracy?: number | null; address?: string | null }
  ) => {
    if (!user) throw new Error("User not authenticated.");
    setIsLoading(true);
    setError(null);

    try {
      const { data: alertId, error: sosError } = await supabase.rpc("trigger_alert", {
        p_user_id: user.id,
        p_session_id: sessionId,
        p_trigger_type: "manual_sos",
        p_lat: locationData.lat || 0.0,
        p_lng: locationData.lng || 0.0,
        p_accuracy: locationData.accuracy || 1.0,
        p_address: locationData.address || "Unknown Location",
      });

      if (sosError) throw sosError;

      // Fire-and-forget notification worker invocation
      supabase.functions.invoke('alert-notification-worker', {
        body: { limit: 25, max_retries: 3 }
      }).catch((err) => console.error('Notification worker invoke failed:', err));

      setIsLoading(false);
      return alertId;
    } catch (err: any) {
      setIsLoading(false);
      setError(err.message || "Failed to trigger SOS alert.");
      throw err;
    }
  }, [user]);

  return {
    createAndStartSession,
    completeSession,
    triggerSOS,
    isLoading,
    error,
  };
}
