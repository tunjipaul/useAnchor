import { useNavigate, useLocation } from "react-router-dom";
import { Home, Activity, Users, Settings } from "lucide-react";

export default function MobileBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const currentPath = location.pathname;

  return (
    <nav className="fixed bottom-0 left-0 w-full bg-white border-t border-[#e2bfb5] flex justify-around items-center h-[70px] pb-safe z-50 lg:hidden">
      <button
        onClick={() => navigate("/dashboard")}
        className={`flex flex-col items-center justify-center w-full h-full ${currentPath === "/dashboard" ? "text-[#ac2d00]" : "text-[#5a413a]"}`}
      >
        <Home size={24} />
        <span
          className={`text-[10px] mt-1 ${currentPath === "/dashboard" ? "font-bold" : "font-medium"}`}
        >
          Home
        </span>
      </button>
      <button
        onClick={() => navigate("/session/history")}
        className={`flex flex-col items-center justify-center w-full h-full ${currentPath.includes("/session") ? "text-[#ac2d00]" : "text-[#5a413a]"}`}
      >
        <Activity size={24} />
        <span
          className={`text-[10px] mt-1 ${currentPath.includes("/session") ? "font-bold" : "font-medium"}`}
        >
          Sessions
        </span>
      </button>
      <button
        onClick={() => navigate("/contacts")}
        className={`flex flex-col items-center justify-center w-full h-full ${currentPath === "/contacts" ? "text-[#ac2d00]" : "text-[#5a413a]"}`}
      >
        <Users size={24} />
        <span
          className={`text-[10px] mt-1 ${currentPath === "/contacts" ? "font-bold" : "font-medium"}`}
        >
          Contacts
        </span>
      </button>
      <button
        onClick={() => navigate("/settings")}
        className={`flex flex-col items-center justify-center w-full h-full ${currentPath === "/settings" ? "text-[#ac2d00]" : "text-[#5a413a]"}`}
      >
        <Settings size={24} />
        <span
          className={`text-[10px] mt-1 ${currentPath === "/settings" ? "font-bold" : "font-medium"}`}
        >
          Settings
        </span>
      </button>
    </nav>
  );
}
