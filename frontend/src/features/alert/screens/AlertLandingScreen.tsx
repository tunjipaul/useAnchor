import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { 
  AlertTriangle, Phone, Navigation, 
  MapPin, Route as RouteIcon, Info, Loader2
} from "lucide-react";
import { supabase } from "../../../lib/supabase";

export default function AlertLandingScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const alertId = searchParams.get("id");

  const [alertData, setAlertData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAlert() {
      if (!alertId) {
        setError("Missing alert identifier. Please check your link.");
        setIsLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from("alerts")
          .select(`
            id,
            status,
            trigger_type,
            created_at,
            location_lat,
            location_lng,
            location_address,
            session:anchor_sessions!session_id (
              title,
              meet_person,
              destination_address,
              description
            ),
            profiles:profiles!user_id (
              full_name,
              avatar_url
            )
          `)
          .eq("id", alertId)
          .single();

        if (fetchError) throw fetchError;

        if (data) {
          setAlertData({
            id: data.id,
            status: data.status,
            triggeredAt: data.created_at,
            triggerReason: data.trigger_type === "missed_checkin" ? "Missed Check-In" : "SOS Triggered",
            session: data.session,
            profile: data.profiles,
            location: {
              lat: data.location_lat,
              lng: data.location_lng,
              address: data.location_address
            }
          });
        } else {
          setError("Incident not found or no longer available.");
        }
      } catch (err: any) {
        console.error("Failed to load alert", err);
        setError("Failed to load alert information. It may have been resolved or deleted.");
      } finally {
        setIsLoading(false);
      }
    }

    loadAlert();
  }, [alertId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#fff8f6] flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-[#ac2d00]" size={36} />
        <p className="text-[14px] text-[#5a413a] font-medium animate-pulse">Loading emergency details...</p>
      </div>
    );
  }

  if (error || !alertData) {
    return (
      <div className="min-h-screen bg-[#fff8f6] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-[#ffdad6] text-[#ba1a1a] flex items-center justify-center mb-6">
          <AlertTriangle size={32} />
        </div>
        <h1 className="text-[22px] font-bold text-[#261814] mb-2">Alert Unavailable</h1>
        <p className="text-[15px] text-[#5a413a] max-w-sm mb-8">{error}</p>
      </div>
    );
  }

  const isResolved = alertData.status !== "active";

  return (
    <div className="min-h-screen bg-[#fff8f6] text-[#261814] font-body flex flex-col">
      <main className="flex-1 max-w-lg mx-auto w-full p-4 flex flex-col">
        {/* Urgent Header */}
        <div className={`p-5 rounded-2xl mb-6 shadow-sm ${isResolved ? "bg-[#fff1ed] border border-[#e2bfb5]" : "bg-[#ba1a1a] text-white"}`}>
          <div className="flex items-start gap-4">
            <div className={`w-14 h-14 rounded-full overflow-hidden shrink-0 border-2 ${isResolved ? "border-[#ac2d00]" : "border-[#ffdad6]"}`}>
              <img src={alertData.profile?.avatar_url || "https://via.placeholder.com/150"} alt="Avatar" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                {isResolved ? null : <AlertTriangle size={18} className="animate-pulse" />}
                <h1 className="text-[20px] font-bold leading-tight">
                  {isResolved ? `${alertData.profile?.full_name} is Safe` : `${alertData.profile?.full_name} needs help`}
                </h1>
              </div>
              <p className={`text-[13px] ${isResolved ? "text-[#5a413a]" : "text-[#ffdad6]"}`}>
                {isResolved ? "This emergency incident has been resolved." : `Triggered by ${alertData.triggerReason}`}
              </p>
              {!isResolved && (
                <div className="mt-2 inline-block px-2 py-0.5 bg-[#ffdad6] text-[#ba1a1a] text-[11px] font-bold rounded-full uppercase tracking-widest">
                  Active Emergency
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Location Card */}
        <div className="bg-white border border-[#e2bfb5] rounded-xl overflow-hidden shadow-sm mb-4">
          <div className="p-4 border-b border-[#e2bfb5] bg-[#fff1ed] flex items-center justify-between">
            <div className="flex items-center gap-2 text-[#261814] font-bold">
              <MapPin size={18} className="text-[#ac2d00]" />
              <h3>Last Known Location</h3>
            </div>
            <span className="text-[12px] text-[#5a413a] font-medium">
              {new Date(alertData.triggeredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          
          <div className="p-4 flex flex-col gap-4">
            <p className="text-[15px] font-medium">{alertData.location?.address || "Unknown Location"}</p>
            
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => navigate(`/alert/live?id=${alertId}`)}
                className="py-3 bg-[#fff1ed] hover:bg-[#fde2dc] text-[#ac2d00] font-bold rounded-lg flex items-center justify-center gap-2 transition-colors border border-[#e2bfb5]"
              >
                <Navigation size={18} />
                Live Map
              </button>
              <button 
                onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(alertData.location?.address || "")}`, '_blank')}
                className="py-3 bg-white hover:bg-gray-50 text-[#261814] font-bold rounded-lg flex items-center justify-center gap-2 transition-colors border border-[#e2bfb5]"
              >
                <RouteIcon size={18} />
                Directions
              </button>
            </div>
          </div>
        </div>

        {/* Session Details */}
        <div className="bg-white border border-[#e2bfb5] rounded-xl overflow-hidden shadow-sm mb-6">
          <div className="p-4 border-b border-[#e2bfb5] bg-[#fff1ed] flex items-center gap-2 text-[#261814] font-bold">
            <Info size={18} className="text-[#ac2d00]" />
            <h3>Session Context</h3>
          </div>
          
          <div className="divide-y divide-[#e2bfb5]/50">
            <div className="p-4 flex flex-col gap-1">
              <span className="text-[12px] uppercase font-bold text-[#5a413a] tracking-wider">Activity</span>
              <span className="text-[15px]">{alertData.session?.title || "Unknown Session"}</span>
            </div>
            
            {alertData.session?.meet_person && (
              <div className="p-4 flex flex-col gap-1">
                <span className="text-[12px] uppercase font-bold text-[#5a413a] tracking-wider">Meeting With</span>
                <span className="text-[15px]">{alertData.session.meet_person}</span>
              </div>
            )}
            
            {alertData.session?.destination_address && (
              <div className="p-4 flex flex-col gap-1">
                <span className="text-[12px] uppercase font-bold text-[#5a413a] tracking-wider">Intended Destination</span>
                <span className="text-[15px]">{alertData.session.destination_address}</span>
              </div>
            )}

            {alertData.session?.notes && (
              <div className="p-4 flex flex-col gap-1">
                <span className="text-[12px] uppercase font-bold text-[#5a413a] tracking-wider">Notes</span>
                <span className="text-[14px] text-[#5a413a] bg-[#fff8f6] p-3 rounded-lg border border-[#e2bfb5]/50 italic">
                  "{alertData.session.notes}"
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Call Action */}
        {alertData.profile?.phone && (
          <button 
            onClick={() => window.open(`tel:${alertData.profile.phone}`)}
            className="mt-auto w-full h-14 bg-[#261814] hover:bg-[#000000] text-white font-bold text-[16px] rounded-xl flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform"
          >
            <Phone size={20} />
            Call {alertData.profile.full_name?.split(" ")[0]}
          </button>
        )}
      </main>
    </div>
  );
}
