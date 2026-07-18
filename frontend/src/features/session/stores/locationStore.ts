import { create } from "zustand";

interface CachedLocation {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
}

interface LocationState {
  cachedLocation: CachedLocation | null;
  isTracking: boolean;
  watchId: number | null;
  error: string | null;
  startTracking: () => void;
  stopTracking: () => void;
  getLocation: () => CachedLocation | null;
  getFreshLocation: (timeoutMs?: number) => Promise<CachedLocation | null>;
}

export const useLocationStore = create<LocationState>((set, get) => ({
  cachedLocation: null,
  isTracking: false,
  watchId: null,
  error: null,

  startTracking: () => {
    // Don't start a second watcher if one is already running
    if (get().isTracking) return;

    if (!navigator.geolocation) {
      set({ error: "Geolocation is not supported by this browser." });
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        set({
          cachedLocation: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
          },
          error: null,
        });
      },
      (err) => {
        console.error("GPS tracking error:", err);
        set({ error: err.message });
      },
      {
        enableHighAccuracy: true,
        maximumAge: 30000,
        timeout: 15000,
      }
    );

    set({ watchId, isTracking: true });
  },

  stopTracking: () => {
    const { watchId } = get();
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
    }
    set({ watchId: null, isTracking: false });
  },

  getLocation: () => {
    return get().cachedLocation;
  },

  getFreshLocation: (timeoutMs = 10000) => {
    if (!navigator.geolocation) {
      set({ error: "Geolocation is not supported by this browser." });
      return Promise.resolve(get().cachedLocation);
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const freshLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
          };
          set({ cachedLocation: freshLocation, error: null });
          resolve(freshLocation);
        },
        (err) => {
          console.error("GPS lookup error:", err);
          set({ error: err.message });
          resolve(get().cachedLocation);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 30000,
          timeout: timeoutMs,
        }
      );
    });
  },
}));
