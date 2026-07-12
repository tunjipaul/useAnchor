import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Bell,
  MapPin,
  Clock,
  Shield,
  Phone,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { apiFetch } from "../../../lib/api";
import { useAuthStore } from "../../auth/stores/useAuthStore";
import { motion, AnimatePresence } from "framer-motion";

export default function SOSActivatedScreen() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [session, setSession] = useState<any | null>(null);
  const [activeAlert, setActiveAlert] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  useEffect(() => {
    async function loadSOSData() {
      if (!user) return;
      setIsLoading(true);
      try {
        const sessionData = await apiFetch<any>("/sessions/active");

        if (sessionData && (sessionData.status === "sos" || sessionData.status === "emergency")) {
          setSession({
            id: sessionData.id,
            title: sessionData.title,
            startedAt: sessionData.starts_at || sessionData.expected_end,
            durationMinutes: sessionData.checkin_interval_minutes || 30,
            sosTriggeredAt: sessionData.updated_at,
            contacts: [], // mock for MVP
          });

          const alerts = await apiFetch<any[]>(`/sessions/${sessionData.id}/alerts`);
          const active = alerts.find(a => !a.resolved_at);

          if (active) {
            setActiveAlert(active);
          }
        } else {
          navigate("/dashboard");
        }
      } catch (e) {
        console.error("Error loading SOS data", e);
        navigate("/dashboard");
      } finally {
        setIsLoading(false);
      }
    }
    loadSOSData();
  }, [user, navigate]);

  async function handleSafeNow() {
    if (!activeAlert || !user) return;
    setIsLoading(true);
    try {
      await apiFetch(`/alerts/${activeAlert.id}/cancel`, {
        method: "POST"
      });

      navigate("/dashboard");
    } catch (e: any) {
      triggerToast(e.message || "Failed to cancel active safety alarm.");
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#fff8f6] flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-[#ac2d00]" size={36} />
        <p className="text-[14px] text-[#5a413a] font-medium animate-pulse">Syncing safety coordinates...</p>
      </div>
    );
  }

  if (!session) return null;

  const primaryContact = session.contacts[0] || { name: 'Emergency Contact', phone: '' };

  return (
    <div className="flex-grow flex flex-col items-center justify-start overflow-y-auto w-full bg-[#fff8f6]">
      <main className="w-full max-w-[390px] min-h-[700px] flex flex-col justify-between pt-10 pb-6 relative">
        
        <div className="px-5 space-y-6 flex-grow flex flex-col">
          {/* Header Icon */}
          <div className="flex justify-center">
            <div className="w-24 h-24 bg-[#ba1a1a] rounded-full shadow-lg flex items-center justify-center animate-pulse">
              <AlertTriangle size={48} className="text-white" />
            </div>
          </div>

          <div className="text-center space-y-2">
            <h1 className="text-[28px] font-bold text-[#ba1a1a]">SOS Alert Sent</h1>
            <p className="text-[15px] text-[#261814] px-2 leading-relaxed">
              Your trusted contacts have been notified with your location and session details.
            </p>
          </div>

          {/* Status List */}
          <div className="bg-white border border-[#e2bfb5] rounded-xl p-2 shadow-sm">
            <div className="divide-y divide-[#e2bfb5]/50">
              <div className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3 text-[#261814]">
                  <Bell size={20} className="text-[#5a413a]" />
                  <span className="text-[15px] font-medium">Contacts notified</span>
                </div>
                <span className="bg-[#e8f5e9] text-[#2e7d32] px-2.5 py-0.5 rounded-full text-[12px] font-bold">Sent</span>
              </div>
              <div className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3 text-[#261814]">
                  <MapPin size={20} className="text-[#5a413a]" />
                  <span className="text-[15px] font-medium">Location shared</span>
                </div>
                <div className="flex items-center gap-1.5 text-[#006e1c] font-bold text-[12px]">
                  <div className="w-2 h-2 rounded-full bg-[#006e1c] animate-pulse" />
                  <span>Active</span>
                </div>
              </div>
              <div className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3 text-[#261814]">
                  <Clock size={20} className="text-[#5a413a]" />
                  <span className="text-[15px] font-medium">Alert timestamp</span>
                </div>
                <span className="text-[14px] text-[#5a413a] font-mono">
                  {session.sosTriggeredAt ? new Date(session.sosTriggeredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''}
                </span>
              </div>
              <div className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3 text-[#261814]">
                  <Shield size={20} className="text-[#5a413a]" />
                  <span className="text-[15px] font-medium">Session details attached</span>
                </div>
                <span className="bg-[#e8f5e9] text-[#2e7d32] px-2.5 py-0.5 rounded-full text-[12px] font-bold">Sent</span>
              </div>
            </div>
          </div>

          {/* Notified Contacts */}
          <div className="space-y-3 pt-2">
            <h3 className="text-[16px] font-bold text-[#261814]">Who was notified</h3>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {session.contacts.map((contact: any) => (
                <div key={contact.id} className="min-w-[110px] bg-white border border-[#e2bfb5] rounded-xl p-3 shadow-sm flex flex-col items-center text-center gap-2">
                  <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-[#ffe9e4] bg-[#fde2dc] flex items-center justify-center shrink-0">
                    {contact.avatarUrl ? (
                      <img src={contact.avatarUrl} alt={contact.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[#ac2d00] font-bold text-[18px]">{contact.name[0]}</span>
                    )}
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[13px] font-bold text-[#261814] leading-tight w-20 truncate">{contact.name.split(' ')[0]}</span>
                    <span className="text-[10px] font-bold text-[#005c99] bg-[#e1f0fc] px-1.5 py-0.5 rounded mt-1">SMS</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="flex-grow" />
          
          {/* Actions */}
          <div className="space-y-3 pt-4">
            <button
              className="w-full h-14 bg-white border-2 border-[#12916b] text-[#12916b] rounded-xl font-bold text-[16px] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            >
              <Phone size={20} />
              <span>Call {primaryContact.name.split(' ')[0]}</span>
            </button>
            <button
              onClick={handleSafeNow}
              className="w-full h-14 bg-white border-2 border-[#261814] text-[#261814] rounded-xl font-bold text-[16px] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-sm"
            >
              <CheckCircle size={20} />
              <span>I'm Safe Now — End Alert</span>
            </button>
          </div>
        </div>

        {/* Footer Warning Banner */}
        <div className="absolute bottom-0 left-0 right-0 w-full bg-[#ffdad6] border-t border-[#ba1a1a]/20 py-2.5 flex items-center justify-center gap-2">
          <AlertTriangle size={14} className="text-[#ba1a1a]" />
          <span className="text-[11px] font-bold text-[#ba1a1a] tracking-wider uppercase">
            SOS IS ACTIVE. DO NOT CLOSE THIS SCREEN.
          </span>
        </div>
      </main>

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
