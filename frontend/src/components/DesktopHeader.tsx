import { useState, useEffect } from "react";
import { Bell, Search, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../features/auth/stores/useAuthStore";
import { apiFetch } from "../lib/api";

interface DesktopHeaderProps {
  showSearch?: boolean;
  searchPlaceholder?: string;
  onSearchChange?: (val: string) => void;
  searchValue?: string;
}

export default function DesktopHeader({
  showSearch = false,
  searchPlaceholder = "Search...",
  onSearchChange,
  searchValue = "",
}: DesktopHeaderProps) {
  const navigate = useNavigate();
  const profile = useAuthStore((state) => state.profile);
  const avatarInitial = profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : "U";

  const [activeAlertsCount, setActiveAlertsCount] = useState(0);
  const [isTriggeringSOS, setIsTriggeringSOS] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Sync active alerts count
  useEffect(() => {
    // Mocking for MVP
    setActiveAlertsCount(0);
  }, [profile?.id]);

  const handleEmergencySOS = async () => {
    if (isTriggeringSOS || !profile?.id) return;
    setIsTriggeringSOS(true);

    try {
      // 1. Check if there is an active or emergency session
      const currentSession = await apiFetch<any>("/sessions/active").catch(() => null);
      let targetSessionId = currentSession?.id;

      if (currentSession?.status === "emergency" || currentSession?.status === "sos") {
        navigate("/session/sos");
        return;
      }

      if (!targetSessionId) {
        const now = new Date();
        const expectedEnd = new Date(now.getTime() + 30 * 60000).toISOString();
        
        const newSession = await apiFetch<any>("/sessions", {
          method: "POST",
          body: JSON.stringify({
            title: "Quick SOS Alert",
            expected_end: expectedEnd,
            checkin_interval_minutes: 15,
            meet_person: "Emergency",
            destination_address: "Quick SOS Location"
          })
        });
        targetSessionId = newSession.id;

        await apiFetch(`/sessions/${targetSessionId}/start`, { 
          method: "POST", 
          body: JSON.stringify({ p_session_id: targetSessionId, p_current_version: 1 }) 
        });
      }

      await apiFetch("/alerts/trigger", {
        method: "POST",
        body: JSON.stringify({
          p_session_id: targetSessionId,
          p_trigger_type: "manual_sos",
          p_lat: 0.0,
          p_lng: 0.0,
          p_accuracy: 1.0,
          p_address: "Quick SOS Location",
        })
      });

      // 3. Navigate to SOS Activated Screen
      navigate("/session/sos");
    } catch (err: any) {
      console.error("Emergency SOS activation failed:", err);
      triggerToast(err.message || "Failed to trigger Emergency SOS. Please check connection.");
    } finally {
      setIsTriggeringSOS(false);
    }
  };

  return (
    <header className="fixed top-0 left-0 w-full h-16 bg-white border-b border-[#e2bfb5] flex justify-between items-center px-6 z-50">
      <div className="flex items-center gap-3">
        <span className="text-[22px] font-bold tracking-tight text-[#ac2d00] cursor-pointer" onClick={() => navigate("/dashboard")}>useAnchor</span>
      </div>
      
      {/* Search Bar */}
      {showSearch && (
        <div className="hidden md:flex items-center flex-1 max-w-md mx-8 relative">
          <div className="absolute left-3 text-[#a88a83]">
            <Search size={18} />
          </div>
          <input 
            type="text" 
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="w-full bg-[#fdfaf9] border border-[#e2bfb5] rounded-full py-2 pl-10 pr-4 text-sm text-[#5a413a] focus:outline-none focus:ring-2 focus:ring-[#e2bfb5] focus:border-transparent placeholder-[#a88a83]"
          />
        </div>
      )}

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => navigate("/alerts")}
            className="p-2 text-[#5a413a] hover:bg-[#ffe9e4] rounded-full transition-colors relative"
            title="Emergency Alerts"
          >
            <Bell size={20} />
            {activeAlertsCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-[#ba1a1a] text-white rounded-full flex items-center justify-center font-bold text-[9px] animate-pulse">
                {activeAlertsCount}
              </span>
            )}
          </button>
          <div className="h-8 w-8 flex items-center justify-center rounded-full overflow-hidden border border-[#e2bfb5] bg-[#ffe9e4] text-[#ac2d00] font-bold text-sm">
            {avatarInitial}
          </div>
        </div>
        
        <button 
          onClick={handleEmergencySOS}
          disabled={isTriggeringSOS}
          className="bg-[#ac2d00] hover:bg-[#902600] disabled:bg-[#ac2d00]/70 text-white px-4 py-1.5 rounded-lg font-bold text-sm active:scale-95 transition-all flex items-center justify-center gap-2 min-w-[130px]"
        >
          {isTriggeringSOS ? (
            <>
              <Loader2 className="animate-spin" size={16} />
              <span>Triggering...</span>
            </>
          ) : (
            <span>Emergency SOS</span>
          )}
        </button>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-[100] bg-[#ba1a1a] text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 font-semibold text-[13px] border border-[#ba1a1a]/20 max-w-[340px] animate-pulse">
          <div className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />
          <span className="flex-1 text-left">{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-white/85 hover:text-white font-bold ml-2 text-[16px] leading-none">×</button>
        </div>
      )}
    </header>
  );
}
