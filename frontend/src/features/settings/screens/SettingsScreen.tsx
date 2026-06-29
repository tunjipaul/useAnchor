import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Edit2, Timer, BellRing, MessageSquare, History, Database, LogOut, Trash2, ChevronRight } from "lucide-react";
import MobileBottomNav from "../../../components/MobileBottomNav";

export default function SettingsScreen() {
  const navigate = useNavigate();

  // Settings State
  const [reminders, setReminders] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(true);

  return (
    <div className="bg-[#fff8f6] text-[#261814] min-h-screen pb-24">
      {/* TopAppBar */}
      <header className="fixed top-0 w-full z-50 bg-[#fff8f6] border-b border-[#e2bfb5] shadow-sm flex justify-between items-center px-4 h-[64px]">
        <div className="flex items-center gap-2">
          <span className="text-[22px] font-bold tracking-tight text-[#ac2d00]">
            useAnchor
          </span>
        </div>
        <div className="w-8 h-8 rounded-full overflow-hidden bg-[#ffe9e4] border border-[#e2bfb5]">
          <img 
            className="w-full h-full object-cover" 
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBlI-aQ9h3y8rnX6D3ph-Y3aO9savvWnHcTRg3MLNXZp4CsQGsYrGNq3xVrmh4OYH3sSK5XahtBA3ZZBkWUqaQvLWboRpI8scrAqW5ZCF1vS_5uDwCr1PAF4fkiIeB1yBOQ6Jw44RciioenkrhLx9Ib_tq08LyDrqwkWMP1yJgYJplYdR9qF4NvR6iqKTgO_Qf191ja2A4rJ-Iytnp282joLPNoKimdoauaAR65M2e1UlMeHSZ35tr5iZZNDPG5R8QXVJ9f-gEO6SU" 
            alt="Profile" 
          />
        </div>
      </header>

      <main className="pt-20 px-4 space-y-6 max-w-[500px] w-full mx-auto">
        {/* Profile Card */}
        <section className="bg-white p-6 rounded-xl border border-[#e2bfb5] flex items-center gap-6 shadow-sm">
          <div className="relative">
            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-[#ac2d00]">
              <img 
                className="w-full h-full object-cover" 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuA6odC1f_aBrxp-V8UlmHpxYb1kObRaSF16YD2PzjIP_SinQ5-YFO59DRAYKnyEA3lVOQtupdvEf2vXdJdbCvzXtWRintpm9341jxxUltycvta6RsWSpaFpcVW3NM2BR4MOdDcsk224hIR4PmOzdliYYs7rY7QOwyzJINsiH-CV6hk4rA-e0NsNfwMquyFIaVIOng9L9U89YP4LvPZisaD5T7F5ZVlFzbBQcSW3gnX2A0n5DHhUw-NMx6yNwTE4_WM64lAVSiSR7Rs" 
                alt="Sarah Mitchell" 
              />
            </div>
            <div className="absolute -bottom-1 -right-1 bg-[#ac2d00] text-white p-1 rounded-full border-2 border-white flex items-center justify-center">
              <Edit2 size={14} />
            </div>
          </div>
          <div>
            <h2 className="text-[18px] font-bold text-[#261814]">Sarah Mitchell</h2>
            <p className="text-[14px] text-[#5a413a]">+1 (555) 012-3456</p>
          </div>
        </section>

        {/* Settings Groups */}
        <div className="space-y-6">
          {/* Group: Check-in Preferences */}
          <div className="space-y-2">
            <h3 className="text-[12px] font-bold tracking-wider uppercase text-[#5a413a] px-1">Check-in Preferences</h3>
            <div className="bg-white rounded-xl border border-[#e2bfb5] overflow-hidden">
              <div className="p-4 flex justify-between items-center border-b border-[#e2bfb5] hover:bg-[#fff1ed] transition-colors cursor-pointer">
                <div className="flex items-center gap-3">
                  <Timer className="text-[#5a413a]" size={20} />
                  <span className="text-[16px] text-[#261814]">Check-in Interval</span>
                </div>
                <div className="flex items-center gap-1 text-[#ac2d00]">
                  <span className="text-[14px] font-semibold">15 mins</span>
                  <ChevronRight size={16} />
                </div>
              </div>
              <div className="p-4 flex justify-between items-center hover:bg-[#fff1ed] transition-colors cursor-pointer">
                <div className="flex items-center gap-3">
                  <BellRing className="text-[#5a413a]" size={20} />
                  <span className="text-[16px] text-[#261814]">Urgent Reminders</span>
                </div>
                <div className="relative inline-block w-10 h-6 align-middle select-none transition duration-200 ease-in">
                  <input 
                    checked={reminders}
                    onChange={(e) => setReminders(e.target.checked)}
                    id="reminders" 
                    name="toggle" 
                    type="checkbox"
                    className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer right-4 border-[#e2bfb5] transition-all" 
                  />
                  <label htmlFor="reminders" className="toggle-label block overflow-hidden h-6 rounded-full bg-[#fde2dc] cursor-pointer"></label>
                </div>
              </div>
            </div>
          </div>

          {/* Group: Notifications */}
          <div className="space-y-2">
            <h3 className="text-[12px] font-bold tracking-wider uppercase text-[#5a413a] px-1">Notifications</h3>
            <div className="bg-white rounded-xl border border-[#e2bfb5] overflow-hidden">
              <div className="p-4 flex justify-between items-center border-b border-[#e2bfb5]">
                <div className="flex items-center gap-3">
                  <BellRing className="text-[#5a413a]" size={20} />
                  <span className="text-[16px] text-[#261814]">Push Notifications</span>
                </div>
                <div className="relative inline-block w-10 h-6 align-middle select-none transition duration-200 ease-in">
                  <input 
                    checked={pushNotifications}
                    onChange={(e) => setPushNotifications(e.target.checked)}
                    id="push" 
                    name="toggle" 
                    type="checkbox"
                    className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer right-4 border-[#e2bfb5] transition-all" 
                  />
                  <label htmlFor="push" className="toggle-label block overflow-hidden h-6 rounded-full bg-[#fde2dc] cursor-pointer"></label>
                </div>
              </div>
              <div className="p-4 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <MessageSquare className="text-[#5a413a]" size={20} />
                  <span className="text-[16px] text-[#261814]">SMS Alerts</span>
                </div>
                <div className="relative inline-block w-10 h-6 align-middle select-none transition duration-200 ease-in">
                  <input 
                    checked={smsAlerts}
                    onChange={(e) => setSmsAlerts(e.target.checked)}
                    id="sms" 
                    name="toggle" 
                    type="checkbox"
                    className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer right-4 border-[#e2bfb5] transition-all" 
                  />
                  <label htmlFor="sms" className="toggle-label block overflow-hidden h-6 rounded-full bg-[#fde2dc] cursor-pointer"></label>
                </div>
              </div>
            </div>
          </div>

          {/* Group: Privacy & Data */}
          <div className="space-y-2">
            <h3 className="text-[12px] font-bold tracking-wider uppercase text-[#5a413a] px-1">Privacy &amp; Data</h3>
            <div className="bg-white rounded-xl border border-[#e2bfb5] overflow-hidden">
              <div 
                onClick={() => navigate('/session/history')}
                className="p-4 flex justify-between items-center border-b border-[#e2bfb5] hover:bg-[#fff1ed] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <History className="text-[#5a413a]" size={20} />
                  <span className="text-[16px] text-[#261814]">Session History</span>
                </div>
                <ChevronRight className="text-[#8e7068]" size={20} />
              </div>
              <div className="p-4 flex justify-between items-center hover:bg-[#fff1ed] transition-colors cursor-pointer">
                <div className="flex items-center gap-3">
                  <Database className="text-[#5a413a]" size={20} />
                  <span className="text-[16px] text-[#261814]">Data Retention</span>
                </div>
                <div className="flex items-center gap-1 text-[#5a413a]">
                  <span className="text-[14px]">30 Days</span>
                  <ChevronRight size={16} />
                </div>
              </div>
            </div>
          </div>

          {/* Group: Account */}
          <div className="space-y-2">
            <h3 className="text-[12px] font-bold tracking-wider uppercase text-[#5a413a] px-1">Account</h3>
            <div className="bg-white rounded-xl border border-[#e2bfb5] overflow-hidden">
              <button 
                onClick={() => navigate('/')}
                className="w-full p-4 flex items-center gap-3 border-b border-[#e2bfb5] hover:bg-[#fff1ed] transition-colors text-[#ac2d00] text-[16px]"
              >
                <LogOut size={20} />
                Sign out
              </button>
              <button className="w-full p-4 flex items-center gap-3 hover:bg-[#ffdad6] transition-colors text-[#ba1a1a] text-[16px]">
                <Trash2 size={20} />
                Delete Account
              </button>
            </div>
          </div>
        </div>

        {/* App Info */}
        <div className="text-center pb-8 pt-4">
          <p className="text-[12px] font-bold text-[#5a413a]">useAnchor Premium v2.4.0</p>
          <p className="text-[12px] font-bold text-[#8e7068] mt-1">Always protected, always reliable.</p>
        </div>
      </main>

      <MobileBottomNav />
    </div>
  );
}
