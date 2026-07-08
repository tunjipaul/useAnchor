import { useState, useEffect } from "react";
import { Bell, Search, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../features/auth/stores/useAuthStore";
import { supabase } from "../lib/supabase";

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
  const avatarUrl = profile?.avatar_url || "https://via.placeholder.com/150";

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
    if (!profile?.id) return;

    const fetchAlertCount = async () => {
      try {
        const { count, error } = await supabase
          .from("alerts")
          .select("id", { count: "exact", head: true })
          .eq("status", "active");

        if (!error && count !== null) {
          setActiveAlertsCount(count);
        }
      } catch (err) {
        console.error("Error fetching alert count:", err);
      }
    };

    fetchAlertCount();

    // Listen for alert changes in real-time
    const channel = supabase
      .channel("header-alerts-count")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "alerts",
        },
        () => {
          fetchAlertCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  const handleEmergencySOS = async () => {
    if (isTriggeringSOS || !profile?.id) return;
    setIsTriggeringSOS(true);

    try {
      // 1. Check if there is an active or emergency session
      const { data: currentSession, error: sessionFetchError } = await supabase
        .from("anchor_sessions")
        .select("id, status")
        .eq("user_id", profile.id)
        .in("status", ["active", "emergency"])
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sessionFetchError) throw sessionFetchError;

      let targetSessionId = currentSession?.id;

      // If the active session is already in emergency, go straight to the SOS view
      if (currentSession?.status === "emergency") {
        navigate("/session/sos");
        return;
      }

      // If we don't have an active session, create a default emergency one
      if (!targetSessionId) {
        const now = new Date();
        const durationMinutes = 30;
        const expectedEnd = new Date(now.getTime() + durationMinutes * 60000).toISOString();

        const { data: newSession, error: insertError } = await supabase
          .from("anchor_sessions")
          .insert({
            user_id: profile.id,
            title: "Quick SOS Alert",
            expected_end: expectedEnd,
            checkin_interval_minutes: 15,
            status: "draft",
            source_client: "web",
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
          })
          .select()
          .single();

        if (insertError) throw insertError;
        if (!newSession) throw new Error("Failed to create quick SOS session.");

        targetSessionId = newSession.id;

        // Auto-link any trusted contacts
        const { data: contacts } = await supabase
          .from("trusted_contacts")
          .select("id")
          .eq("user_id", profile.id);

        if (contacts && contacts.length > 0) {
          const { error: contactsError } = await supabase.rpc("add_session_contacts", {
            p_user_id: profile.id,
            p_session_id: targetSessionId,
            p_trusted_contact_ids: contacts.map((c: any) => c.id),
          });
          if (contactsError) throw contactsError;
        }

        // Start the session
        const { error: startError } = await supabase.rpc("start_anchor_session", {
          p_user_id: profile.id,
          p_session_id: targetSessionId,
          p_current_version: 1,
        });
        if (startError) throw startError;
      }

      // 2. Trigger the active emergency alert (Manual SOS)
      const { error: triggerError } = await supabase.rpc("trigger_alert", {
        p_user_id: profile.id,
        p_session_id: targetSessionId,
        p_trigger_type: "manual_sos",
        p_lat: 0.0,
        p_lng: 0.0,
        p_accuracy: 1.0,
        p_address: "Quick SOS Location",
      });
      if (triggerError) throw triggerError;

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
          <div className="h-8 w-8 rounded-full overflow-hidden border border-[#e2bfb5]">
            <img 
              className="w-full h-full object-cover" 
              src={avatarUrl} 
              alt="Profile" 
            />
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
