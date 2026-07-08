import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { MapPin, Shield, AlertTriangle, ArrowLeft, Loader2 } from "lucide-react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import { supabase } from "../../../lib/supabase";
import { useAuthStore } from "../../auth/stores/useAuthStore";

// Component to dynamically pan the map on coordinates updates
function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom());
  }, [lat, lng, map]);
  return null;
}

export default function LiveLocationScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const alertId = searchParams.get("id");
  const user = useAuthStore((state) => state.user);

  const [alertData, setAlertData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const customMarkerIcon = useMemo(() => {
    return L.divIcon({
      html: `<div class="relative w-12 h-12 flex items-center justify-center">
               <div class="absolute inset-0 bg-[#ac2d00] rounded-full animate-ping opacity-35" style="animation-duration: 2s;"></div>
               <div class="absolute w-8 h-8 bg-[#ac2d00]/25 rounded-full"></div>
               <div class="w-7 h-7 rounded-full border-4 border-white bg-[#ac2d00] shadow-2xl flex items-center justify-center z-10">
                  <svg class="text-white" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="5" r="1" />
                    <path d="m9 20 3-6 3 6" />
                    <path d="m6 8 6 2 6-2" />
                    <path d="M12 10v4" />
                  </svg>
               </div>
            </div>`,
      className: "bg-transparent border-none",
      iconSize: [48, 48],
      iconAnchor: [24, 24],
    });
  }, []);

  const fetchLiveLocation = async () => {
    if (!alertId) {
      setError("Missing alert identifier.");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from("alerts")
        .select(`
          id,
          status,
          trigger_type,
          location_lat,
          location_lng,
          location_address,
          created_at,
          profiles:user_id (
            full_name,
            avatar_url
          )
        `)
        .eq("id", alertId)
        .single();

      if (fetchError) throw fetchError;

      if (data) {
        setAlertData({
          ...data,
          last_known_lat: data.location_lat,
          last_known_lng: data.location_lng,
          last_known_address: data.location_address,
          profile: data.profiles,
        });
      } else {
        setError("Alert incident not found.");
      }
    } catch (err: any) {
      console.error("Error fetching live location", err);
      setError(
        err.message?.includes("Row-Level Security") || err.message?.includes("JWT")
          ? "Access denied. You must be signed in as a trusted contact to view this live map."
          : "Failed to load live tracking coordinates."
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveLocation();
  }, [alertId, user]);

  // Subscribe to Live Coordinates changes in Realtime
  useEffect(() => {
    if (!alertId) return;

    const channel = supabase
      .channel(`live-location-sync-${alertId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "alerts",
          filter: `id=eq.${alertId}`,
        },
        (payload: any) => {
          const updated = payload.new;
          setAlertData((prev: any) => {
            if (!prev) return null;
            return {
              ...prev,
              status: updated.status,
              last_known_lat: updated.location_lat,
              last_known_lng: updated.location_lng,
              last_known_address: updated.location_address || prev.last_known_address,
            };
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [alertId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#fff8f6] flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-[#ac2d00]" size={36} />
        <p className="text-[14px] text-[#5a413a] font-medium animate-pulse">Initializing Live Map Feed...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#fff8f6] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-[#ffdad6] text-[#ba1a1a] flex items-center justify-center mb-6">
          <AlertTriangle size={32} />
        </div>
        <h1 className="text-[22px] font-bold text-[#261814] mb-2">Tracking Interrupted</h1>
        <p className="text-[15px] text-[#5a413a] max-w-sm mb-8">{error}</p>
        <button
          onClick={() => navigate("/dashboard")}
          className="h-12 px-6 bg-[#ac2d00] text-white font-bold rounded-lg active:scale-95 transition-transform"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  if (!alertData) return null;

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#fde2dc] text-[#261814] flex flex-col">
      {/* Floating Header */}
      <header className="absolute top-4 left-4 right-4 z-50 bg-white/90 backdrop-blur-md shadow-lg border border-[#e2bfb5]/50 rounded-2xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#ffe9e4] active:scale-95 transition-all text-[#ac2d00]"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-[#ac2d00]">
              <img
                src={alertData.profile?.avatar_url || "https://via.placeholder.com/150"}
                alt={alertData.profile?.full_name || "User avatar"}
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <h2 className="text-[15px] font-bold leading-tight">{alertData.profile?.full_name || "Unknown User"}</h2>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#ac2d00] uppercase tracking-wider">
                <span className="w-2 h-2 bg-[#ac2d00] rounded-full animate-ping" />
                <span>Live SOS Dispatch</span>
              </div>
            </div>
          </div>
        </div>
        <div className="px-3 py-1.5 bg-[#ffdad6] text-[#ba1a1a] border border-[#ffb4ab] text-[12px] font-bold rounded-full flex items-center gap-1">
          <Shield size={14} />
          <span>Active Incident</span>
        </div>
      </header>

      {/* Full-Screen Map Visualization */}
      <div className="absolute inset-0 w-full h-full z-0">
        {typeof alertData.last_known_lat === "number" && typeof alertData.last_known_lng === "number" ? (
          <MapContainer
            center={[alertData.last_known_lat, alertData.last_known_lng]}
            zoom={15}
            zoomControl={false}
            attributionControl={false}
            className="w-full h-full"
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker
              position={[alertData.last_known_lat, alertData.last_known_lng]}
              icon={customMarkerIcon}
            />
            <RecenterMap lat={alertData.last_known_lat} lng={alertData.last_known_lng} />
          </MapContainer>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-[#fde2dc] text-[#5a413a]">
            <Loader2 className="animate-spin text-[#ac2d00] mb-2" size={28} />
            <p className="text-[14px] font-semibold animate-pulse">Waiting for GPS coordinates...</p>
          </div>
        )}
      </div>

      {/* Floating Bottom Metadata Card */}
      <footer className="absolute bottom-6 left-4 right-4 z-40 bg-white/95 backdrop-blur-md shadow-xl border border-[#e2bfb5] rounded-2xl p-5 space-y-3">
        <div className="flex items-start gap-2.5">
          <MapPin size={20} className="text-[#ac2d00] shrink-0 mt-0.5" />
          <div className="space-y-0.5 text-left">
            <span className="text-[11px] font-bold tracking-widest text-[#5a413a] uppercase block">Last Known Coordinates</span>
            <p className="text-[14px] font-semibold leading-tight text-[#261814]">{alertData.last_known_address || "Determining address..."}</p>
            <span className="text-[11px] text-[#8e7068] block">
              Lat: {alertData.last_known_lat?.toFixed(6) || "0.000000"}, Lng: {alertData.last_known_lng?.toFixed(6) || "0.000000"}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
