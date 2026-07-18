import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Siren, X, CheckCircle, ShieldCheck, MapPin, User } from "lucide-react";

type AlertInfo = {
  id?: number;
  session_id: number;
  trigger_type: string;
  status: string;
  user_name?: string;
  session_title?: string;
  meet_person?: string;
  destination_address?: string;
};

export default function GlobalAlertModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [alertInfo, setAlertInfo] = useState<AlertInfo | null>(null);
  const [sessionStartToasts, setSessionStartToasts] = useState<AlertInfo[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const handleNewAlert = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.type !== "NEW_ALERT" || !customEvent.detail.alert) return;

      const incomingAlert = customEvent.detail.alert as AlertInfo;
      if (incomingAlert.trigger_type === "session_start") {
        setSessionStartToasts((prev) => {
          const alreadyExists = prev.some((toast) => toast.session_id === incomingAlert.session_id);
          if (alreadyExists) return prev;
          return [incomingAlert, ...prev].slice(0, 3);
        });
        return;
      }

      setAlertInfo(incomingAlert);
      setIsOpen(true);
    };
    
    window.addEventListener("useanchor_new_alert", handleNewAlert);
    return () => {
      window.removeEventListener("useanchor_new_alert", handleNewAlert);
    };
  }, []);

  const closeSessionToast = (sessionId: number) => {
    setSessionStartToasts((prev) => prev.filter((toast) => toast.session_id !== sessionId));
  };

  const renderSessionStartToasts = () => (
    <div className="fixed right-4 top-20 z-[100] flex w-[calc(100vw-32px)] max-w-sm flex-col gap-3 sm:right-6">
      {sessionStartToasts.map((toast) => {
        const name = toast.user_name || "A trusted contact";
        return (
          <div
            key={toast.session_id}
            className="overflow-hidden rounded-xl border border-[#e2bfb5] bg-white shadow-2xl animate-in slide-in-from-right-4 fade-in duration-200"
          >
            <div className="flex items-start gap-3 border-b border-[#f2eaea] bg-[#fff8f6] p-4">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#fde2dc] text-[#ac2d00]">
                <ShieldCheck size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold uppercase tracking-wide text-[#ac2d00]">Safety Session Started</p>
                <p className="mt-1 text-[15px] font-semibold leading-snug text-[#261814]">
                  {name} has started a safety session.
                </p>
              </div>
              <button
                type="button"
                onClick={() => closeSessionToast(toast.session_id)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#5a413a] hover:bg-[#fde2dc] active:scale-95"
                aria-label="Close session notification"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2 p-4 text-[13px] text-[#5a413a]">
              {toast.session_title && (
                <div className="flex items-start gap-2">
                  <CheckCircle size={15} className="mt-0.5 shrink-0 text-[#1e5631]" />
                  <span className="font-medium text-[#261814]">{toast.session_title}</span>
                </div>
              )}
              {toast.meet_person && (
                <div className="flex items-start gap-2">
                  <User size={15} className="mt-0.5 shrink-0 text-[#954831]" />
                  <span>Meeting {toast.meet_person}</span>
                </div>
              )}
              {toast.destination_address && (
                <div className="flex items-start gap-2">
                  <MapPin size={15} className="mt-0.5 shrink-0 text-[#954831]" />
                  <span className="line-clamp-2">{toast.destination_address}</span>
                </div>
              )}
            </div>

            <div className="flex gap-2 border-t border-[#f2eaea] bg-white p-3">
              <button
                type="button"
                onClick={() => closeSessionToast(toast.session_id)}
                className="flex-1 rounded-lg border border-[#e2bfb5] px-3 py-2 text-[13px] font-semibold text-[#5a413a] hover:bg-[#fff8f6]"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={() => {
                  closeSessionToast(toast.session_id);
                  navigate("/monitoring");
                }}
                className="flex-1 rounded-lg bg-[#ac2d00] px-3 py-2 text-[13px] font-semibold text-white hover:bg-[#8a2400]"
              >
                View Monitoring
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderEmergencyModal = () => {
    if (!isOpen || !alertInfo) return null;

    const isSOS = alertInfo.trigger_type === "SOS Triggered" || alertInfo.trigger_type === "manual_sos" || alertInfo.trigger_type === "missed_checkin";
    const isCheckin = alertInfo.trigger_type === "checkin_completed";

    const getTitle = () => {
      if (isSOS) return "EMERGENCY ALERT";
      if (isCheckin) return "Check-in Completed";
      return "Safety Update";
    };

    const getMessage = () => {
      const name = alertInfo.user_name || "A trusted contact";
      if (isSOS) return `${name} has triggered an SOS or missed a check-in and needs immediate assistance!`;
      if (isCheckin) return `${name} has safely checked in.`;
      return "There is an update to a safety session.";
    };

    const getThemeColor = () => {
      if (isSOS) return "bg-[#ba1a1a] text-white";
      if (isCheckin) return "bg-[#1e5631] text-white";
      return "bg-[#261814] text-white";
    };

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div className={`p-6 ${getThemeColor()} flex items-start gap-4`}>
            <div className="shrink-0">
              {isCheckin ? <CheckCircle size={32} /> : <Siren size={32} className={isSOS ? "animate-pulse" : ""} />}
            </div>
            <div className="flex-1 pt-1">
              <h3 className="text-xl font-bold tracking-tight">{getTitle()}</h3>
              <p className="mt-2 text-white/90 text-[15px] leading-relaxed">{getMessage()}</p>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-full hover:bg-black/20 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
          
          <div className="p-4 bg-[#fff8f6] flex flex-col sm:flex-row gap-3 justify-end">
            <button 
              onClick={() => setIsOpen(false)}
              className="px-5 py-2.5 rounded-full text-sm font-semibold text-[#5a413a] border border-[#e2bfb5] hover:bg-[#fde2dc] transition-colors text-center"
            >
              Dismiss
            </button>
            <button 
              onClick={() => {
                setIsOpen(false);
                navigate(isSOS ? "/alerts" : "/monitoring");
              }}
              className="px-5 py-2.5 rounded-full text-sm font-semibold bg-[#ac2d00] text-white hover:bg-[#8a2400] transition-colors shadow-sm text-center"
            >
              {isSOS ? "View Alerts" : "View Monitoring"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {renderSessionStartToasts()}
      {renderEmergencyModal()}
    </>
  );
}

