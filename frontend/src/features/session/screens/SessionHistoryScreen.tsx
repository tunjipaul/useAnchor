import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle, AlertTriangle, Play, HelpCircle, History, ChevronRight, Filter, Plus } from "lucide-react";
import { apiFetch } from "../../../lib/api";
import { useAuthStore } from "../../auth/stores/useAuthStore";
import MobileBottomNav from "../../../components/MobileBottomNav";
import DesktopHeader from "../../../components/DesktopHeader";
import DesktopSidebar from "../../../components/DesktopSidebar";

const getStatusConfig = (session: any) => {
  if (session.status === "sos" || session.status === "emergency") {
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
  const user = useAuthStore((state) => state.user);
  const [history, setHistory] = useState<any[]>([]);
  const [_isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function loadSessionHistory() {
      if (!user) return;
      setIsLoading(true);
      try {
        const data = await apiFetch<any[]>("/sessions/history");

        if (data) {
          setHistory(
            data.map((s: any) => ({
              id: s.id,
              title: s.title,
              location: s.destination_address || "Unknown Location",
              startedAt: s.starts_at || new Date().toISOString(),
              status: s.status,
            }))
          );
        }
      } catch (e) {
        console.error("Failed to load history", e);
      } finally {
        setIsLoading(false);
      }
    }
    loadSessionHistory();
  }, [user]);

  return (
    <div className="bg-[#FAFAF7] text-[#261814] min-h-screen">
      {/* ============================= */}
      {/*    MOBILE LAYOUT (lg:hidden)  */}
      {/* ============================= */}
      <div className="block lg:hidden flex-grow flex flex-col items-center justify-start overflow-y-auto w-full min-h-[100dvh]">
        {/* TopAppBar */}
        <header className="fixed top-0 w-full z-50 bg-[#fff8f6] border-b border-[#e2bfb5] shadow-sm px-4 h-[64px] flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center active:scale-95 transition-transform text-[#5a413a]">
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-[20px] font-bold text-[#ac2d00] tracking-tight truncate max-w-[200px]">Session History</h1>
          </div>
        </header>

        <main className="mt-[64px] mb-[80px] p-4 flex flex-col gap-4 max-w-[500px] w-full mx-auto">
          <div className="flex items-center justify-between mb-2 px-2">
            <div className="flex items-center gap-2">
              <History size={20} className="text-[#ac2d00]" />
              <h2 className="text-[18px] font-bold text-[#261814]">All Past Sessions</h2>
            </div>
            <button 
              onClick={() => navigate("/session/new")}
              className="flex items-center gap-1.5 bg-[#ac2d00] text-white px-3 py-1.5 rounded-lg font-bold text-[13px] active:scale-95 transition-transform"
            >
              <Plus size={16} />
              New
            </button>
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
                    className="flex items-center justify-between p-4 bg-white border border-[#e2bfb5] rounded-xl shadow-sm cursor-pointer hover:border-[#ac2d00] transition-colors"
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

      {/* ============================== */}
      {/*  DESKTOP LAYOUT (hidden lg:flex) */}
      {/* ============================== */}
      <div className="hidden lg:flex flex-col min-h-screen">
        <DesktopHeader showSearch={true} searchPlaceholder="Search history..." />
        <DesktopSidebar />

        {/* Main Content */}
        <main className="ml-64 mt-16 flex-grow min-h-[calc(100vh-64px)] overflow-y-auto bg-[#fff8f6] p-8">
          <div className="max-w-6xl mx-auto">
            <header className="flex justify-between items-end mb-8">
              <div>
                <h1 className="text-[28px] font-semibold text-[#261814]">Session History</h1>
                <p className="text-[16px] text-[#5a413a] mt-1">Review your past monitoring sessions and alerts.</p>
              </div>
              <div className="flex items-center gap-3">
                <button className="flex items-center gap-2 px-4 py-2 bg-white border border-[#e2bfb5] rounded-xl text-[#5a413a] hover:bg-[#fff1ed] transition-colors font-medium">
                  <Filter size={18} />
                  Filter
                </button>
                <button 
                  onClick={() => navigate("/session/new")}
                  className="flex items-center gap-2 px-4 py-2 bg-[#ac2d00] text-white rounded-xl hover:bg-[#902500] transition-colors font-bold shadow-sm"
                >
                  <Plus size={18} />
                  New Session
                </button>
              </div>
            </header>

            {history.length === 0 ? (
              <div className="text-center py-20 px-4 bg-white border border-[#e2bfb5] rounded-2xl shadow-sm text-[#5a413a]">
                <History size={48} className="mx-auto text-[#e2bfb5] mb-4" />
                <p className="text-[16px] font-medium">You have no past sessions recorded.</p>
              </div>
            ) : (
              <div className="bg-white border border-[#e2bfb5] rounded-2xl shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#fff1ed] border-b border-[#e2bfb5] text-[12px] uppercase tracking-wider text-[#5a413a]">
                      <th className="p-4 font-bold">Session Name</th>
                      <th className="p-4 font-bold">Date</th>
                      <th className="p-4 font-bold">Location</th>
                      <th className="p-4 font-bold">Status</th>
                      <th className="p-4 font-bold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e2bfb5]">
                    {history.map((session) => {
                      const statusConfig = getStatusConfig(session);
                      const Icon = statusConfig.Icon;
                      return (
                        <tr key={session.id} className="hover:bg-[#fff8f6] transition-colors group cursor-pointer" onClick={() => navigate(`/session/timeline/${session.id}`, { state: { session } })}>
                          <td className="p-4">
                            <span className="text-[15px] font-bold text-[#261814]">{session.title}</span>
                          </td>
                          <td className="p-4">
                            <span className="text-[14px] text-[#5a413a]">
                              {new Date(session.startedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          </td>
                          <td className="p-4">
                            <span className="text-[14px] text-[#5a413a]">{session.location}</span>
                          </td>
                          <td className="p-4">
                            <div className={`inline-flex items-center gap-1.5 text-[12px] font-semibold ${statusConfig.color} ${statusConfig.bg} px-2.5 py-1 rounded-full`}>
                              <Icon size={14} />
                              <span>{statusConfig.label}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <button 
                              className="text-[#ac2d00] font-semibold text-[14px] hover:underline flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              View Details
                              <ChevronRight size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
