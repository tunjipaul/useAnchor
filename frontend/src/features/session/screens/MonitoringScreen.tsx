import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Search, ArrowLeft, RefreshCw, Activity, CheckCircle, Clock } from "lucide-react";
import DesktopHeader from "../../../components/DesktopHeader";
import DesktopSidebar from "../../../components/DesktopSidebar";
import MobileBottomNav from "../../../components/MobileBottomNav";
import { apiFetch } from "../../../lib/api";

type MonitoringSession = {
  id: number;
  title: string;
  status: "active" | "sos" | "emergency";
  starts_at: string;
  expected_end: string;
  user_name: string;
  user_avatar: string | null;
  meet_person: string;
  meet_location: string;
};

export default function MonitoringScreen() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<MonitoringSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPolling, setIsPolling] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const loadSessions = async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsPolling(true);
    
    setErrorMsg("");
    
    try {
      const data = await apiFetch<MonitoringSession[]>("/sessions/monitoring/active");
      setSessions(data);
    } catch (e: any) {
      console.error("Error loading monitoring sessions:", e);
      if (!silent) setErrorMsg("Unable to load active sessions. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
      setIsPolling(false);
    }
  };

  useEffect(() => {
    loadSessions();

    const handleNewAlert = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.type === "NEW_ALERT" || customEvent.detail?.type === "session_start" || customEvent.detail?.type === "checkin_completed") {
        loadSessions(true);
      }
    };
    
    window.addEventListener("useanchor_new_alert", handleNewAlert);
    
    // Also poll every 30 seconds just in case we miss a WebSocket message
    const intervalId = setInterval(() => {
      loadSessions(true);
    }, 30000);
    
    return () => {
      window.removeEventListener("useanchor_new_alert", handleNewAlert);
      clearInterval(intervalId);
    };
  }, []);

  const filteredSessions = sessions.filter(session => {
    if (searchQuery && !session.user_name.toLowerCase().includes(searchQuery.toLowerCase()) && !session.title.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  const getStatusDisplay = (status: string) => {
    switch(status) {
      case "active":
        return <span className="bg-[#e2f5e9] text-[#1e5631] text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-tighter flex items-center gap-1"><Activity size={10} /> Active</span>;
      case "sos":
      case "emergency":
        return <span className="bg-[#ff9c80] text-[#ac2d00] text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-tighter flex items-center gap-1"><Activity size={10} /> SOS Triggered</span>;
      default:
        return <span className="bg-[#f2eaea] text-[#5a413a] text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-tighter">{status}</span>;
    }
  };

  const getTimeLeft = (expectedEnd: string) => {
    const end = new Date(expectedEnd).getTime();
    const now = new Date().getTime();
    const diffMins = Math.floor((end - now) / 60000);
    
    if (diffMins < 0) return "Overdue";
    if (diffMins < 60) return `${diffMins}m left`;
    
    const diffHours = Math.floor(diffMins / 60);
    const remainder = diffMins % 60;
    return `${diffHours}h ${remainder}m left`;
  };

  return (
    <div className="bg-[#fff8f6] text-[#261814] font-body min-h-screen flex flex-col lg:flex-row">
      {/* Desktop Layout Elements */}
      <div className="hidden lg:flex flex-col min-h-screen w-full">
        <DesktopHeader />
        <DesktopSidebar />

        <main className="ml-64 mt-16 flex-1 flex flex-col h-[calc(100vh-64px)] overflow-hidden">
          {/* Page Title Area */}
          <div className="px-6 py-6 bg-[#fff8f6] flex items-center justify-between shrink-0">
            <div className="flex flex-col gap-1">
              <h2 className="text-[28px] font-semibold text-[#261814]">Active Monitoring</h2>
              <p className="text-[16px] text-[#5a413a]">Real-time view of sessions where you are a trusted contact.</p>
            </div>
            <button 
              onClick={() => loadSessions(true)}
              disabled={isPolling || isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-[#fde2dc] text-[#954831] rounded-full text-sm font-semibold hover:bg-[#facac0] transition-colors disabled:opacity-50"
            >
              <RefreshCw size={16} className={isPolling || isLoading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>

          {/* Dashboard Content */}
          <div className="flex-1 flex flex-col px-6 pb-6 overflow-hidden">
            
            {/* Search */}
            <div className="flex items-center justify-between gap-4 mb-4 shrink-0">
              <div className="relative w-80">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5a413a]">
                  <Search size={18} />
                </span>
                <input 
                  type="text" 
                  placeholder="Search by name or session title..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-[#e2bfb5] text-[#261814] text-sm rounded-full pl-10 pr-4 py-2.5 focus:outline-none focus:border-[#ac2d00] focus:ring-1 focus:ring-[#ac2d00] transition-all"
                />
              </div>
            </div>

            {errorMsg && (
              <div className="bg-[#ff9c80]/20 text-[#ac2d00] text-sm font-medium p-4 rounded-xl mb-4 shrink-0 border border-[#ac2d00]/20">
                {errorMsg}
              </div>
            )}

            {/* Content List Area */}
            <div className="flex-1 overflow-y-auto pr-2 pb-20 custom-scrollbar">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-[#5a413a]">
                  <Loader2 className="animate-spin text-[#ac2d00]" size={32} />
                  <span className="text-[14px] font-medium animate-pulse">Scanning for active sessions...</span>
                </div>
              ) : filteredSessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full bg-white border border-dashed border-[#e2bfb5] rounded-2xl p-8 text-center max-w-lg mx-auto mt-8">
                  <div className="w-16 h-16 bg-[#fff8f6] rounded-full flex items-center justify-center mb-4 text-[#e2bfb5]">
                    <CheckCircle size={32} />
                  </div>
                  <h3 className="text-xl font-semibold text-[#261814] mb-2">No Active Sessions</h3>
                  <p className="text-[#5a413a] text-sm leading-relaxed max-w-sm">
                    {searchQuery 
                      ? "No sessions match your search. Try different keywords." 
                      : "None of your contacts are currently in an active safety session. You'll be notified automatically if anyone starts one."}
                  </p>
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery("")}
                      className="mt-6 text-[#ac2d00] font-semibold text-sm hover:underline"
                    >
                      Clear Search
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredSessions.map(session => (
                    <div 
                      key={session.id}
                      className="bg-white p-5 rounded-2xl border border-[#e2bfb5] shadow-sm hover:border-[#954831] hover:shadow-md transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex gap-3 items-center">
                            <div className="relative w-12 h-12">
                              <div className={`w-full h-full rounded-full flex items-center justify-center bg-[#ffe9e4] text-[#ac2d00] font-bold text-lg border border-[#e2bfb5]`}>
                                {session.user_avatar ? (
                                  <img src={session.user_avatar} alt="avatar" className="w-full h-full rounded-full object-cover" />
                                ) : (
                                  session.user_name ? session.user_name.charAt(0).toUpperCase() : "U"
                                )}
                              </div>
                            </div>
                            <div>
                              <h3 className="text-[16px] font-semibold text-[#261814] leading-tight mb-0.5">{session.user_name}</h3>
                              {getStatusDisplay(session.status)}
                            </div>
                          </div>
                        </div>

                        <h4 className="font-semibold text-[#261814] mb-2 text-lg line-clamp-1">{session.title}</h4>
                        
                        <div className="space-y-2 mb-4">
                          {session.meet_person && (
                            <div className="text-[13px] text-[#5a413a] flex items-start gap-2">
                              <span className="font-semibold w-16 shrink-0">Meeting:</span> 
                              <span className="truncate">{session.meet_person}</span>
                            </div>
                          )}
                          {session.meet_location && (
                            <div className="text-[13px] text-[#5a413a] flex items-start gap-2">
                              <span className="font-semibold w-16 shrink-0">Location:</span> 
                              <span className="truncate">{session.meet_location}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="pt-3 border-t border-[#f2eaea] flex justify-between items-center text-[12px] font-semibold text-[#5a413a]">
                        <span>Started at {new Date(session.starts_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        <span className={`flex items-center gap-1 ${getTimeLeft(session.expected_end) === 'Overdue' ? 'text-[#ac2d00]' : 'text-[#954831]'}`}>
                          <Clock size={12} />
                          {getTimeLeft(session.expected_end)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Mobile Layout */}
      <div className="lg:hidden flex flex-col min-h-screen w-full relative">
        {/* Fixed Header */}
        <div className="sticky top-0 left-0 right-0 z-40 bg-[#fff8f6] px-4 pt-8 pb-3 shrink-0 shadow-sm border-b border-[#f2eaea]">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate(-1)}
              className="p-2 -ml-2 rounded-full hover:bg-black/5 transition-colors text-[#261814]"
            >
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-[22px] font-semibold text-[#261814] tracking-tight">Active Sessions</h1>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-24 custom-scrollbar">
          {/* Search Mobile */}
          <div className="relative w-full mb-6 shrink-0">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5a413a]">
              <Search size={18} />
            </span>
            <input 
              type="text" 
              placeholder="Search by name or title..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-[#e2bfb5] text-[#261814] text-[15px] rounded-full pl-10 pr-4 py-3 focus:outline-none focus:border-[#ac2d00] focus:ring-1 focus:ring-[#ac2d00] transition-all"
            />
          </div>

          <div className="flex items-center justify-between mb-4">
            <span className="text-[13px] font-semibold text-[#5a413a] uppercase tracking-wider">Currently Monitoring</span>
            <button 
              onClick={() => loadSessions(true)}
              disabled={isPolling || isLoading}
              className="p-1.5 bg-[#fde2dc] text-[#954831] rounded-full hover:bg-[#facac0] transition-colors disabled:opacity-50"
            >
              <RefreshCw size={14} className={isPolling || isLoading ? "animate-spin" : ""} />
            </button>
          </div>

          {errorMsg && (
            <div className="bg-[#ff9c80]/20 text-[#ac2d00] text-[13px] font-medium p-3 rounded-xl mb-4 border border-[#ac2d00]/20">
              {errorMsg}
            </div>
          )}

          <div className="flex flex-col gap-3">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-[#5a413a]">
                <Loader2 className="animate-spin text-[#ac2d00]" size={28} />
                <span className="text-[13px] font-medium animate-pulse">Scanning sessions...</span>
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 bg-white border border-dashed border-[#e2bfb5] rounded-2xl px-6 text-center mt-2">
                <div className="w-14 h-14 bg-[#fff8f6] rounded-full flex items-center justify-center mb-3 text-[#e2bfb5]">
                  <CheckCircle size={28} />
                </div>
                <h3 className="text-[18px] font-semibold text-[#261814] mb-1">No Active Sessions</h3>
                <p className="text-[#5a413a] text-[13px] leading-relaxed">
                  {searchQuery ? "No sessions match." : "Your contacts are currently safe. Nothing to monitor right now."}
                </p>
              </div>
            ) : (
              filteredSessions.map(session => (
                <div 
                  key={session.id}
                  className="bg-white p-4 rounded-xl border border-[#e2bfb5] shadow-sm flex flex-col justify-between"
                >
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex gap-3 items-center">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-[#ffe9e4] text-[#ac2d00] font-bold text-base border border-[#e2bfb5]`}>
                          {session.user_avatar ? (
                            <img src={session.user_avatar} alt="avatar" className="w-full h-full rounded-full object-cover" />
                          ) : (
                            session.user_name ? session.user_name.charAt(0).toUpperCase() : "U"
                          )}
                        </div>
                        <div>
                          <h3 className="text-[15px] font-semibold text-[#261814] leading-tight mb-0.5">{session.user_name}</h3>
                          {getStatusDisplay(session.status)}
                        </div>
                      </div>
                    </div>

                    <h4 className="font-semibold text-[#261814] mb-1.5 text-base line-clamp-1">{session.title}</h4>
                    
                    <div className="space-y-1 mb-3">
                      {session.meet_person && (
                        <div className="text-[12px] text-[#5a413a] flex items-start gap-1.5">
                          <span className="font-semibold shrink-0">Meeting:</span> 
                          <span className="truncate">{session.meet_person}</span>
                        </div>
                      )}
                      {session.meet_location && (
                        <div className="text-[12px] text-[#5a413a] flex items-start gap-1.5">
                          <span className="font-semibold shrink-0">Location:</span> 
                          <span className="truncate">{session.meet_location}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-[#f2eaea] flex justify-between items-center text-[11px] font-semibold text-[#5a413a]">
                    <span>Started {new Date(session.starts_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    <span className={`flex items-center gap-1 ${getTimeLeft(session.expected_end) === 'Overdue' ? 'text-[#ac2d00]' : 'text-[#954831]'}`}>
                      <Clock size={11} />
                      {getTimeLeft(session.expected_end)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <MobileBottomNav />
      </div>
    </div>
  );
}
