import { useEffect } from "react";
import { useAuthStore } from "../features/auth/stores/useAuthStore";
import { toast } from "react-hot-toast";

export default function GlobalWebSocket() {
  const token = useAuthStore((state) => state.session?.access_token);

  useEffect(() => {
    if (!token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = import.meta.env.VITE_API_URL ? new URL(import.meta.env.VITE_API_URL).host : 'localhost:8000';
    const wsUrl = `${protocol}//${wsHost}/api/ws/alerts?token=${token}`;
    
    let ws: WebSocket | null = null;
    let reconnectTimer: any = null;

    const connect = () => {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("Global WS connected");
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "NEW_ALERT") {
            const alertInfo = data.alert;
            
            // Dispatch a custom event so other components can refresh their data
            window.dispatchEvent(new CustomEvent("useanchor_new_alert", { detail: data }));
          }
        } catch (err) {
          console.error("Failed to parse WS message", err);
        }
      };

      ws.onerror = (error) => {
        console.error("Global WebSocket Error:", error);
      };

      ws.onclose = () => {
        console.log("Global WS closed, attempting reconnect...");
        reconnectTimer = setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) {
        ws.onclose = null; // Prevent reconnect on unmount
        ws.close();
      }
    };
  }, [token]);

  return null;
}
