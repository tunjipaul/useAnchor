import { useNavigate, useLocation } from "react-router-dom";
import { Home, Activity, Users, Settings, Siren } from "lucide-react";

export default function DesktopSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <aside className="fixed left-0 top-16 h-[calc(100vh-64px)] w-64 bg-[#fff1ed] flex flex-col py-4 gap-2 border-r border-[#e2bfb5] z-40">


      <nav className="flex flex-col flex-grow px-2 gap-1">
        <button
          onClick={() => navigate("/dashboard")}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 w-full text-left ${
            currentPath === "/dashboard"
              ? "bg-[#fde2dc]/60 text-[#ac2d00] font-bold"
              : "text-[#5a413a] hover:bg-[#fde2dc] hover:text-[#ac2d00]"
          }`}
        >
          <Home size={20} />
          <span className="text-[15px]">Home Dashboard</span>
        </button>
        <button
          onClick={() => navigate("/session/history")}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 w-full text-left ${
            currentPath.includes("/session")
              ? "bg-[#fde2dc]/60 text-[#ac2d00] font-bold"
              : "text-[#5a413a] hover:bg-[#fde2dc] hover:text-[#ac2d00]"
          }`}
        >
          <Activity size={20} />
          <span className="text-[15px]">Sessions</span>
        </button>
        <button
          onClick={() => navigate("/contacts")}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 w-full text-left ${
            currentPath.includes("/contacts")
              ? "bg-[#fde2dc]/60 text-[#ac2d00] font-bold"
              : "text-[#5a413a] hover:bg-[#fde2dc] hover:text-[#ac2d00]"
          }`}
        >
          <Users size={20} />
          <span className="text-[15px]">Contacts</span>
        </button>
        <button
          onClick={() => navigate("/settings")}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 w-full text-left ${
            currentPath.includes("/settings")
              ? "bg-[#fde2dc]/60 text-[#ac2d00] font-bold"
              : "text-[#5a413a] hover:bg-[#fde2dc] hover:text-[#ac2d00]"
          }`}
        >
          <Settings size={20} />
          <span className="text-[15px]">Settings</span>
        </button>
      </nav>

      <div className="mt-auto px-3 pt-4 border-t border-[#e2bfb5]">
        <button
          onClick={() => navigate("/session/new")}
          className="w-full bg-[#ac2d00] text-white py-3 rounded-lg font-bold shadow-md hover:bg-[#8a2400] active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <Siren size={18} />
          Start New Session
        </button>
      </div>
    </aside>
  );
}
