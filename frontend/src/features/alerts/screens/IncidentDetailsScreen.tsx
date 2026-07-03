import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  Bell, Siren, MapPin, PersonStanding, Route as RouteIcon, 
  History, Users, Phone, Navigation, CheckCircle, RefreshCw, Plus, Minus,
  Loader2
} from "lucide-react";
import DesktopSidebar from "../../../components/DesktopSidebar";
import DesktopHeader from "../../../components/DesktopHeader";
import { supabase } from "../../../lib/supabase";
import { useAuthStore } from "../../auth/stores/useAuthStore";
import { motion, AnimatePresence } from "framer-motion";

export default function IncidentDetailsScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [alert, setAlert] = useState<any | null>(null);
  const [recipients, setRecipients] = useState<any[]>([]);
  const [isResponding, setIsResponding] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const loadRecipients = async () => {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from("alert_recipients")
        .select(`
          id,
          acknowledged_at,
          is_responding,
          session_contact:session_contact_id (
            name,
            phone
          )
        `)
        .eq("alert_id", id);
      
      if (!error && data) {
        setRecipients(data);
        // If current user is one of the responding contacts, update local state
        const currentUserContact = data.find((r: any) => r.session_contact?.phone === user?.phone);
        if (currentUserContact?.is_responding) {
          setIsResponding(true);
        }
      }
    } catch (e) {
      console.error("Error loading recipients", e);
    }
  };

  const loadAlertDetails = async () => {
    if (!id) return;
    setIsRefreshing(true);
    try {
      const { data, error } = await supabase
        .from("alerts")
        .select(`
          id,
          status,
          trigger_type,
          last_known_lat,
          last_known_lng,
          last_known_address,
          created_at,
          resolved_at,
          session:session_id (
            title,
            description,
            actual_start,
            expected_end,
            created_at
          ),
          profile:user_id (
            full_name,
            avatar_url,
            phone
          )
        `)
        .eq("id", id)
        .single();

      if (error) throw error;

      if (data) {
        if (data.status !== "active") {
          navigate(`/alerts/${id}/resolved`, { replace: true });
        } else {
          setAlert({
            id: data.id,
            userId: (data as any).user_id,
            userName: (data.profile as any)?.full_name || "Unknown User",
            userAvatar: (data.profile as any)?.avatar_url || "https://via.placeholder.com/150",
            userPhone: (data.profile as any)?.phone || "",
            triggeredAt: data.created_at,
            triggerReason: data.trigger_type === "missed_checkin" ? "Missed Check-In" : "SOS Triggered",
            sessionTitle: (data.session as any)?.title || "Active Safety Session",
            actualStart: (data.session as any)?.actual_start || (data.session as any)?.created_at,
            expectedEnd: (data.session as any)?.expected_end,
            status: data.status === "active" ? "active" : "resolved",
            lastKnownLocation: {
              lat: data.last_known_lat || 0.0,
              lng: data.last_known_lng || 0.0,
              address: data.last_known_address || "Unknown Location",
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

    const alertChannel = supabase
      .channel(`alert-details-sync-${id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "alerts",
          filter: `id=eq.${id}`,
        },
        (payload: any) => {
          const updated = payload.new;
          if (updated.status !== "active") {
            navigate(`/alerts/${id}/resolved`, { replace: true });
          } else {
            setAlert((prev: any) => {
              if (!prev) return null;
              return {
                ...prev,
                status: updated.status,
                lastKnownLocation: {
                  lat: updated.last_known_lat || prev.lastKnownLocation.lat,
                  lng: updated.last_known_lng || prev.lastKnownLocation.lng,
                  address: updated.last_known_address || prev.lastKnownLocation.address,
                },
              };
            });
          }
        }
      )
      .subscribe();

    const recipientsChannel = supabase
      .channel(`alert-recipients-sync-${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "alert_recipients",
          filter: `alert_id=eq.${id}`,
        },
        () => {
          loadRecipients();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(alertChannel);
      supabase.removeChannel(recipientsChannel);
    };
  }, [id, navigate]);

  const handleRefreshLocation = () => {
    loadAlertDetails();
  };

  const handleResolve = async () => {
    if (!id || !user) return;
    setIsRefreshing(true);
    try {
      const { error } = await supabase.rpc("resolve_alert", {
        p_user_id: user.id,
        p_alert_id: id,
        p_reason: "contact_verified_safe",
        p_details: "Contact verified user safety from active monitoring dashboard.",
      });

      if (error) throw error;
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
      <section className={`relative bg-[#fde2dc] shrink-0 ${!isMobile ? "flex-1" : "h-[40vh]"}`}>
        {/* Integrated Map Placeholder */}
        <div className="absolute inset-0 w-full h-full overflow-hidden">
          <img 
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuD0J8N7tbUaqI7UCMhiBoB9iK-AjUrFha522CGSttcBi1cnXXpYl2BHpQRFWDgc5pHZ3vzqPJFRLsqINN8dDKzxWYw85K4xVOhM09mY32uR-1yqNYTUPgAmvap7SqRpl0nJ1jwDMJe4-Ry8tlxyoVVh1HRTVt6pe2dQEQ5OUyK7Vcskg7Z9Sz7YhlAIA6UXWEe9g7U9Uq9knFEhtA-5hiuM-LAkHb2ogN_PJey7FzIoH7z68mfGm2ga_AiBz51bxfmkwh9VwuWbgXQ" 
            alt="Map" 
            className="w-full h-full object-cover" 
          />
        </div>
        
        {/* Pulsing User Marker */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
          <div className="relative w-12 h-12 flex items-center justify-center">
             <div className="absolute inset-0 bg-[#ac2d00] rounded-full animate-ping opacity-40"></div>
             <div className="w-8 h-8 rounded-full border-4 border-white bg-[#ac2d00] shadow-xl flex items-center justify-center z-10">
                <PersonStanding size={16} className="text-white" />
             </div>
          </div>
        </div>

        {/* Map Controls Overlay */}
        <div className="absolute right-4 bottom-4 flex flex-col gap-2">
           {!isMobile && (
             <>
               <button className="w-12 h-12 bg-white rounded-xl shadow-md flex items-center justify-center hover:bg-[#fde2dc] text-[#5a413a]">
                 <Plus size={24} />
               </button>
               <button className="w-12 h-12 bg-white rounded-xl shadow-md flex items-center justify-center hover:bg-[#fde2dc] text-[#5a413a]">
                 <Minus size={24} />
               </button>
             </>
           )}
           <button className="w-12 h-12 bg-[#ac2d00] text-white rounded-xl shadow-md flex items-center justify-center active:scale-90">
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
                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-[#ac2d00]">
                   <img src={alert.userAvatar} alt={alert.userName} className="w-full h-full object-cover" />
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
               <div className="h-10 w-10 rounded-full overflow-hidden border-2 border-[#e2bfb5]">
                 <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuCtpiyVCgnlpOZMDnzTyZCqvqg_rks5zttWI7DbjxsWUZDOSjxdc1JOLwZzRuDtigRqGcWBxGnrLtTAoP11cBS0dQoaWcdBOYDwOVELzdL3CA8slyTiU6209lX5ESzoxFiNYtK6a4ICJgq8YqEyp4gcYSx-evzhYYUTzEltP0SJT234UI4esUNUvHQdwlFCfh_mI0-aqvQcTQo_rs_sDrkU0_VMwh5NUPvMKAY-GmTI5g0fEm0GT45kb9JazMnk76sR0N9WCm_V0RI" alt="You" className="w-full h-full object-cover" />
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
