import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Bell, Mic, ShieldAlert, CheckCircle2, ChevronRight } from "lucide-react";
import { usePushNotifications } from "../../session/hooks/usePushNotifications";
import { useAuthStore } from "../../auth/stores/useAuthStore";


export default function PermissionsScreen() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  const [locationStatus, setLocationStatus] = useState<PermissionState | "prompt">("prompt");
  const [notificationStatus, setNotificationStatus] = useState<PermissionState | "prompt">("prompt");
  const [micStatus, setMicStatus] = useState<PermissionState | "prompt">("prompt");

  const { requestNotificationPermission } = usePushNotifications();
  const updateFcmToken = useAuthStore((state) => state.updateFcmToken);

  // Sync initial permission states on load
  useEffect(() => {
    // Geolocation API check
    if ("geolocation" in navigator) {
      navigator.permissions.query({ name: "geolocation" as PermissionName }).then((result) => {
        setLocationStatus(result.state);
        result.onchange = () => setLocationStatus(result.state);
      }).catch(() => {
        // Fallback if query not supported
      });
    }

    // Notification API check
    if ("Notification" in window) {
      if (Notification.permission === "granted") {
        setNotificationStatus("granted");
      } else if (Notification.permission === "denied") {
        setNotificationStatus("denied");
      } else {
        setNotificationStatus("prompt");
      }
    }

    // Microphone API check
    if (navigator.permissions) {
      navigator.permissions.query({ name: "microphone" as PermissionName }).then((result) => {
        setMicStatus(result.state);
        result.onchange = () => setMicStatus(result.state);
      }).catch(() => {
        // Fallback
      });
    }
  }, []);

  function requestLocation() {
    if (!navigator.geolocation) return;
    setLocationStatus("prompt");
    navigator.geolocation.getCurrentPosition(
      () => setLocationStatus("granted"),
      () => setLocationStatus("denied"),
      { enableHighAccuracy: true }
    );
  }

  async function requestNotifications() {
    if (!("Notification" in window)) return;
    try {
      const token = await requestNotificationPermission();
      if (token || Notification.permission === "granted") {
        setNotificationStatus("granted");
        if (token && user) {
          await updateFcmToken(token);
        }
      } else {
        setNotificationStatus("denied");
      }
    } catch (e) {
      setNotificationStatus("denied");
    }
  }

  function requestMicrophone() {
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        setMicStatus("granted");
        // Immediately release microphone
        stream.getTracks().forEach((track) => track.stop());
      })
      .catch(() => {
        setMicStatus("denied");
      });
  }

  const isLocationRequired = "geolocation" in navigator;
  const isNotificationRequired = "Notification" in window;

  const isLocationReady = !isLocationRequired || locationStatus === "granted";
  const isNotificationReady = !isNotificationRequired || notificationStatus === "granted";

  const isRequiredPermissionsGranted = isLocationReady && isNotificationReady;

  return (
    <div
      className="flex-1 flex flex-col items-center justify-start px-4 overflow-y-auto"
      style={{ backgroundColor: "#fff8f6" }}
    >
      {/* Mobile wrapper */}
      <main className="w-full max-w-[390px] min-h-[700px] flex flex-col justify-between py-8">
        
        {/* Top Header */}
        <header className="w-full flex items-center justify-between px-2 mb-6">
          <button
            onClick={() => navigate("/auth/trusted-contacts")}
            aria-label="Go back"
            className="text-primary hover:opacity-80 transition-opacity active:scale-95 transition-transform flex items-center justify-center"
            style={{ color: "#ac2d00" }}
          >
            <ArrowLeft size={20} />
          </button>
          <span className="text-[20px] font-bold tracking-tight text-[#ac2d00]">
            Safety
          </span>
          <div className="w-6" />
        </header>

        {/* Content Canvas */}
        <div className="flex-1 flex flex-col justify-start px-2 w-full">
          {/* Progress Indicator */}
          <div className="flex flex-col gap-1 mb-8">
            <div className="flex justify-between items-end">
              <span className="text-[12px] font-semibold text-[#5a413a] uppercase tracking-widest">
                Setup Progress
              </span>
              <span className="text-[12px] font-bold text-[#ac2d00]">Step 5 of 5 (100%)</span>
            </div>
            <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "#f7ddd6" }}>
              <div className="h-full rounded-full transition-all duration-300" style={{ width: "100%", backgroundColor: "#ac2d00" }} />
            </div>
          </div>

          {/* Heading */}
          <div className="mb-6">
            <h1 className="text-[28px] font-semibold leading-tight text-[#261814] mb-2">
              Final steps
            </h1>
            <p className="text-[16px] leading-[22px]" style={{ color: "#5a413a" }}>
              We need a few permissions to ensure your safety features work reliably whenever you need them.
            </p>
          </div>

          {/* Cards Stack */}
          <div className="space-y-4">
            
            {/* Card 1: Location */}
            <div className="p-4 bg-white border border-[#e2bfb5] rounded-xl flex items-start gap-4 shadow-sm">
              <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 bg-[#ffe9e4]">
                <MapPin size={24} style={{ color: "#ac2d00" }} />
              </div>
              <div className="flex-grow">
                <div className="flex justify-between items-center mb-1">
                  <h2 className="text-[16px] font-semibold text-[#261814] leading-tight">Location</h2>
                  {locationStatus === "granted" && (
                    <CheckCircle2 size={18} className="text-[#1D9E75] fill-[#1D9E75] text-white" />
                  )}
                </div>
                <p className="text-[13px] text-[#5a413a] mb-3 leading-snug">
                  Needed to share your location during an active session
                </p>
                {locationStatus === "granted" ? (
                  <span className="text-[#1D9E75] text-[12px] font-bold tracking-wider">GRANTED</span>
                ) : (
                  <button
                    onClick={requestLocation}
                    className="w-full h-10 border-2 rounded-lg text-[14px] font-bold hover:bg-[#ffe9e4]/30 active:scale-95 transition-transform"
                    style={{ borderColor: "#ac2d00", color: "#ac2d00" }}
                  >
                    Allow
                  </button>
                )}
              </div>
            </div>

            {/* Card 2: Notifications */}
            <div className="p-4 bg-white border border-[#e2bfb5] rounded-xl flex items-start gap-4 shadow-sm">
              <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 bg-[#ffe9e4]">
                <Bell size={24} style={{ color: "#ac2d00" }} />
              </div>
              <div className="flex-grow">
                <div className="flex justify-between items-center mb-1">
                  <h2 className="text-[16px] font-semibold text-[#261814] leading-tight">Notifications</h2>
                  {notificationStatus === "granted" && (
                    <CheckCircle2 size={18} className="text-[#1D9E75] fill-[#1D9E75] text-white" />
                  )}
                </div>
                <p className="text-[13px] text-[#5a413a] mb-3 leading-snug">
                  Needed for safety check-ins and emergency alerts
                </p>
                {notificationStatus === "granted" ? (
                  <span className="text-[#1D9E75] text-[12px] font-bold tracking-wider">GRANTED</span>
                ) : (
                  <button
                    onClick={requestNotifications}
                    className="w-full h-10 border-2 rounded-lg text-[14px] font-bold hover:bg-[#ffe9e4]/30 active:scale-95 transition-transform"
                    style={{ borderColor: "#ac2d00", color: "#ac2d00" }}
                  >
                    Allow
                  </button>
                )}
              </div>
            </div>

            {/* Card 3: Microphone */}
            <div className="p-4 bg-white border border-[#e2bfb5] rounded-xl flex items-start gap-4 shadow-sm">
              <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 bg-[#ffe9e4]">
                <Mic size={24} style={{ color: "#ac2d00" }} />
              </div>
              <div className="flex-grow">
                <div className="flex justify-between items-center mb-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-[16px] font-semibold text-[#261814] leading-tight">Microphone</h2>
                    <span className="text-[10px] px-2 py-0.5 rounded-full uppercase bg-[#f7ddd6] text-[#5a413a] font-bold">
                      Optional
                    </span>
                  </div>
                  {micStatus === "granted" && (
                    <CheckCircle2 size={18} className="text-[#1D9E75] fill-[#1D9E75] text-white" />
                  )}
                </div>
                <p className="text-[13px] text-[#5a413a] mb-3 leading-snug">
                  Needed for the Voice Safe Word feature
                </p>
                {micStatus === "granted" ? (
                  <span className="text-[#1D9E75] text-[12px] font-bold tracking-wider">GRANTED</span>
                ) : (
                  <button
                    onClick={requestMicrophone}
                    className="w-full h-10 border-2 rounded-lg text-[14px] font-bold hover:bg-[#ffe9e4]/30 active:scale-95 transition-transform"
                    style={{ borderColor: "#ac2d00", color: "#ac2d00" }}
                  >
                    Allow
                  </button>
                )}
              </div>
            </div>

          </div>

          {/* Privacy Assurance */}
          <div className="mt-6 flex gap-3 p-4 rounded-xl bg-[#ffe9e4] border border-[#e2bfb5]">
            <ShieldAlert size={20} className="shrink-0 mt-0.5" style={{ color: "#ac2d00" }} />
            <p className="text-[14px] leading-5 text-[#5a413a]">
              Your data is encrypted and only shared with your emergency contacts during active alerts.
            </p>
          </div>
        </div>

        {/* Footer actions */}
        <div className="w-full px-2 pt-8 flex flex-col gap-2">
          {!isRequiredPermissionsGranted && (
            <p className="text-[12px] font-bold text-[#ba1a1a] text-center mb-1 animate-pulse">
              * Location and Notification permissions are required to finish setup.
            </p>
          )}
          <button
            onClick={() => {
              if (isRequiredPermissionsGranted) {
                navigate("/dashboard");
              }
            }}
            disabled={!isRequiredPermissionsGranted}
            className="w-full h-[56px] rounded-xl flex items-center justify-center gap-2 font-semibold text-[18px] text-white active:scale-95 transition-all shadow-lg disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
            style={{
              backgroundColor: isRequiredPermissionsGranted ? "#ac2d00" : "#a88a83",
              boxShadow: isRequiredPermissionsGranted ? "0 4px 16px rgba(172, 45, 0, 0.25)" : "none",
            }}
          >
            <span>Finish Setup</span>
            <ChevronRight size={20} />
          </button>
        </div>

      </main>
    </div>
  );
}
