import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useAuthStore } from '../features/auth/stores/useAuthStore';
import { toast } from 'react-hot-toast';

interface WebSocketContextType {
  isConnected: boolean;
  lastMessage: any | null;
}

const WebSocketContext = createContext<WebSocketContextType>({
  isConnected: false,
  lastMessage: null,
});

export const useWebSocket = () => useContext(WebSocketContext);

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<any | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // We subscribe directly to the store so we get the token reactively
    const unsubscribe = useAuthStore.subscribe((state) => {
      const token = state.session?.access_token;

      // If no token but we have a connection, close it
      if (!token) {
        if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
          setIsConnected(false);
        }
        return;
      }

      // If we already have an active connection, don't recreate it unnecessarily
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        return;
      }

      // Connect WebSocket
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsHost = import.meta.env.VITE_API_URL ? new URL(import.meta.env.VITE_API_URL).host : 'localhost:8000';
      const wsUrl = `${protocol}//${wsHost}/api/ws/alerts?token=${token}`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("Global WebSocket connected");
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastMessage(data);

          // Trigger global toast notifications
          if (data.type === "NEW_ALERT") {
            toast((t) => (
              <div className="flex items-center justify-between w-full gap-4">
                <span className="flex items-center gap-2">🚨 Emergency SOS Triggered!</span>
                <button 
                  onClick={() => toast.dismiss(t.id)} 
                  className="text-white/80 hover:text-white font-bold text-xl leading-none px-1"
                >
                  ×
                </button>
              </div>
            ), {
              duration: Infinity,
              style: {
                background: '#ba1a1a',
                color: '#ffffff',
                fontWeight: 'bold',
                padding: '16px',
                minWidth: '300px'
              }
            });
          } else if (data.type === "SESSION_STARTED") {
            const userName = data.session?.user_name || "A friend";
            toast((t) => (
              <div className="flex items-center justify-between w-full gap-4">
                <span className="flex items-center gap-2">📍 {userName} started a safety session</span>
                <button 
                  onClick={() => toast.dismiss(t.id)} 
                  className="text-white/80 hover:text-white font-bold text-xl leading-none px-1"
                >
                  ×
                </button>
              </div>
            ), {
              duration: Infinity,
              style: {
                background: '#ac2d00',
                color: '#ffffff',
                fontWeight: 'bold',
                padding: '16px',
                minWidth: '300px'
              }
            });
          }
        } catch (err) {
          console.error("Failed to parse WS message", err);
        }
      };

      ws.onerror = (error) => {
        console.error("Global WebSocket Error:", error);
      };

      ws.onclose = () => {
        console.log("Global WebSocket disconnected");
        setIsConnected(false);
        wsRef.current = null;
      };
    });

    // Also call immediately to handle initial state
    useAuthStore.getState();

    return () => {
      unsubscribe();
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return (
    <WebSocketContext.Provider value={{ isConnected, lastMessage }}>
      {children}
    </WebSocketContext.Provider>
  );
};
