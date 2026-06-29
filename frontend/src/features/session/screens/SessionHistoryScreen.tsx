import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle, AlertTriangle, Play, HelpCircle, History } from "lucide-react";
import { sessionStore, type SessionData } from "../utils/sessionStore";
import MobileBottomNav from "../../../components/MobileBottomNav";

// Helper function from HomeScreen to get status UI
const getStatusConfig = (session: SessionData) => {
  if (session.sosTriggeredAt) {
    return {
      label: "SOS Triggered",
      bg: "bg-[#ba1a1a]/10",
      color: "text-[#ba1a1a]",
      Icon: AlertTriangle,
    };
  }
  if (session.status === "completed") {
    return {
      label: "Ended Safely",
      bg: "bg-[#1D9E75]/10",
      color: "text-[#1D9E75]",
      Icon: CheckCircle,
    };
  }
  if (session.status === "active") {
    return {
      label: "Active Now",
      bg: "bg-[#ac2d00]/10",
      color: "text-[#ac2d00]",
      Icon: Play,
    };
  }
  return {
    label: "Unknown",
    bg: "bg-[#e2bfb5]/20",
    color: "text-[#5a413a]",
    Icon: HelpCircle,
  };
};

export default function SessionHistoryScreen() {
  const navigate = useNavigate();
  const [history, setHistory] = useState<SessionData[]>([]);

  useEffect(() => {
    // Load history
    const storedHistory = sessionStore.getHistory();
    setHistory(storedHistory);
  }, []);

  return (
    <div className="flex-grow flex flex-col items-center justify-start overflow-y-auto w-full min-h-[100dvh] bg-[#FAFAF7] text-[#261814]">
      {/* TopAppBar */}
      <header className="fixed top-0 w-full max-w-[390px] z-50 bg-[#fff8f6] border-b border-[#e2bfb5] shadow-sm px-4 h-[64px] flex justify-between items-center">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center active:scale-95 transition-transform text-[#5a413a]">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-[20px] font-bold text-[#ac2d00] tracking-tight truncate max-w-[200px]">Session History</h1>
        </div>
      </header>

      <main className="mt-[64px] mb-[80px] p-4 flex flex-col gap-4 max-w-[390px] w-full mx-auto">
        <div className="flex items-center gap-2 mb-2 px-2">
          <History size={20} className="text-[#ac2d00]" />
          <h2 className="text-[18px] font-bold text-[#261814]">All Past Sessions</h2>
        </div>

        {history.length === 0 ? (
          <div className="text-center py-10 px-4 bg-white border border-[#e2bfb5] rounded-xl shadow-sm text-[#5a413a]">
            <p className="text-[14px]">You have no past sessions recorded.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {history.map((session) => {
              const statusConfig = getStatusConfig(session);
              const Icon = statusConfig.Icon;
              return (
                <div
                  key={session.id}
                  onClick={() => navigate(`/session/timeline/${session.id}`, { state: { session } })}
                  className="flex items-center justify-between p-4 bg-white border border-[#e2bfb5] rounded-xl shadow-xs cursor-pointer hover:border-[#ac2d00] transition-colors"
                >
                  <div className="flex flex-col gap-0.5 text-left min-w-0 flex-1 pr-3">
                    <span className="text-[15px] font-bold text-[#261814] truncate w-full">
                      {session.title}
                    </span>
                    <span className="text-[12px] text-[#5a413a] truncate w-full">
                      {session.location} • {new Date(session.startedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                  <div className={`flex items-center gap-1 text-[12px] font-semibold ${statusConfig.color} ${statusConfig.bg} px-2.5 py-1 rounded-full shrink-0`}>
                    <Icon size={12} />
                    <span className="whitespace-nowrap">{statusConfig.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <MobileBottomNav />
    </div>
  );
}
