import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
} from "lucide-react";
import { sessionStore } from "../utils/sessionStore";
import type { SessionData, TriggerType } from "../utils/sessionStore";

export default function ActiveSessionScreen() {
  const navigate = useNavigate();
  const [session, setSession] = useState<SessionData | null>(null);
  const [timeLeft, setTimeLeft] = useState(30 * 60);
  
  // Modals state
  const [showCheckInPrompt, setShowCheckInPrompt] = useState(false);
  const [showEndSessionPrompt, setShowEndSessionPrompt] = useState(false);
  const [showExtendPrompt, setShowExtendPrompt] = useState(false);
  const [gracePeriodSeconds, setGracePeriodSeconds] = useState(1 * 60);

  // Load session details from localStorage
  useEffect(() => {
    const stored = sessionStore.getActiveSession();
    if (stored) {
      try {
        setSession(stored);

        // Calculate remaining time from when session started
        const duration = (stored.durationMinutes || 30) * 60;
        const start = new Date(stored.startedAt).getTime();
        const now = new Date().getTime();
        const elapsed = Math.floor((now - start) / 1000);
        setTimeLeft(Math.max(0, duration - elapsed));
      } catch (e) {
        console.error("Failed to parse active safety session", e);
      }
    } else {
      const fallbackSession: SessionData = {
        id: sessionStore.generateId(),
        title: "Marketplace Pickup",
        personName: "Alex Rivera",
        location: "Coffee House, 4th Ave",
        date: new Date().toISOString().split("T")[0],
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        durationMinutes: 30,
        contacts: [
          {
            id: "2",
            name: "David Chen",
            phone: "+1 (555) 987-6543",
            avatarUrl:
              "https://lh3.googleusercontent.com/aida-public/AB6AXuD5SMzNYC9FrPEt6RymcfLaMRC3QJLbKy_pxaLFO7S3M9FKFKriAR40V-xJKm1mXBwKk6z6TEt8g8xIlhPqe__TMCXy3hRGnaoUyb2UUyStTiI9pnRanFZEGHaoL6hpo9pGuTlvBSpythlnv-q7C_vt8bbWSdbv4A99QPsg2aXcWL3IxrP7ZemyNFTbD_6kfkx4d0eRcQos4KKKA-EnBQBoqPLiLE1sTPE3pJjcsyhTXAeqneISeYFIEqytdpbE7Q9RdC5B5hUqxTU",
          },
        ],
        startedAt: new Date().toISOString(),
        status: 'active',
        checkIns: [],
      };
      setSession(fallbackSession);
    }
  }, []);

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

  function handleSafeCheckIn() {
    if (!session) return;
    const newCheckIn = { timestamp: new Date().toISOString(), type: 'safe' as const };
    const updatedSession = { ...session, checkIns: [...session.checkIns, newCheckIn] };
    setSession(updatedSession);
    sessionStore.setActiveSession(updatedSession);
    
    // Reset timer to original duration
    const duration = (updatedSession.durationMinutes || 30) * 60;
    setTimeLeft(duration);
    setShowCheckInPrompt(false);
  }

  function handleEndSessionConfirm() {
    if (!session) return;
    const updatedSession = { ...session, status: 'completed' as const, endedAt: new Date().toISOString() };
    sessionStore.addToHistory(updatedSession);
    sessionStore.clearActiveSession();
    navigate("/session/summary", { state: { session: updatedSession } });
  }

  function handleExtend(minutes: number = 15) {
    setTimeLeft((prev) => prev + minutes * 60);
    setShowExtendPrompt(false);
    setShowCheckInPrompt(false);
  }

  function handleTriggerSOS(reason: string = 'SOS Button') {
    if (!session) return;
    const updatedSession = {
      ...session,
      status: 'sos' as const,
      sosTriggeredAt: new Date().toISOString(),
      triggerType: reason as TriggerType,
    };
    sessionStore.setActiveSession(updatedSession);
    navigate("/session/sos");
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
            {session.contacts.map((contact) => (
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
    </div>
  );
}
