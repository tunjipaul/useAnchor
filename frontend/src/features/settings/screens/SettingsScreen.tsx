import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Edit2, LogOut, Trash2, ArrowLeft, Bell, Siren, User, Lock, Mic,
  MapPin, AlertCircle, Info, Home, Activity, Users, Settings, ChevronRight,
} from "lucide-react";
import MobileBottomNav from "../../../components/MobileBottomNav";
import DesktopHeader from "../../../components/DesktopHeader";
import DesktopSidebar from "../../../components/DesktopSidebar";

type SettingsTab = "profile" | "contacts" | "notifications" | "voice" | "power" | "privacy" | "about";

export default function SettingsScreen() {
  const navigate = useNavigate();

  // Mobile state
  const [reminders, setReminders] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(true);

  // Desktop state
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [criticalAlerts, setCriticalAlerts] = useState(true);
  const [bgLocation, setBgLocation] = useState(true);

  const sideNavItems: { key: SettingsTab; label: string; Icon: React.ElementType }[] = [
    { key: "profile", label: "Profile", Icon: User },
    { key: "notifications", label: "Notifications", Icon: Bell },
    { key: "voice", label: "Voice Safe Word", Icon: Mic },
    { key: "power", label: "Power Button Trigger", Icon: Siren },
    { key: "privacy", label: "Privacy", Icon: Lock },
  ];

  return (
    <div className="bg-[#fff8f6] text-[#261814] min-h-screen">

      {/* ============================= */}
      {/*    MOBILE LAYOUT (lg:hidden)  */}
      {/* ============================= */}
      <div className="block lg:hidden pb-24">
        {/* TopAppBar */}
        <header className="fixed top-0 w-full z-50 bg-[#fff8f6] border-b border-[#e2bfb5] shadow-sm flex justify-between items-center px-4 h-[64px]">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(-1)}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#ffe9e4] active:scale-95 transition-all text-[#ac2d00]"
              aria-label="Go back"
            >
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-[22px] font-bold tracking-tight text-[#ac2d00]">Settings</h1>
          </div>
          
          <div className="flex items-center gap-3">
            <button className="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-[#e2bfb5] text-[#5a413a] hover:bg-[#ffe9e4] hover:text-[#ac2d00] transition-colors">
              <Bell size={18} />
            </button>
            <div className="w-8 h-8 rounded-full overflow-hidden bg-[#ffe9e4] border border-[#e2bfb5]">
              <img
                className="w-full h-full object-cover"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBlI-aQ9h3y8rnX6D3ph-Y3aO9savvWnHcTRg3MLNXZp4CsQGsYrGNq3xVrmh4OYH3sSK5XahtBA3ZZBkWUqaQvLWboRpI8scrAqW5ZCF1vS_5uDwCr1PAF4fkiIeB1yBOQ6Jw44RciioenkrhLx9Ib_tq08LyDrqwkWMP1yJgYJplYdR9qF4NvR6iqKTgO_Qf191ja2A4rJ-Iytnp282joLPNoKimdoauaAR65M2e1UlMeHSZ35tr5iZZNDPG5R8QXVJ9f-gEO6SU"
                alt="Profile"
              />
            </div>
          </div>
        </header>

        <main className="pt-20 px-4 space-y-6 max-w-[500px] w-full mx-auto">
          {/* Profile Section */}
          <section className="bg-white rounded-xl border border-[#e2bfb5] p-5 shadow-sm space-y-5">
            <div>
              <h2 className="text-[16px] font-bold text-[#261814]">Profile Information</h2>
              <p className="text-[13px] text-[#5a413a] mt-0.5">Update your personal details and contact information.</p>
            </div>
            {/* Avatar row */}
            <div className="flex items-center gap-4 pb-5 border-b border-[#e2bfb5]">
              <div className="relative">
                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-[#ffdbd1]">
                  <img
                    className="w-full h-full object-cover"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuA6odC1f_aBrxp-V8UlmHpxYb1kObRaSF16YD2PzjIP_SinQ5-YFO59DRAYKnyEA3lVOQtupdvEf2vXdJdbCvzXtWRintpm9341jxxUltycvta6RsWSpaFpcVW3NM2BR4MOdDcsk224hIR4PmOzdliYYs7rY7QOwyzJINsiH-CV6hk4rA-e0NsNfwMquyFIaVIOng9L9U89YP4LvPZisaD5T7F5ZVlFzbBQcSW3gnX2A0n5DHhUw-NMx6yNwTE4_WM64lAVSiSR7Rs"
                    alt="Sarah Mitchell"
                  />
                </div>
                <button className="absolute -bottom-1 -right-1 p-1 bg-[#ac2d00] text-white rounded-full border-2 border-white shadow-md">
                  <Edit2 size={12} />
                </button>
              </div>
              <div>
                <h3 className="text-[16px] font-semibold text-[#261814]">Sarah Mitchell</h3>
                <p className="text-[13px] text-[#5a413a]">Member since Jan 2024</p>
              </div>
            </div>
            {/* Form fields */}
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#5a413a] block">Full Name</label>
                <input className="w-full px-3 py-3 border border-[#e2bfb5] rounded-xl focus:border-[#ac2d00] focus:ring-1 focus:ring-[#ac2d00] bg-[#fff8f6] text-[#261814] outline-none transition-all text-[15px]" type="text" defaultValue="Sarah Mitchell" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#5a413a] block">Email Address</label>
                <input className="w-full px-3 py-3 border border-[#e2bfb5] rounded-xl focus:border-[#ac2d00] focus:ring-1 focus:ring-[#ac2d00] bg-[#fff8f6] text-[#261814] outline-none transition-all text-[15px]" type="email" defaultValue="sarah.m@guardian.com" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#5a413a] block">Phone Number</label>
                <input className="w-full px-3 py-3 border border-[#e2bfb5] rounded-xl focus:border-[#ac2d00] focus:ring-1 focus:ring-[#ac2d00] bg-[#fff8f6] text-[#261814] outline-none transition-all text-[15px]" type="tel" defaultValue="+1 (555) 012-3456" />
              </div>
            </div>
            {/* Save/Cancel */}
            <div className="flex gap-3 pt-2 border-t border-[#e2bfb5]">
              <button className="flex-1 py-3 text-[#5a413a] font-bold border border-[#e2bfb5] rounded-xl hover:bg-[#fff1ed] transition-colors text-[15px]">Cancel</button>
              <button className="flex-1 py-3 bg-[#ac2d00] text-white font-bold rounded-xl hover:bg-[#8a2400] active:scale-[0.98] transition-all text-[15px]">Save Changes</button>
            </div>
          </section>

          {/* Safety Preferences */}
          <div className="space-y-2">
            <h3 className="text-[12px] font-bold tracking-wider uppercase text-[#5a413a] px-1">Safety Preferences</h3>
            <div className="bg-white rounded-xl border border-[#e2bfb5] overflow-hidden">
              <div className="p-4 flex justify-between items-center border-b border-[#e2bfb5]">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-[#007caf]/10 flex items-center justify-center text-[#007caf] shrink-0">
                    <AlertCircle size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[14px] font-bold text-[#261814]">Critical Alert Notifications</p>
                    <p className="text-[12px] text-[#5a413a]">Allow sound even if Do Not Disturb is active</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer ml-3 shrink-0">
                  <input type="checkbox" checked={criticalAlerts} onChange={(e) => setCriticalAlerts(e.target.checked)} className="sr-only peer" />
                  <div className="w-11 h-6 bg-[#e2bfb5] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#ac2d00]"></div>
                </label>
              </div>
              <div className="p-4 flex justify-between items-center">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-[#ac2d00]/10 flex items-center justify-center text-[#ac2d00] shrink-0">
                    <MapPin size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[14px] font-bold text-[#261814]">Background Location Access</p>
                    <p className="text-[12px] text-[#5a413a]">Required for tracking during active sessions</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer ml-3 shrink-0">
                  <input type="checkbox" checked={bgLocation} onChange={(e) => setBgLocation(e.target.checked)} className="sr-only peer" />
                  <div className="w-11 h-6 bg-[#e2bfb5] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#ac2d00]"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Notifications */}
          <div className="space-y-2">
            <h3 className="text-[12px] font-bold tracking-wider uppercase text-[#5a413a] px-1">Notifications</h3>
            <div className="bg-white rounded-xl border border-[#e2bfb5] overflow-hidden">
              {[
                { label: "Push Notifications", desc: "Receive app push alerts on your device", state: pushNotifications, setter: setPushNotifications, id: "mob2-push" },
                { label: "SMS Alerts", desc: "Get text messages for critical events", state: smsAlerts, setter: setSmsAlerts, id: "mob2-sms" },
                { label: "Urgent Reminders", desc: "Escalate missed check-ins with repeated alerts", state: reminders, setter: setReminders, id: "mob2-rem" },
              ].map(({ label, desc, state, setter, id }, i, arr) => (
                <div key={id} className={`p-4 flex justify-between items-center ${i < arr.length - 1 ? "border-b border-[#e2bfb5]" : ""}`}>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-bold text-[#261814]">{label}</p>
                    <p className="text-[12px] text-[#5a413a]">{desc}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer ml-3 shrink-0">
                    <input type="checkbox" checked={state} onChange={(e) => setter(e.target.checked)} className="sr-only peer" />
                    <div className="w-11 h-6 bg-[#e2bfb5] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#ac2d00]"></div>
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Advanced Triggers */}
          <div className="space-y-2">
            <h3 className="text-[12px] font-bold tracking-wider uppercase text-[#5a413a] px-1">Advanced Triggers</h3>
            <div className="bg-white rounded-xl border border-[#e2bfb5] overflow-hidden">
              <div className="p-4 flex items-center justify-between border-b border-[#e2bfb5] hover:bg-[#fff1ed] transition-colors cursor-pointer">
                <div className="flex items-center gap-3 text-[#261814]">
                  <Mic size={20} className="text-[#5a413a]" />
                  <span className="text-[15px] font-bold">Voice Safe Word</span>
                </div>
                <ChevronRight size={18} className="text-[#8e7068]" />
              </div>
              <div className="p-4 flex items-center justify-between hover:bg-[#fff1ed] transition-colors cursor-pointer">
                <div className="flex items-center gap-3 text-[#261814]">
                  <Siren size={20} className="text-[#5a413a]" />
                  <span className="text-[15px] font-bold">Power Button Trigger</span>
                </div>
                <ChevronRight size={18} className="text-[#8e7068]" />
              </div>
            </div>
          </div>

          {/* Privacy & Data */}
          <div className="space-y-2">
            <h3 className="text-[12px] font-bold tracking-wider uppercase text-[#5a413a] px-1">Privacy</h3>
            <div className="bg-white rounded-xl border border-[#e2bfb5] overflow-hidden">
              <div className="p-4 flex items-center justify-between hover:bg-[#fff1ed] transition-colors cursor-pointer">
                <div className="flex items-center gap-3 text-[#261814]">
                  <Lock size={20} className="text-[#5a413a]" />
                  <span className="text-[15px] font-bold">Privacy Settings</span>
                </div>
                <ChevronRight size={18} className="text-[#8e7068]" />
              </div>
            </div>
          </div>

          {/* Account */}
          <div className="space-y-2">
            <h3 className="text-[12px] font-bold tracking-wider uppercase text-[#5a413a] px-1">Account</h3>
            <div className="bg-white rounded-xl border border-[#e2bfb5] overflow-hidden">
              <button onClick={() => navigate("/")} className="w-full p-4 flex items-center gap-3 border-b border-[#e2bfb5] hover:bg-[#fff1ed] transition-colors text-[#ac2d00] text-[16px]">
                <LogOut size={20} />
                Sign out
              </button>
              <button className="w-full p-4 flex items-center gap-3 hover:bg-[#ffdad6] transition-colors text-[#ba1a1a] text-[16px]">
                <Trash2 size={20} />
                Delete Account
              </button>
            </div>
          </div>
        </main>


        <MobileBottomNav />
      </div>

      {/* ============================== */}
      {/*  DESKTOP LAYOUT (hidden lg:flex) */}
      {/* ============================== */}
      <div className="hidden lg:flex flex-col min-h-screen bg-[#fff8f6]">
        <DesktopHeader showSearch={true} searchPlaceholder="Search settings..." />
        <DesktopSidebar />

        {/* Main Content */}
        <main className="ml-64 mt-16 flex-grow min-h-[calc(100vh-64px)] overflow-y-auto p-8">
          <div className="max-w-6xl mx-auto">
            {/* Page Header */}
            <header className="mb-8">
              <h1 className="text-[28px] font-semibold text-[#261814]">Settings</h1>
              <p className="text-[16px] text-[#5a413a] mt-1">Configure your safety preferences and account details.</p>
            </header>

            <div className="grid grid-cols-12 gap-6">
              {/* Settings Sub-Nav */}
              <nav className="col-span-3 flex flex-col gap-1">
                {sideNavItems.map(({ key, label, Icon }) => (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                      activeTab === key
                        ? "bg-[#fde2dc] text-[#ac2d00] font-bold border-l-4 border-[#ac2d00]"
                        : "text-[#5a413a] hover:bg-[#fff1ed]"
                    }`}
                  >
                    <Icon size={20} />
                    <span className="text-[15px]">{label}</span>
                  </button>
                ))}
                <div className="my-2 border-t border-[#e2bfb5]" />
                <button className="flex items-center gap-3 px-4 py-3 rounded-xl text-[#5a413a] hover:bg-[#fff1ed] transition-all text-left">
                  <Info size={20} />
                  <span className="text-[15px]">About</span>
                </button>
                <button
                  onClick={() => navigate("/")}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-[#ba1a1a] hover:bg-[#ffdad6] transition-all text-left"
                >
                  <LogOut size={20} />
                  <span className="text-[15px]">Logout</span>
                </button>
              </nav>

              {/* Settings Detail Area */}
              <div className="col-span-9 bg-white rounded-2xl border border-[#e2bfb5] p-8 shadow-sm overflow-hidden relative">
                {/* Profile Tab */}
                {activeTab === "profile" && (
                  <div className="space-y-8">
                    <div>
                      <h2 className="text-[22px] font-semibold text-[#261814] mb-1">Profile Information</h2>
                      <p className="text-[14px] text-[#5a413a]">Update your personal details and contact information.</p>
                    </div>

                    {/* Avatar + Info */}
                    <div className="flex items-center gap-6 pb-8 border-b border-[#e2bfb5]">
                      <div className="relative">
                        <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-[#ffdbd1]">
                          <img
                            className="w-full h-full object-cover"
                            src="https://lh3.googleusercontent.com/aida-public/AB6AXuA6odC1f_aBrxp-V8UlmHpxYb1kObRaSF16YD2PzjIP_SinQ5-YFO59DRAYKnyEA3lVOQtupdvEf2vXdJdbCvzXtWRintpm9341jxxUltycvta6RsWSpaFpcVW3NM2BR4MOdDcsk224hIR4PmOzdliYYs7rY7QOwyzJINsiH-CV6hk4rA-e0NsNfwMquyFIaVIOng9L9U89YP4LvPZisaD5T7F5ZVlFzbBQcSW3gnX2A0n5DHhUw-NMx6yNwTE4_WM64lAVSiSR7Rs"
                            alt="Sarah Mitchell"
                          />
                        </div>
                        <button className="absolute bottom-0 right-0 p-1.5 bg-[#ac2d00] text-white rounded-full border-2 border-white shadow-md">
                          <Edit2 size={12} />
                        </button>
                      </div>
                      <div>
                        <h3 className="text-[18px] font-semibold text-[#261814]">Sarah Mitchell</h3>
                        <p className="text-[14px] text-[#5a413a]">Member since Jan 2024</p>

                      </div>
                    </div>

                    {/* Form Grid */}
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-[#5a413a] block ml-1">Full Name</label>
                        <input
                          className="w-full px-3 py-3 border border-[#e2bfb5] rounded-xl focus:border-[#ac2d00] focus:ring-1 focus:ring-[#ac2d00] bg-[#fff8f6] text-[#261814] outline-none transition-all"
                          type="text"
                          defaultValue="Sarah Mitchell"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-[#5a413a] block ml-1">Email Address</label>
                        <input
                          className="w-full px-3 py-3 border border-[#e2bfb5] rounded-xl focus:border-[#ac2d00] focus:ring-1 focus:ring-[#ac2d00] bg-[#fff8f6] text-[#261814] outline-none transition-all"
                          type="email"
                          defaultValue="sarah.m@guardian.com"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-[#5a413a] block ml-1">Phone Number</label>
                        <input
                          className="w-full px-3 py-3 border border-[#e2bfb5] rounded-xl focus:border-[#ac2d00] focus:ring-1 focus:ring-[#ac2d00] bg-[#fff8f6] text-[#261814] outline-none transition-all"
                          type="tel"
                          defaultValue="+1 (555) 012-3456"
                        />
                      </div>

                    </div>

                    {/* Safety Preferences */}
                    <div>
                      <h2 className="text-[18px] font-semibold text-[#261814] mb-4">Safety Preferences</h2>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-4 rounded-xl border border-[#e2bfb5] hover:bg-[#fff1ed] transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[#007caf]/10 flex items-center justify-center text-[#007caf]">
                              <AlertCircle size={20} />
                            </div>
                            <div>
                              <p className="text-[15px] font-bold text-[#261814]">Critical Alert Notifications</p>
                              <p className="text-[13px] text-[#5a413a]">Allow sound even if Do Not Disturb is active</p>
                            </div>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={criticalAlerts}
                              onChange={(e) => setCriticalAlerts(e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-[#e2bfb5] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#ac2d00]"></div>
                          </label>
                        </div>
                        <div className="flex items-center justify-between p-4 rounded-xl border border-[#e2bfb5] hover:bg-[#fff1ed] transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[#ac2d00]/10 flex items-center justify-center text-[#ac2d00]">
                              <MapPin size={20} />
                            </div>
                            <div>
                              <p className="text-[15px] font-bold text-[#261814]">Background Location Access</p>
                              <p className="text-[13px] text-[#5a413a]">Required for tracking during active sessions</p>
                            </div>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={bgLocation}
                              onChange={(e) => setBgLocation(e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-[#e2bfb5] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#ac2d00]"></div>
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex justify-end gap-3 pt-6 border-t border-[#e2bfb5]">
                      <button className="px-6 py-3 text-[#5a413a] font-bold hover:bg-[#fff1ed] rounded-xl transition-colors">
                        Cancel
                      </button>
                      <button className="px-6 py-3 bg-[#ac2d00] text-white font-bold rounded-xl shadow-md hover:bg-[#8a2400] active:scale-95 transition-all">
                        Save Changes
                      </button>
                    </div>
                  </div>
                )}

                {/* Trusted Contacts Tab */}
                {activeTab === "contacts" && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-[22px] font-semibold text-[#261814] mb-1">Trusted Contacts</h2>
                      <p className="text-[14px] text-[#5a413a]">Manage who gets notified during an emergency.</p>
                    </div>
                    <button
                      onClick={() => navigate("/contacts")}
                      className="w-full py-4 border-2 border-dashed border-[#ac2d00] text-[#ac2d00] font-bold rounded-xl hover:bg-[#fff1ed] transition-colors flex items-center justify-center gap-2"
                    >
                      <Users size={20} />
                      Manage Trusted Contacts
                    </button>
                  </div>
                )}

                {/* Notifications Tab */}
                {activeTab === "notifications" && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-[22px] font-semibold text-[#261814] mb-1">Notifications</h2>
                      <p className="text-[14px] text-[#5a413a]">Control how and when you receive alerts.</p>
                    </div>
                    <div className="space-y-3">
                      {[
                        { label: "Push Notifications", desc: "Receive app push alerts on your device", state: pushNotifications, setter: setPushNotifications, id: "desk-push" },
                        { label: "SMS Alerts", desc: "Get text messages for critical events", state: smsAlerts, setter: setSmsAlerts, id: "desk-sms" },
                        { label: "Urgent Reminders", desc: "Escalate missed check-ins with repeated alerts", state: reminders, setter: setReminders, id: "desk-rem" },
                      ].map(({ label, desc, state, setter, id }) => (
                        <div key={id} className="flex items-center justify-between p-4 rounded-xl border border-[#e2bfb5] hover:bg-[#fff1ed] transition-colors">
                          <div>
                            <p className="text-[15px] font-bold text-[#261814]">{label}</p>
                            <p className="text-[13px] text-[#5a413a]">{desc}</p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={state} onChange={(e) => setter(e.target.checked)} className="sr-only peer" />
                            <div className="w-11 h-6 bg-[#e2bfb5] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#ac2d00]"></div>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Other tabs placeholder */}
                {(activeTab === "voice" || activeTab === "power" || activeTab === "privacy" || activeTab === "about") && (
                  <div className="flex flex-col items-center justify-center h-64 text-[#5a413a] gap-3">
                    <Settings size={40} className="text-[#e2bfb5]" />
                    <p className="text-[16px] font-medium capitalize">{activeTab.replace("-", " ")} settings coming soon.</p>
                  </div>
                )}

                {/* Subtle bg decoration */}
                <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-[#ffdbd1]/10 rounded-full blur-3xl -z-10" />
              </div>
            </div>
          </div>
        </main>


      </div>
    </div>
  );
}
