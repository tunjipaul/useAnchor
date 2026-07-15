import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  Bell, Siren, MapPin, Route as RouteIcon, 
  History, Users, Phone, Navigation, CheckCircle, RefreshCw, Plus, Minus,
  Loader2
} from "lucide-react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import DesktopSidebar from "../../../components/DesktopSidebar";
import DesktopHeader from "../../../components/DesktopHeader";
import { apiFetch } from "../../../lib/api";
import { useAuthStore } from "../../auth/stores/useAuthStore";
import { motion, AnimatePresence } from "framer-motion";

// Helper components for React Leaflet integration
function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom());
  }, [lat, lng, map]);
  return null;
}

function MapInstanceCapture({ setMap }: { setMap: (map: L.Map) => void }) {
  const map = useMap();
  useEffect(() => {
    setMap(map);
  }, [map, setMap]);
  return null;
}

export default function IncidentDetailsScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [alert, setAlert] = useState<any | null>(null);
  const [recipients, setRecipients] = useState<any[]>([]);
  const [isResponding, setIsResponding] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [map, setMap] = useState<L.Map | null>(null);

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

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const loadRecipients = async () => {
    if (!id) return;
    try {
      setRecipients([]);
    } catch (e) {
      console.error("Error loading recipients", e);
    }
  };

  const loadAlertDetails = async () => {
    if (!id) return;
    setIsRefreshing(true);
    try {
      const data = await apiFetch<any>(`/alerts/${id}`);

      if (data) {
        if (data.status !== "active") {
          navigate(`/alerts/${id}/resolved`, { replace: true });
        } else {
          setAlert({
            id: data.id,
            userId: data.profile?.id,
            userName: data.profile?.full_name || "Unknown User",
            userAvatar: data.profile?.avatar_url || "", 
            userPhone: data.profile?.phone || "",
            triggeredAt: data.triggered_at,
            triggerReason: data.trigger_type === "manual_sos" ? "SOS Triggered" : "Missed Check-In",
            sessionTitle: data.session?.title || "Active Safety Session",
            actualStart: data.session?.starts_at || data.triggered_at,
            expectedEnd: data.session?.expected_end,
            status: data.status,
            lastKnownLocation: {
              lat: data.location_lat || 0.0,
              lng: data.location_lng || 0.0,
              address: data.location_address || "Unknown Location",
            },
            batteryLevel: 82,
            signalStrength: "Strong",
          });
        }
      } else {
        navigate("/alerts");
      }
      
      await loadRecipients();
    } catch (e) {
      console.error("Error loading alert details", e);
      navigate("/alerts");
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadAlertDetails();
  }, [id]);

  // Real-time synchronization for alert coordinates & status changes
  useEffect(() => {
    if (!id) return;

    const poll = setInterval(() => {
      loadAlertDetails();
    }, 10000);

    return () => {
      clearInterval(poll);
    };
  }, [id, navigate]);

  const handleRefreshLocation = () => {
    loadAlertDetails();
  };

  const handleResolve = async () => {
    if (!id || !user) return;
    setIsRefreshing(true);
    try {
      await apiFetch(`/alerts/${id}/resolve`, {
        method: "POST",
        body: JSON.stringify({
          p_alert_id: parseInt(id),
          p_resolution_reason: "contact_verified_safe",
          p_resolution_details: "Contact verified user safety from active monitoring dashboard.",
        })
      });

      navigate(`/alerts/${id}/resolved`, { replace: true });
    } catch (e: any) {
      triggerToast(e.message || "Failed to resolve alert.");
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!alert) {
    return (
      <div className="min-h-screen bg-[#fff8f6] flex items-center justify-center">
        <Loader2 className="animate-spin text-[#ac2d00]" size={36} />
      </div>
    );
  }

  const renderContent = (isMobile: boolean) => (
    <div className={`flex flex-col h-full w-full ${!isMobile ? "lg:flex-row" : ""}`}>
      {/* Map Area */}
      <section className={`relative bg-[#fde2dc] shrink-0 ${!isMobile ? "flex-1" : "h-[40vh]"} z-0`}>
        {/* Integrated Map */}
        <div className="absolute inset-0 w-full h-full overflow-hidden">
          {alert.lastKnownLocation.lat !== 0 && alert.lastKnownLocation.lng !== 0 ? (
            <MapContainer
              center={[alert.lastKnownLocation.lat, alert.lastKnownLocation.lng]}
              zoom={15}
              zoomControl={false}
              attributionControl={false}
              className="w-full h-full"
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <Marker
                position={[alert.lastKnownLocation.lat, alert.lastKnownLocation.lng]}
                icon={customMarkerIcon}
              />
              <RecenterMap lat={alert.lastKnownLocation.lat} lng={alert.lastKnownLocation.lng} />
              <MapInstanceCapture setMap={setMap} />
            </MapContainer>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-[#fde2dc] text-[#5a413a]">
              <Loader2 className="animate-spin text-[#ac2d00] mb-2" size={28} />
              <p className="text-[14px] font-semibold animate-pulse">Waiting for GPS coordinates...</p>
            </div>
          )}
        </div>
        
        {/* Map Controls Overlay */}
        <div className="absolute right-4 bottom-4 flex flex-col gap-2 z-10">
           {!isMobile && (
             <>
               <button
                 onClick={() => map?.zoomIn()}
                 className="w-12 h-12 bg-white rounded-xl shadow-md flex items-center justify-center hover:bg-[#fde2dc] text-[#5a413a] transition-colors"
               >
                 <Plus size={24} />
               </button>
               <button
                 onClick={() => map?.zoomOut()}
                 className="w-12 h-12 bg-white rounded-xl shadow-md flex items-center justify-center hover:bg-[#fde2dc] text-[#5a413a] transition-colors"
               >
                 <Minus size={24} />
               </button>
             </>
           )}
           <button
             onClick={() => {
               if (map && alert.lastKnownLocation.lat && alert.lastKnownLocation.lng) {
                 map.setView([alert.lastKnownLocation.lat, alert.lastKnownLocation.lng], 15);
               }
             }}
             className="w-12 h-12 bg-[#ac2d00] text-white rounded-xl shadow-md flex items-center justify-center active:scale-90 transition-transform"
           >
             <MapPin size={24} />
           </button>
        </div>
      </section>

      {/* Information Side/Bottom Panel */}
      <aside className={`bg-[#fff8f6] flex flex-col z-20 ${!isMobile ? "w-[400px] border-l border-[#e2bfb5] shadow-[-4px_0_24px_rgba(26,26,24,0.05)]" : "flex-1 pb-[70px] overflow-y-auto"}`}>
        <div className={`flex-1 overflow-y-auto ${!isMobile ? "p-6 space-y-6" : "p-4 space-y-6"}`}>
          
          {/* Incident Summary */}
          <div className="p-4 bg-white border border-[#e2bfb5] rounded-xl shadow-sm">
             <div className="flex items-center gap-4">
                <div className="w-14 h-14 flex items-center justify-center rounded-full overflow-hidden border-2 border-[#ffdad6] bg-[#ffe9e4] text-[#ba1a1a] font-bold text-2xl shrink-0">
                  {alert.userName ? alert.userName.charAt(0).toUpperCase() : "U"}
                </div>
                <div className="flex-1">
                   <h3 className="text-[18px] font-semibold text-[#261814]">{alert.userName}</h3>
                   <div className="mt-1">
                      <span className="px-2 py-0.5 bg-[#ffdad6] text-[#93000a] text-[12px] font-bold rounded-full uppercase">Emergency Active</span>
                   </div>
                   <p className="text-[12px] text-[#5a413a] mt-1 font-medium">Trigger: <span className="font-bold">{alert.triggerReason}</span></p>
                </div>
             </div>
          </div>

          {/* Session Details */}
          <section className="space-y-3">
             <div className="flex items-center gap-2">
                <RouteIcon className="text-[#ac2d00]" size={20} />
                <h4 className="text-[18px] font-semibold text-[#261814]">Session Details</h4>
             </div>
             <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-[#fff1ed] rounded-lg">
                   <p className="text-[12px] text-[#5a413a] uppercase font-semibold">Activity</p>
                   <p className="text-[16px] font-bold text-[#261814] truncate">{alert.sessionTitle}</p>
                </div>
                <div className="p-3 bg-[#fff1ed] rounded-lg">
                   <p className="text-[12px] text-[#5a413a] uppercase font-semibold">ETA</p>
                   <p className="text-[16px] font-bold text-[#261814]">
                     {alert.expectedEnd ? new Date(alert.expectedEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "None"}
                   </p>
                </div>
                <div className="p-3 bg-[#fff1ed] rounded-lg col-span-2">
                   <p className="text-[12px] text-[#5a413a] uppercase font-semibold">Last Known Location</p>
                   <p className="text-[16px] font-bold text-[#261814]">{alert.lastKnownLocation.address}</p>
                </div>
             </div>
          </section>

          {/* Timeline */}
          <section className="space-y-3">
             <div className="flex items-center gap-2">
                <History className="text-[#ac2d00]" size={20} />
                <h4 className="text-[18px] font-semibold text-[#261814]">Timeline</h4>
             </div>
             <div className="relative space-y-4 pl-6 before:content-[''] before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-[#e2bfb5]">
                {alert.actualStart && (
                  <div className="relative">
                     <div className="absolute -left-[23px] top-1.5 w-[10px] h-[10px] rounded-full bg-[#8e7068]"></div>
                     <p className="text-[12px] text-[#5a413a] font-medium">
                       {new Date(alert.actualStart).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                     </p>
                     <p className="text-[16px] text-[#261814]">Session started</p>
                  </div>
                )}
                <div className="relative">
                   <div className="absolute -left-[23px] top-1.5 w-[12px] h-[12px] rounded-full bg-[#ac2d00] ring-4 ring-[#ffdad6]"></div>
                   <p className="text-[12px] text-[#ac2d00] font-bold">{new Date(alert.triggeredAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                   <p className="text-[16px] font-bold text-[#ac2d00]">{alert.triggerReason}</p>
                </div>
             </div>
          </section>

          {/* Safety Circle Status */}
          <section className="space-y-3">
             <div className="flex items-center gap-2">
                <Users className="text-[#ac2d00]" size={20} />
                <h4 className="text-[18px] font-semibold text-[#261814]">Safety Circle Status</h4>
             </div>
             <div className="space-y-2">
                {recipients.map((rec) => {
                  const contactName = rec.session_contact?.name || "Safety Contact";
                  const initials = contactName.split(" ").map((n: string) => n[0]).join("").toUpperCase().substring(0, 2);
                  const isView = rec.is_responding;
                  const isAck = !!rec.acknowledged_at;
                  
                  return (
                    <div key={rec.id} className="flex items-center justify-between p-2 border border-[#e2bfb5] rounded-lg">
                       <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#fde2dc] text-[#ac2d00] flex items-center justify-center font-bold text-[12px] uppercase">
                            {initials}
                          </div>
                          <span className="text-[16px] text-[#261814]">{contactName}</span>
                       </div>
                       {isView ? (
                         <span className="text-[12px] text-[#001e2e] bg-[#c8e6ff] px-2 py-0.5 rounded-full font-bold">Responding</span>
                       ) : isAck ? (
                         <span className="text-[12px] text-[#065f46] bg-[#d1fae5] px-2 py-0.5 rounded-full font-bold">Acknowledged</span>
                       ) : (
                         <span className="text-[12px] text-[#5a413a] font-medium opacity-60">Not Responded</span>
                       )}
                    </div>
                  );
                })}
                {recipients.length === 0 && (
                  <p className="text-[14px] text-[#5a413a] italic">No safety contacts assigned to this alert.</p>
                )}
             </div>
          </section>
        </div>

        {/* Quick Actions Bar */}
        <div className={`p-4 border-t border-[#e2bfb5] bg-white grid grid-cols-2 gap-2 shrink-0 ${!isMobile ? "pb-6" : ""}`}>
           <button 
             onClick={() => alert.userPhone && window.open(`tel:${alert.userPhone}`)}
             disabled={!alert.userPhone}
             className="flex items-center justify-center gap-2 py-3 px-2 border border-[#8e7068] text-[#261814] rounded-lg font-bold hover:bg-[#fff1ed] transition-colors active:scale-95 disabled:opacity-50"
           >
              <Phone size={20} />
              Call User
           </button>
           <button 
             onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(alert.lastKnownLocation.address)}`, '_blank')}
             className="flex items-center justify-center gap-2 py-3 px-2 border border-[#8e7068] text-[#261814] rounded-lg font-bold hover:bg-[#fff1ed] transition-colors active:scale-95"
           >
              <Navigation size={20} />
              Maps
           </button>
           
           {!isResponding ? (
             <button 
                onClick={() => setIsResponding(true)}
                className="col-span-2 flex items-center justify-center gap-2 py-4 bg-[#ac2d00] text-white rounded-lg font-bold shadow-lg hover:brightness-110 transition-all active:scale-[0.98]"
             >
                <CheckCircle size={20} />
                Mark as Responding
             </button>
           ) : (
             <button 
                onClick={handleResolve}
                className="col-span-2 flex items-center justify-center gap-2 py-4 bg-[#00628c] text-white rounded-lg font-bold shadow-lg hover:brightness-110 transition-all active:scale-[0.98]"
             >
                <CheckCircle size={20} />
                Resolve Incident
             </button>
           )}

           <button 
             onClick={handleRefreshLocation}
             className="col-span-2 flex items-center justify-center gap-2 py-2 text-[#ac2d00] font-bold text-[12px] hover:underline"
           >
              <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
              Refresh Location
           </button>
        </div>
      </aside>
    </div>
  );

  return (
    <div className="bg-[#fff8f6] text-[#261814] font-body min-h-screen flex flex-col lg:flex-row overflow-hidden">
      
      {/* Desktop Wrapper */}
      <div className="hidden lg:flex flex-col min-h-screen w-full">
        <DesktopHeader />
        <DesktopSidebar />
        <main className="ml-64 mt-16 flex-1 h-[calc(100vh-64px)] flex flex-col relative">
           {/* Desktop App Bar */}
           <header className="flex justify-between items-center px-6 py-2 w-full bg-[#fff8f6] sticky top-0 z-50 border-b border-[#e2bfb5]">
             <div className="flex items-center gap-3">
               <div className="bg-[#ac2d00] p-2 rounded-lg">
                 <Siren className="text-white" size={24} />
               </div>
               <div>
                 <h2 className="text-[22px] text-[#ac2d00] font-bold">Incident Details</h2>
                 <div className="flex items-center gap-2">
                   <span className="w-2 h-2 rounded-full bg-[#ac2d00] animate-ping"></span>
                   <span className="text-[12px] text-[#ac2d00] font-bold uppercase">Active Alert: {alert.userName}</span>
                 </div>
               </div>
             </div>
             <div className="flex items-center gap-3">
               <button className="p-2 hover:bg-[#fff1ed] rounded-full transition-colors active:scale-95 text-[#5a413a]">
                 <Bell size={24} />
               </button>
               <div className="h-10 w-10 flex items-center justify-center rounded-full overflow-hidden border-2 border-[#e2bfb5] bg-[#ffe9e4] text-[#ac2d00] font-bold text-lg">
                 {user?.full_name ? user.full_name.charAt(0).toUpperCase() : "U"}
               </div>
             </div>
           </header>
           <div className="flex-1 flex overflow-hidden">
             {renderContent(false)}
           </div>
        </main>
      </div>

      {/* Mobile Wrapper */}
      <div className="lg:hidden flex-1 flex flex-col min-h-screen relative h-[100dvh]">
         <header className="flex justify-between items-center px-4 py-3 w-full bg-[#fff8f6] sticky top-0 z-50 border-b border-[#e2bfb5]">
           <div className="text-[22px] font-bold text-[#ac2d00]">Anchor</div>
           <div className="flex gap-3">
             <Bell className="text-[#ac2d00]" size={24} />
             <Siren className="text-[#ac2d00]" size={24} />
           </div>
         </header>
         <div className="flex-1 flex flex-col overflow-hidden">
           {renderContent(true)}
         </div>
      </div>

      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-[#261814] text-[#fff8f6] px-5 py-3 rounded-xl shadow-xl flex items-center gap-2 max-w-[90%] w-[340px] text-center justify-center font-semibold text-[13px] border border-[#e2bfb5]/20"
          >
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
