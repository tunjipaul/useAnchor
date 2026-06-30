import { Bell, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";

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

  return (
    <header className="fixed top-0 left-0 w-full h-16 bg-white border-b border-[#e2bfb5] flex justify-between items-center px-6 z-50">
      <div className="flex items-center gap-3">
        <span className="text-[22px] font-bold tracking-tight text-[#ac2d00]">useAnchor</span>
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
          <button className="p-2 text-[#5a413a] hover:bg-[#ffe9e4] rounded-full transition-colors">
            <Bell size={20} />
          </button>
          <div className="h-8 w-8 rounded-full overflow-hidden border border-[#e2bfb5]">
            <img 
              className="w-full h-full object-cover" 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDE-qaqUbues0QP3_CpX_doFGBr6379MEUheKjEltx7apQeEfjMGA4A659vVa0qosViwGjnSWODIVfZlIeq7GPxHSFlSRF4h0xOLw-P7zS211mDZoMLAUd-ACqOWTY9ijw7CzNnMGpwAU3y0mM8pl_eJMLX5LMkVCYJ2R8SqdRB639BiS3MvE8hb6-luGjfGTlYgE34Kh3K3I1YW6AyXIFOJvwd5yfjCLwS2mTlshMNLRUaUu0Ey4wUy7QLlfmpR9v54J7VUpqXZsc" 
              alt="Profile" 
            />
          </div>
        </div>
        
        <button 
          onClick={() => navigate("/session/sos")}
          className="bg-[#ac2d00] text-white px-4 py-1.5 rounded-lg font-bold text-sm active:scale-95 transition-transform"
        >
          Emergency SOS
        </button>
      </div>
    </header>
  );
}
