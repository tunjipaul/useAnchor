import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Siren, X, CheckCircle } from "lucide-react";

type AlertInfo = {
  session_id: number;
  trigger_type: string;
  status: string;
  user_name?: string;
};

export default function GlobalAlertModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [alertInfo, setAlertInfo] = useState<AlertInfo | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleNewAlert = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.type === "NEW_ALERT") {
        setAlertInfo(customEvent.detail.alert);
        setIsOpen(true);
      }
    };
    
    window.addEventListener("useanchor_new_alert", handleNewAlert);
    return () => {
      window.removeEventListener("useanchor_new_alert", handleNewAlert);
    };
  }, []);

  if (!isOpen || !alertInfo) return null;

  const isSOS = alertInfo.trigger_type === "SOS Triggered" || alertInfo.trigger_type === "manual_sos" || alertInfo.trigger_type === "missed_checkin";
  const isStart = alertInfo.trigger_type === "session_start";
  const isCheckin = alertInfo.trigger_type === "checkin_completed";

  const getTitle = () => {
    if (isSOS) return "EMERGENCY ALERT";
    if (isCheckin) return "Check-in Completed";
    if (isStart) return "New Safety Session Started";
    return "Safety Update";
  };

  const getMessage = () => {
    const name = alertInfo.user_name || "A trusted contact";
    if (isSOS) return `${name} has triggered an SOS or missed a check-in and needs immediate assistance!`;
    if (isCheckin) return `${name} has safely checked in.`;
    if (isStart) return `${name} has started a new safety session.`;
    return "There is an update to a safety session.";
  };

  const getThemeColor = () => {
    if (isSOS) return "bg-[#ba1a1a] text-white";
    if (isCheckin) return "bg-[#1e5631] text-white";
    if (isStart) return "bg-[#ac2d00] text-white";
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
              if (isSOS) {
                navigate(`/alerts`);
              } else {
                navigate(`/monitoring`);
              }
            }}
            className="px-5 py-2.5 rounded-full text-sm font-semibold bg-[#ac2d00] text-white hover:bg-[#8a2400] transition-colors shadow-sm text-center"
          >
            {isSOS ? "View Alerts" : "View Monitoring"}
          </button>
        </div>
      </div>
    </div>
  );
}
