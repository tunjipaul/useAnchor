import { useState, useCallback } from "react";
import { apiFetch } from "../../../lib/api";
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
      person_image_urls?: string[];
      durationMinutes: number;
      notes?: string;
      startDate?: Date;
    },
    selectedContactIds: string[]
  ) => {
    if (!user) throw new Error("User not authenticated.");
    setIsLoading(true);
    setError(null);

    try {
      const baseTime = sessionData.startDate ? sessionData.startDate.getTime() : new Date().getTime();
      const expectedEnd = new Date(baseTime + sessionData.durationMinutes * 60000).toISOString();

      // Step 1: Create session
      const session = await apiFetch<any>("/sessions", {
        method: "POST",
        body: JSON.stringify({
          title: sessionData.title,
          description: sessionData.notes || null,
          meet_person: sessionData.meet_person || "Unknown",
          meet_phone: sessionData.meet_phone || null,
          destination_address: sessionData.destination_address || null,
          person_image_urls: sessionData.person_image_urls || [],
          // Calculate a sensible check-in interval: 
          // If duration is < 15, interval = duration. Otherwise 15.
          checkin_interval_minutes: Math.min(sessionData.durationMinutes, 15),
          expected_end: expectedEnd,
        })
      });

      // Step 2: Add contacts
      if (selectedContactIds.length > 0) {
        await apiFetch(`/sessions/${session.id}/contacts`, {
          method: "POST",
          body: JSON.stringify({ contact_ids: selectedContactIds.map(id => parseInt(id)) })
        });
      }

      // Step 3: Start session
      await apiFetch(`/sessions/${session.id}/start`, {
        method: "POST",
        body: JSON.stringify({ p_session_id: session.id, p_current_version: 1 })
      });

      setIsLoading(false);
      return String(session.id);
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
      await apiFetch(`/sessions/${sessionId}/complete`, {
        method: "POST",
        body: JSON.stringify({ p_session_id: parseInt(sessionId), p_current_version: currentVersion })
      });
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
      const alert = await apiFetch<any>("/alerts/trigger", {
        method: "POST",
        body: JSON.stringify({
          p_session_id: parseInt(sessionId),
          p_trigger_type: "manual_sos",
          p_lat: locationData.lat ?? null,
          p_lng: locationData.lng ?? null,
          p_accuracy: locationData.accuracy ?? null,
          p_address: locationData.address || "Unknown Location",
        })
      });

      setIsLoading(false);
      return String(alert.id);
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
