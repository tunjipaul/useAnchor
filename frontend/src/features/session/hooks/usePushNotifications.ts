import { useEffect } from "react";
import { messaging, onMessage, requestNotificationPermission } from "../../../lib/firebase";
import { useAuthStore } from "../../auth/stores/useAuthStore";

export function usePushNotifications() {
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    if (!user || !messaging) return;

    const unsubscribe = onMessage(messaging, (payload) => {
      console.log("Foreground push notification received:", payload);
      // We could dispatch a toast here if we had a global toast system, 
      // but for now logging is sufficient per MVP
    });

    return () => {
      unsubscribe();
    };
  }, [user]);

  return { requestNotificationPermission };
}
