import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Search, Bell, Siren, CheckCircle, 
  TimerOff, ZoomIn, LocateFixed, ArrowRight, Loader2
} from "lucide-react";
import DesktopSidebar from "../../../components/DesktopSidebar";
import DesktopHeader from "../../../components/DesktopHeader";
import MobileBottomNav from "../../../components/MobileBottomNav";
import { supabase } from "../../../lib/supabase";
import type { AlertData } from "../utils/alertStore";

export default function EmergencyAlertsScreen() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadAlerts = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase
        .from("alerts")
        .select(`
          id,
          status,
          trigger_type,
          location_address,
          created_at,
          resolved_at,
          session:session_id (
            title
          ),
          profiles:user_id (
            full_name,
            avatar_url
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (data) {
        setAlerts(
          data.map((item: any) => ({
            id: item.id,
            userId: (item as any).user_id,
            userName: (item.profiles as any)?.full_name || "Unknown User",
            userAvatar: (item.profiles as any)?.avatar_url || "https://via.placeholder.com/150",
            triggeredAt: item.created_at,
            resolvedAt: item.resolved_at,
            triggerReason: item.trigger_type === "missed_checkin" ? "Missed Check-In" : "SOS Triggered",
            sessionTitle: (item.session as any)?.title || "Safety Session",
            status: item.status === "active" ? "active" : "resolved",
            lastKnownLocation: {
              lat: 0,
              lng: 0,
              address: item.location_address || "Unknown Location",
            },
            batteryLevel: 82,
            signalStrength: "Strong",
          }))
        );
      }
    } catch (e: any) {
      console.error("Error loading alerts:", e);
      setErrorMsg(e.message || "Failed to load alerts feed. Please check connection.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();

    const alertsChannel = supabase
      .channel("emergency-alerts-feed-sync")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "alerts",
        },
        () => {
          loadAlerts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(alertsChannel);
    };
  }, []);

  const filteredAlerts = alerts.filter(alert => {
    // Apply search
    if (searchQuery && !alert.userName.toLowerCase().includes(searchQuery.toLowerCase()) && !alert.sessionTitle.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    
    // Apply filters
    if (activeFilter === "All") return true;
    if (activeFilter === "Resolved") return alert.status === "resolved";
    if (activeFilter === "SOS Triggered") return alert.triggerReason === "SOS Triggered" && alert.status === "active";
    if (activeFilter === "Missed Check-In") return alert.triggerReason === "Missed Check-In" && alert.status === "active";
    
    return true;
  });

  const getAlertIcon = (triggerReason: string) => {
    if (triggerReason === "SOS Triggered") return <Siren size={18} className="text-[#ac2d00]" />;
    return <TimerOff size={18} className="text-[#954831]" />;
  };

  const getStatusBadge = (alert: AlertData) => {
    if (alert.status === "resolved") {
      return <span className="bg-[#fde2dc] text-[#5a413a] text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-tighter">Resolved</span>;
    }
    if (alert.triggerReason === "SOS Triggered") {
      return <span className="bg-[#ac2d00] text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-tighter">Active</span>;
    }
    return <span className="bg-[#ff9c80] text-[#78321d] text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-tighter">Warning</span>;
  };

  const activeCount = alerts.filter(a => a.status === 'active').length;

  return (
    <div className="bg-[#fff8f6] text-[#261814] font-body min-h-screen flex flex-col lg:flex-row">
      {/* Desktop Layout Elements */}
      <div className="hidden lg:flex flex-col min-h-screen w-full">
        <DesktopHeader />
        <DesktopSidebar />

        <main className="ml-64 mt-16 flex-1 flex flex-col h-[calc(100vh-64px)] overflow-hidden">
          {/* Page Title Area */}
          <div className="px-6 py-6 bg-[#fff8f6] flex flex-col gap-1 shrink-0">
            <h2 className="text-[28px] font-semibold text-[#261814]">Emergency Alerts</h2>
            <p className="text-[16px] text-[#5a413a]">Monitor and respond to active safety incidents from your circle.</p>
          </div>

          {/* Dashboard Content */}
          <div className="flex-1 flex flex-col px-6 pb-6 overflow-hidden">
            
            {/* Search & Filters */}
            <div className="flex items-center justify-between gap-4 mb-4 shrink-0">
              <div className="relative w-80">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5a413a]">
                  <Search size={20} />
                </span>
                <input 
                  type="text"
                  placeholder="Search by name or session..." 
                  className="w-full pl-10 pr-4 py-2 bg-[#fff8f6] border border-[#e2bfb5] rounded-lg focus:outline-none focus:border-[#ac2d00] focus:ring-1 focus:ring-[#ac2d00] text-[14px]"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                {["All", "SOS Triggered", "Missed Check-In", "Resolved"].map(filter => (
                  <button 
                    key={filter}
                    onClick={() => setActiveFilter(filter)}
                    className={`px-4 py-2 rounded-full text-[12px] font-semibold transition-colors ${
                      activeFilter === filter 
                        ? "bg-[#ac2d00] text-white" 
                        : "bg-[#fde2dc] text-[#5a413a] border border-[#e2bfb5] hover:bg-[#f7ddd6]"
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            {/* Two-Panel Layout */}
            <div className="flex-1 flex gap-6 overflow-hidden">
              
              {/* Left Panel: Incident List */}
              <div className="w-[400px] flex flex-col gap-3 overflow-y-auto pr-1 shrink-0 pb-10">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-2 text-[#5a413a]">
                    <Loader2 className="animate-spin text-[#ac2d00]" size={28} />
                    <span className="text-[13px] font-medium animate-pulse">Syncing safety alerts feed...</span>
                  </div>
                ) : errorMsg ? (
                  <div className="bg-[#ffdad6] border border-[#ffb4ab] text-[#ba1a1a] p-5 rounded-xl text-[13px] font-semibold text-center shadow-sm">
                    {errorMsg}
                  </div>
                ) : filteredAlerts.length === 0 ? (
                  <div className="text-center py-10 text-[#5a413a]">No incidents found.</div>
                ) : (
                  filteredAlerts.map(alert => {
                    const isResolved = alert.status === "resolved";
                    const isSOS = alert.triggerReason === "SOS Triggered";

                    return (
                      <div 
                        key={alert.id}
                        onClick={() => navigate(`/alerts/${alert.id}`)}
                        className={`p-4 rounded-xl cursor-pointer transition-all active:scale-[0.99] ${
                          isResolved 
                            ? "bg-[#fff8f6]/50 border border-[#e2bfb5] opacity-70 grayscale-[0.5]" 
                            : isSOS 
                              ? "bg-[#fff8f6] border-2 border-[#ac2d00] shadow-sm" 
                              : "bg-[#fff8f6] border border-[#e2bfb5] shadow-sm hover:border-[#954831]"
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex gap-3 items-center">
                            <div className="relative h-12 w-12 shrink-0">
                              {!isResolved && isSOS && (
                                <div className="absolute inset-0 bg-[#ac2d00]/20 rounded-full animate-ping"></div>
                              )}
                              <img 
                                src={alert.userAvatar} 
                                alt={alert.userName} 
                                className={`w-full h-full rounded-full object-cover relative z-10 ${
                                  !isResolved && isSOS ? "border-2 border-[#ac2d00]" : "border border-[#e2bfb5]"
                                }`} 
                              />
                            </div>
                            <div>
                              <h3 className="text-[18px] font-semibold text-[#261814] leading-tight">{alert.userName}</h3>
                              <span className="text-[12px] font-medium text-[#5a413a]">
                                {isResolved ? alert.resolvedAt ? new Date(alert.resolvedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Resolved' : 'Active Now'}
                              </span>
                            </div>
                          </div>
                          {getStatusBadge(alert)}
                        </div>
                        
                        <div className="mt-2">
                          <div className={`flex items-center gap-1.5 font-bold mb-1 ${
                            isResolved ? "text-[#5a413a]" : isSOS ? "text-[#ac2d00]" : "text-[#954831]"
                          }`}>
                            {isResolved ? <CheckCircle size={18} /> : getAlertIcon(alert.triggerReason)}
                            <span className="text-[14px]">{alert.triggerReason}</span>
                          </div>
                          <p className="text-[14px] text-[#5a413a] truncate">Session: "{alert.sessionTitle}"</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Right Panel: Selected Preview (Map Placeholder) */}
              <div className="flex-1 flex flex-col bg-white border border-[#e2bfb5] rounded-xl overflow-hidden shadow-sm">
                <div className="relative h-[240px] w-full bg-[#ffe9e4] overflow-hidden shrink-0 border-b border-[#e2bfb5]">
                   {/* Fake map image for MVP */}
                   <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuDZohXEkMQFnuhiASGnBb1UE0kmkhzsBcFKtJfBqkItujKpz-cWnBFv4eRnQPMoyCuFOuaY4CXJTAPUrFRNJHkpYlmUi8TOmPvBGoTBthDHjiWsXdizmN2cehSUFu5pkBK5GbyD6CNHAXxSBQme00wbgWwyKP6iHCvMswIU3kVZwhJf-aHc-Vwz8NyjYAfNkt7GRYChYQmVsVVSIAPfoToQUEbdUlFCod_WBp7YyAiaaDVEZE4XAFGi-bmwsm0IoPke65Ab_oChrTQ" alt="Map" className="w-full h-full object-cover" />
                   
                   <div className="absolute top-4 right-4 flex flex-col gap-2">
                      <button className="h-10 w-10 bg-white rounded shadow-md flex items-center justify-center text-[#5a413a] hover:text-[#ac2d00]">
                        <ZoomIn size={20} />
                      </button>
                      <button className="h-10 w-10 bg-white rounded shadow-md flex items-center justify-center text-[#5a413a] hover:text-[#ac2d00]">
                        <LocateFixed size={20} />
                      </button>
                   </div>
                </div>

                <div className="p-6 flex-1 flex flex-col items-center justify-center text-center">
                  <Bell size={48} className="text-[#e2bfb5] mb-4" />
                  <h3 className="text-[20px] font-semibold text-[#261814]">Select an incident</h3>
                  <p className="text-[14px] text-[#5a413a] mt-2 max-w-sm">Choose an active alert from the list to view live location tracking, session details, and response options.</p>
                </div>
              </div>

            </div>
          </div>
        </main>
      </div>

      {/* Mobile Layout Elements */}
      <div className="lg:hidden flex-1 flex flex-col min-h-screen">
        {/* Header */}
        <header className="flex justify-between items-center px-4 py-3 sticky top-0 z-50 bg-[#fff8f6] border-b border-[#e2bfb5]">
          <h1 className="text-[22px] text-[#ac2d00] font-bold">Anchor</h1>
          <div className="flex items-center gap-2">
            <button className="p-2 text-[#5a413a]">
              <Bell size={24} />
            </button>
            <div className="h-8 w-8 rounded-full overflow-hidden bg-[#e2bfb5]">
               <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuCACrZsabx0tdl3Xvc-hqAw589uk60sGf6ht8XGXxrrRXYJDT8JGwRh-SJZDkwxCIeqMoWWcaqe_FJM7wJ3WD5Ft2iW7NTHye2yRW1PGnXv3PUV0RMSE43tzE9Iy8lFcs5uJ6pAgZ-O0mRj-zYAjBk3cAot4ND-DRZgc6HFAjsCixASmBMN4iRIMAVsYFr-BxRVJnBaYEfIVzlRNNoWSQU41AUNJOB7G-d-JEcDKQjMVW6hHnAlM19C22A1pLinsZ_dR2XzVN5rDas" alt="Profile" className="w-full h-full object-cover" />
            </div>
          </div>
        </header>

        <div className="p-4 flex flex-col gap-4 mb-20 flex-1">
          <div>
            <h2 className="text-[24px] font-semibold text-[#261814]">Emergency Alerts</h2>
            <p className="text-[14px] text-[#5a413a]">You have {activeCount} active alert{activeCount !== 1 ? 's' : ''}</p>
          </div>

          {/* Search Mobile */}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5a413a]">
              <Search size={18} />
            </span>
            <input 
              type="text"
              placeholder="Search..." 
              className="w-full pl-10 pr-4 py-2 bg-white border border-[#e2bfb5] rounded-lg focus:outline-none focus:border-[#ac2d00] text-[14px]"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
            {["All", "SOS", "Missed", "Resolved"].map(filter => {
              const filterMap: Record<string, string> = {
                "All": "All",
                "SOS": "SOS Triggered",
                "Missed": "Missed Check-In",
                "Resolved": "Resolved"
              };
              const actualFilter = filterMap[filter];
              return (
                <button 
                  key={filter}
                  onClick={() => setActiveFilter(actualFilter)}
                  className={`px-4 py-1.5 rounded-full text-[12px] font-semibold whitespace-nowrap transition-colors ${
                    activeFilter === actualFilter 
                      ? "bg-[#ac2d00] text-white" 
                      : "bg-[#fde2dc] text-[#5a413a] border border-[#e2bfb5]"
                  }`}
                >
                  {filter}
                </button>
              )
            })}
          </div>

          <div className="flex flex-col gap-3">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-[#5a413a]">
                <Loader2 className="animate-spin text-[#ac2d00]" size={28} />
                <span className="text-[13px] font-medium animate-pulse">Syncing safety alerts feed...</span>
              </div>
            ) : errorMsg ? (
              <div className="bg-[#ffdad6] border border-[#ffb4ab] text-[#ba1a1a] p-5 rounded-xl text-[13px] font-semibold text-center shadow-sm">
                {errorMsg}
              </div>
            ) : filteredAlerts.length === 0 ? (
              <div className="text-center py-8 text-[#5a413a]">No incidents found.</div>
            ) : (
              filteredAlerts.map(alert => {
                const isResolved = alert.status === "resolved";
                const isSOS = alert.triggerReason === "SOS Triggered";

                return (
                  <div 
                    key={alert.id}
                    onClick={() => navigate(`/alerts/${alert.id}`)}
                    className={`p-4 rounded-xl cursor-pointer active:scale-[0.98] transition-transform ${
                      isResolved 
                        ? "bg-[#fff8f6]/50 border border-[#e2bfb5] opacity-70 grayscale-[0.5]" 
                        : isSOS 
                          ? "bg-white border-2 border-[#ac2d00] shadow-sm" 
                          : "bg-white border border-[#e2bfb5] shadow-sm"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex gap-3 items-center">
                        <img src={alert.userAvatar} alt={alert.userName} className="w-10 h-10 rounded-full object-cover border border-[#e2bfb5]" />
                        <div>
                          <h3 className="text-[16px] font-semibold text-[#261814]">{alert.userName}</h3>
                          <span className="text-[12px] text-[#5a413a]">
                            {isResolved ? alert.resolvedAt ? new Date(alert.resolvedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Resolved' : 'Active Now'}
                          </span>
                        </div>
                      </div>
                      {getStatusBadge(alert)}
                    </div>
                    
                    <div>
                      <div className={`flex items-center gap-1.5 font-bold mb-1 ${
                        isResolved ? "text-[#5a413a]" : isSOS ? "text-[#ac2d00]" : "text-[#954831]"
                      }`}>
                        {isResolved ? <CheckCircle size={16} /> : getAlertIcon(alert.triggerReason)}
                        <span className="text-[14px]">{alert.triggerReason}</span>
                      </div>
                      <p className="text-[13px] text-[#5a413a] truncate">"{alert.sessionTitle}"</p>
                    </div>
                    
                    <div className="mt-3 flex justify-end">
                      <span className="text-[12px] font-bold text-[#ac2d00] flex items-center gap-1">
                        View Details <ArrowRight size={14} />
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <MobileBottomNav />
      </div>
    </div>
  );
}
