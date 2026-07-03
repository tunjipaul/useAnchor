import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  MapPin,
  User,
  Clock,
  CheckCircle,
  Siren,
  X,
  ArrowLeft,
  AlertTriangle,
  LogOut,
  Loader2,
} from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { useAuthStore } from "../../auth/stores/useAuthStore";
import { useSession } from "../hooks/useSession";

export default function ActiveSessionScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("id");
  const user = useAuthStore((state) => state.user);
  const { triggerSOS, completeSession } = useSession();

  const [session, setSession] = useState<any | null>(null);
  const [timeLeft, setTimeLeft] = useState(30 * 60);
  const [isLoading, setIsLoading] = useState(false);
  const [_errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };
  
  // Modals state
  const [showCheckInPrompt, setShowCheckInPrompt] = useState(false);
  const [showEndSessionPrompt, setShowEndSessionPrompt] = useState(false);
  const [showExtendPrompt, setShowExtendPrompt] = useState(false);
  const [gracePeriodSeconds, setGracePeriodSeconds] = useState(1 * 60);

  // Load session details from Supabase
  const loadActiveSession = async () => {
    if (!user) return;
    setIsLoading(true);
    setErrorMsg(null);
    
    try {
      let query = supabase
        .from("anchor_sessions")
        .select(`
          id,
          title,
          meet_person,
          meet_phone,
          destination_address,
          destination_lat,
          destination_lng,
          expected_end,
          actual_start,
          checkin_interval_minutes,
          description,
          status,
          session_version,
          created_at,
          session_contacts (
            id,
            name,
            phone
          )
        `)
        .eq("user_id", user.id)
        .is("deleted_at", null);
        
      if (sessionId) {
        query = query.eq("id", sessionId);
      } else {
        query = query.eq("status", "active");
      }
      
      const { data, error } = await query
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
        
      if (error) throw error;
      
      if (data) {
        setSession({
          id: data.id,
          title: data.title,
          personName: data.meet_person || "Unknown",
          phone: data.meet_phone || "",
          location: data.destination_address || "Unknown Location",
          date: new Date(data.created_at).toISOString().split("T")[0],
          time: new Date(data.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          durationMinutes: data.checkin_interval_minutes || 30,
          notes: data.description || "",
          contacts: data.session_contacts || [],
          startedAt: data.actual_start || data.created_at,
          status: data.status,
          version: data.session_version,
          checkIns: [],
        });
        
        // Calculate remaining time until expected_end
        const end = new Date(data.expected_end).getTime();
        const now = Date.now();
        setTimeLeft(Math.max(0, Math.floor((end - now) / 1000)));
      } else {
        // No active session found, redirect back
        navigate("/dashboard");
      }
    } catch (e: any) {
      console.error("Error loading active safety session", e);
      setErrorMsg(e.message || "Failed to load active safety session.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadActiveSession();
  }, [user, sessionId]);

  // Real-time synchronization for safety session status changes
  useEffect(() => {
    if (!session?.id) return;

    const sessionChannel = supabase
      .channel(`session-status-${session.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "anchor_sessions",
          filter: `id=eq.${session.id}`,
        },
        (payload: any) => {
          const updated = payload.new;
          
          if (updated.status === "emergency" || updated.status === "sos") {
            navigate("/session/sos");
          } else if (updated.status === "completed") {
            navigate("/session/summary", { 
              state: { 
                session: { 
                  ...session, 
                  status: "completed", 
                  endedAt: updated.actual_end 
                } 
              } 
            });
          } else {
            setSession((prev: any) => {
              if (!prev) return null;
              return {
                ...prev,
                status: updated.status,
                version: updated.session_version,
                durationMinutes: updated.checkin_interval_minutes,
              };
            });
            const end = new Date(updated.expected_end).getTime();
            setTimeLeft(Math.max(0, Math.floor((end - Date.now()) / 1000)));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sessionChannel);
    };
  }, [session?.id, navigate]);

  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  // Trigger check-in prompt when timeLeft hits 0
  useEffect(() => {
    if (timeLeft === 0 && !showCheckInPrompt && session?.status === 'active') {
      setShowCheckInPrompt(true);
      setGracePeriodSeconds(1 * 60); // 1 minute grace
    }
  }, [timeLeft, showCheckInPrompt, session]);

  // Grace period countdown & SOS trigger
  useEffect(() => {
    if (!showCheckInPrompt) return;
    if (gracePeriodSeconds <= 0) {
      handleTriggerSOS('Missed Check-In');
      return;
    }
    const timer = setInterval(() => {
      setGracePeriodSeconds((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [showCheckInPrompt, gracePeriodSeconds]);

  function formatDuration(totalSeconds: number) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  async function handleSafeCheckIn() {
    if (!session || !user) return;
    setIsLoading(true);
    try {
      // Find the next scheduled or pending check-in in the database
      const { data: checkin, error: checkinError } = await supabase
        .from("checkins")
        .select("id")
        .eq("session_id", session.id)
        .in("status", ["scheduled", "pending"])
        .order("expected_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (checkinError) throw checkinError;

      if (checkin) {
        const { error: markError } = await supabase.rpc("mark_checkin_completed", {
          p_user_id: user.id,
          p_checkin_id: checkin.id,
          p_method: "web",
          p_lat: session.lastKnownLat || 0.0,
          p_lng: session.lastKnownLng || 0.0,
        });
        if (markError) throw markError;
      }

      // Reset timer to original duration
      const duration = (session.durationMinutes || 30) * 60;
      setTimeLeft(duration);
      setShowCheckInPrompt(false);

      // Refresh session state to sync with database updates
      await loadActiveSession();
    } catch (e: any) {
      triggerToast(e.message || "Failed to confirm safety check-in.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleEndSessionConfirm() {
    if (!session || !user) return;
    setIsLoading(true);
    setErrorMsg(null);

    try {
      await completeSession(session.id, session.version);
      
      // Navigate to summary screen
      navigate("/session/summary", { 
        state: { 
          session: { 
            ...session, 
            status: "completed", 
            endedAt: new Date().toISOString() 
          } 
        } 
      });
    } catch (e: any) {
      triggerToast(e.message || "Failed to end safety session.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleExtend(minutes: number = 15) {
    if (!session || !user) return;
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const currentExpectedEnd = new Date(session.startedAt).getTime() + (session.durationMinutes + minutes) * 60000;
      const newExpectedEnd = new Date(currentExpectedEnd).toISOString();

      const { error: extendError } = await supabase
        .from("anchor_sessions")
        .update({
          expected_end: newExpectedEnd,
          session_version: session.version + 1,
        })
        .eq("id", session.id)
        .eq("session_version", session.version);

      if (extendError) throw extendError;

      setTimeLeft(Math.max(0, Math.floor((currentExpectedEnd - Date.now()) / 1000)));
      setShowExtendPrompt(false);
      setShowCheckInPrompt(false);
      
      await loadActiveSession();
    } catch (e: any) {
      triggerToast(e.message || "Failed to extend session.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleTriggerSOS(_reason: string = 'SOS Button') {
    if (!session || !user) return;
    setIsLoading(true);
    setErrorMsg(null);

    try {
      await triggerSOS(session.id, {
        lat: session.lastKnownLat || 0.0,
        lng: session.lastKnownLng || 0.0,
        accuracy: 1.0,
        address: session.location || "Unknown Location",
      });

      navigate("/session/sos");
    } catch (e: any) {
      triggerToast(e.message || "Failed to trigger SOS alert.");
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading && !session) {
    return (
      <div className="min-h-screen bg-[#fff8f6] flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-[#ac2d00]" size={36} />
        <p className="text-[14px] text-[#5a413a] font-medium animate-pulse">Loading active safety feed...</p>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div
      className="flex-grow flex flex-col items-center justify-start px-4 overflow-y-auto w-full"
      style={{ backgroundColor: "#fff8f6" }}
    >
      {/* Mobile container wrapper */}
      <main className="w-full max-w-[390px] min-h-[700px] flex flex-col justify-between py-8 space-y-6">
        {/* Top Header */}
        <header className="w-full flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/session/new")}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#ffe9e4] active:scale-95 transition-all text-[#261814]"
            >
              <ArrowLeft size={20} />
            </button>
            <Shield size={22} className="text-[#ac2d00]" />
            <span className="text-[18px] font-bold text-[#261814]">
              Anchor Active
            </span>
          </div>
          <div className="px-3 py-1 bg-[#ac2d00]/10 text-[#ac2d00] rounded-full text-[12px] font-bold flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-[#ac2d00] rounded-full animate-ping" />
            LIVE
          </div>
        </header>

        {/* Pulsing Safety Aura */}
        <div className="flex flex-col items-center justify-center py-4 relative">
          <div className="relative w-40 h-40 flex items-center justify-center">
            {/* Animated outer pulsing rings */}
            <motion.div
              animate={{ scale: [1, 1.4, 1], opacity: [0.15, 0, 0.15] }}
              transition={{
                repeat: Infinity,
                duration: 3,
                ease: "easeInOut",
              }}
              className="absolute w-full h-full rounded-full bg-[#ac2d00]/20"
            />
            <motion.div
              animate={{ scale: [1, 1.2, 1], opacity: [0.25, 0.05, 0.25] }}
              transition={{
                repeat: Infinity,
                duration: 2.5,
                ease: "easeInOut",
                delay: 0.5,
              }}
              className="absolute w-[80%] h-[80%] rounded-full bg-[#ac2d00]/30"
            />

            {/* Core Shield Button */}
            <div className="w-28 h-28 rounded-full bg-white border-4 border-[#fff1ed] shadow-md flex flex-col items-center justify-center z-10 relative">
              <Shield size={36} className="text-[#ac2d00]" />
              <span className="text-[10px] font-bold text-[#5a413a] uppercase tracking-wider mt-1">
                SECURED
              </span>
            </div>
          </div>

          <div className="text-center mt-4 space-y-1">
            <span className="text-[11px] font-bold tracking-wider text-[#5a413a] uppercase">
              TIME REMAINING
            </span>
            <div className={`font-mono text-[36px] font-bold leading-none ${timeLeft <= 60 ? 'text-[#ba1a1a] animate-pulse' : 'text-[#ac2d00]'}`}>
              {formatDuration(timeLeft)}
            </div>
          </div>
        </div>

        {/* Live Session Details */}
        <div className="bg-white border border-[#e2bfb5] rounded-xl p-5 shadow-sm space-y-4 text-left">
          <div>
            <span className="text-[11px] font-bold tracking-wider text-[#5a413a] uppercase">
              Current Session
            </span>
            <h2 className="text-[18px] font-bold text-[#261814] leading-snug">
              {session.title}
            </h2>
            {session.personName && (
              <div className="flex items-center gap-1.5 mt-1">
                <User size={15} className="text-[#ac2d00]" />
                <span className="text-[14px] font-medium text-[#5a413a]">
                  Meeting with {session.personName}
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 pt-3 border-t border-[#e2bfb5]/60">
            <div className="flex items-start gap-2.5">
              <MapPin size={18} className="text-[#ac2d00] shrink-0 mt-0.5" />
              <div className="flex flex-col">
                <span className="text-[11px] font-semibold text-[#5a413a] uppercase">
                  Destination
                </span>
                <span className="text-[14px] text-[#261814]">
                  {session.location}
                </span>
              </div>
            </div>

            {session.personName && session.phone && (
              <div className="flex items-start gap-2.5">
                <User size={18} className="text-[#ac2d00] shrink-0 mt-0.5" />
                <div className="flex flex-col">
                  <span className="text-[11px] font-semibold text-[#5a413a] uppercase">
                    Phone
                  </span>
                  <span className="text-[14px] text-[#261814]">
                    {session.phone}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Safety Circle Contacts */}
        <div className="space-y-2 text-left">
          <span className="text-[11px] font-bold tracking-wider text-[#5a413a] uppercase px-1">
            Safety Circle Contacts ({session.contacts.length})
          </span>
          <div className="space-y-2">
            {session.contacts.map((contact: any) => (
              <div
                key={contact.id}
                className="flex items-center justify-between p-3 bg-white border border-[#e2bfb5] rounded-xl shadow-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-[#ffe9e4] bg-[#fde2dc] flex items-center justify-center shrink-0">
                    {contact.avatarUrl ? (
                      <img
                        src={contact.avatarUrl}
                        alt={contact.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-[#ac2d00] font-bold text-[14px]">
                        {contact.name[0]}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[14px] font-bold text-[#261814]">
                      {contact.name}
                    </span>
                    <span className="text-[11px] text-[#5a413a]">
                      Monitoring Live GPS
                    </span>
                  </div>
                </div>
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        {/* Actions Footer */}
        <footer className="space-y-4 px-1 pt-2 w-full">
          {/* Extend & End row */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleExtend(15)}
              className="h-12 bg-[#ffe9e4] border border-[#e2bfb5] text-[#261814] rounded-xl font-bold text-[14px] flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
            >
              <Clock size={18} className="text-[#ac2d00]" />
              <span>Extend +15m</span>
            </button>
            <button
              onClick={() => setShowEndSessionPrompt(true)}
              className="h-12 bg-[#fff1ed] border border-[#e2bfb5] text-[#5a413a] rounded-xl font-bold text-[14px] flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
            >
              <X size={18} />
              <span>End Session</span>
            </button>
          </div>

          {/* Main Safe Checkin */}
          <button
            onClick={() => setShowEndSessionPrompt(true)}
            className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-bold text-[16px] rounded-xl shadow-md flex items-center justify-center gap-2 transition-transform"
          >
            <CheckCircle size={20} />
            <span>I'm Safe</span>
          </button>

          {/* SOS Button */}
          <div className="flex justify-center pt-2">
            <button
              onClick={() => handleTriggerSOS('SOS Button')}
              className="w-24 h-24 bg-[#ac2d00] hover:bg-[#902400] text-white rounded-full shadow-xl flex flex-col items-center justify-center gap-0.5 active:scale-90 transition-transform hover:scale-105"
            >
              <Siren size={32} className="animate-bounce" />
              <span className="text-[11px] font-extrabold uppercase tracking-wider">
                SOS
              </span>
            </button>
          </div>
        </footer>
      </main>

      {/* Modals & Overlays */}
      <AnimatePresence>
        {/* End Session Confirmation */}
        {showEndSessionPrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-[320px] bg-white rounded-2xl p-6 shadow-xl text-center space-y-6"
            >
              <div className="mx-auto w-16 h-16 bg-[#fff1ed] rounded-full flex items-center justify-center">
                <LogOut size={32} className="text-[#ac2d00]" />
              </div>
              <div>
                <h3 className="text-[20px] font-bold text-[#261814]">End Session?</h3>
                <p className="text-[15px] text-[#5a413a] mt-2">
                  Are you sure you want to end this Anchor Session?
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setShowEndSessionPrompt(false)}
                  className="h-12 bg-gray-100 text-[#5a413a] font-bold rounded-xl active:scale-95 transition-transform"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEndSessionConfirm}
                  className="h-12 bg-emerald-600 text-white font-bold rounded-xl active:scale-95 transition-transform"
                >
                  End Session
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Check-In Prompt / Extension Prompt */}
        {(showCheckInPrompt || showExtendPrompt) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="bg-[#fff8f6] w-full max-w-[390px] mx-auto rounded-t-3xl p-6 shadow-2xl relative"
            >
              {/* Drag Handle */}
              <div className="w-12 h-1.5 bg-[#e2bfb5] rounded-full mx-auto mb-6" />

              {!showExtendPrompt ? (
                // --- Check-in View ---
                <div className="space-y-6 text-center">
                  <div className="mx-auto w-16 h-16 bg-white border-4 border-[#ffe9e4] shadow-sm rounded-full flex items-center justify-center">
                    <Shield size={28} className="text-[#ac2d00]" />
                  </div>
                  <div>
                    <h2 className="text-[24px] font-bold text-[#261814]">Are you safe?</h2>
                    <p className="text-[15px] text-[#5a413a] mt-2 px-2">
                      Your next check-in was due. Let your contacts know how you're doing.
                    </p>
                  </div>

                  <div className="flex items-center justify-center gap-1.5 text-[12px] font-bold tracking-wider text-[#ac2d00] bg-[#fff1ed] py-1.5 px-3 rounded-full w-max mx-auto border border-[#e2bfb5]/50">
                    <Clock size={14} />
                    <span>GRACE PERIOD: {formatDuration(gracePeriodSeconds)}</span>
                  </div>

                  <div className="space-y-3 pt-2">
                    <button
                      onClick={handleSafeCheckIn}
                      className="w-full h-14 bg-[#e8f5e9] text-[#2e7d32] hover:bg-[#c8e6c9] rounded-xl font-bold text-[16px] flex items-center justify-start px-6 gap-3 active:scale-[0.98] transition-transform"
                    >
                      <CheckCircle size={20} />
                      <span>I'm Safe</span>
                    </button>
                    
                    <button
                      onClick={() => setShowExtendPrompt(true)}
                      className="w-full h-14 bg-white border border-[#e2bfb5] text-[#ac2d00] hover:bg-[#fff1ed] rounded-xl font-bold text-[16px] flex items-center justify-between px-6 active:scale-[0.98] transition-transform"
                    >
                      <div className="flex items-center gap-3">
                        <Clock size={20} />
                        <span>Extend Session</span>
                      </div>
                      <span className="text-[12px] bg-[#fff1ed] px-2 py-1 rounded-md border border-[#e2bfb5]">
                        Options
                      </span>
                    </button>
                    
                    <button
                      onClick={() => handleTriggerSOS('Missed Check-In (Prompt)')}
                      className="w-full h-14 bg-[#fff1ed] border border-[#ffcdd2] text-[#c62828] hover:bg-[#ffebee] rounded-xl font-bold text-[16px] flex items-center justify-start px-6 gap-3 active:scale-[0.98] transition-transform"
                    >
                      <AlertTriangle size={20} />
                      <span>NEED HELP</span>
                    </button>
                  </div>
                  
                  <p className="text-[12px] text-[#5a413a] italic mt-4 opacity-80 px-4">
                    No response in {Math.ceil(gracePeriodSeconds / 60)} minutes will alert your contacts automatically.
                  </p>
                </div>
              ) : (
                // --- Extend Session View ---
                <div className="space-y-6 text-center pb-4">
                  <div>
                    <h2 className="text-[24px] font-bold text-[#261814]">Extend Session</h2>
                    <p className="text-[15px] text-[#5a413a] mt-2">
                      How much extra time do you need?
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-3 pt-2">
                    {[15, 30, 60].map((mins) => (
                      <button
                        key={mins}
                        onClick={() => handleExtend(mins)}
                        className="w-full h-14 bg-white border border-[#e2bfb5] text-[#261814] hover:bg-[#ffe9e4] hover:border-[#ac2d00] rounded-xl font-bold text-[16px] flex items-center justify-center active:scale-[0.98] transition-all shadow-sm"
                      >
                        +{mins} minutes
                      </button>
                    ))}
                  </div>
                  
                  <button
                    onClick={() => setShowExtendPrompt(false)}
                    className="mt-2 text-[#5a413a] font-bold text-[14px] hover:text-[#261814]"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
