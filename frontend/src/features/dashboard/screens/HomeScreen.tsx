import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Shield,
  Plus,
  Users,
  Settings,
  History,
  CheckCircle,
  ArrowRight,
  User,
  Bell,
  Home,
  Radio,
  MapPin,
  Activity,
  ChevronRight,
  Siren,
  Sparkles,
  Info
} from "lucide-react";

export default function HomeScreen() {
  const navigate = useNavigate();
  const userName = "Sarah Mitchell";

  // State for simulated timer on desktop view
  const [seconds, setSeconds] = useState(18 * 60 + 40);

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Mock list of recent safety sessions
  const recentSessions = [
    {
      id: "rec-1",
      title: "Marketplace Pickup",
      location: "Coffee House, 4th Ave",
      date: "Today, 2:30 PM",
      status: "Ended Safely",
    },
    {
      id: "rec-2",
      title: "Evening Jog on Trail",
      location: "Redwood Park Loop",
      date: "Yesterday, 6:15 PM",
      status: "Ended Safely",
    },
    {
      id: "rec-3",
      title: "Late Night Walk Home",
      location: "Downtown to Suburbs",
      date: "Jun 24, 11:45 PM",
      status: "Ended Safely",
    },
  ];

  return (
    <div className="min-h-screen flex flex-col w-full bg-[#fff8f6]">
      
      {/* ========================================== */}
      {/*         MOBILE LAYOUT (md:hidden)          */}
      {/* ========================================== */}
      <div className="block md:hidden flex-1 flex flex-col items-center justify-start px-4">
        {/* Mobile wrapper */}
        <main className="w-full max-w-[390px] min-h-[700px] flex flex-col justify-between py-8 space-y-6">
          
          {/* Header */}
          <header className="w-full flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center border bg-[#ffe9e4] text-[#ac2d00]"
                style={{ borderColor: "#e2bfb5" }}
              >
                <User size={18} />
              </div>
              <div className="flex flex-col">
                <span className="text-[12px] leading-none text-[#5a413a]">
                  Welcome back,
                </span>
                <span className="text-[15px] font-bold text-[#261814]">
                  {userName}
                </span>
              </div>
            </div>
            <span className="text-[20px] font-bold tracking-tight text-[#ac2d00]">
              useAnchor
            </span>
          </header>

          {/* Status Area */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="w-full p-5 rounded-2xl border bg-white flex items-center gap-4 shadow-sm"
            style={{ borderColor: "#e2bfb5" }}
          >
            <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 bg-[#ffe9e4]">
              <Shield size={24} style={{ color: "#ac2d00" }} />
            </div>
            <div className="flex flex-col">
              <span className="text-[18px] font-bold text-[#261814]">
                You are currently Safe
              </span>
              <span className="text-[13px] text-[#5a413a]">
                Anchor is inactive. Ready to start monitoring.
              </span>
            </div>
          </motion.div>

          {/* Primary CTA */}
          <div className="w-full">
            <button
              onClick={() => navigate("/session/new")}
              className="w-full h-24 bg-white border rounded-2xl p-5 flex items-center justify-between shadow-sm hover:bg-[#fff1ed] active:scale-[0.98] transition-all"
              style={{ borderColor: "#ac2d00" }}
            >
              <div className="flex items-center gap-4 text-left">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white bg-[#ac2d00]"
                >
                  <Plus size={24} />
                </div>
                <div className="flex flex-col">
                  <span className="text-[18px] font-bold text-[#261814]">
                    Start Anchor Session
                  </span>
                  <span className="text-[13px] text-[#5a413a]">
                    Configure meetup details & safety circle
                  </span>
                </div>
              </div>
              <ArrowRight size={20} style={{ color: "#ac2d00" }} />
            </button>
          </div>

          {/* Bento navigation */}
          <div className="w-full grid grid-cols-2 gap-4">
            <button
              onClick={() => navigate("/contacts")}
              className="flex flex-col items-start p-5 bg-white border border-[#e2bfb5] rounded-2xl shadow-sm text-left hover:bg-[#fff1ed] active:scale-[0.98] transition-all"
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[#ffe9e4] mb-3">
                <Users size={20} style={{ color: "#ac2d00" }} />
              </div>
              <span className="text-[15px] font-bold text-[#261814]">
                Trusted Circle
              </span>
              <span className="text-[12px] mt-1 text-[#5a413a]">
                Manage emergency contacts
              </span>
            </button>

            <button
              onClick={() => navigate("/settings")}
              className="flex flex-col items-start p-5 bg-white border border-[#e2bfb5] rounded-2xl shadow-sm text-left hover:bg-[#fff1ed] active:scale-[0.98] transition-all"
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[#ffe9e4] mb-3">
                <Settings size={20} style={{ color: "#ac2d00" }} />
              </div>
              <span className="text-[15px] font-bold text-[#261814]">
                Settings
              </span>
              <span className="text-[12px] mt-1 text-[#5a413a]">
                Safe words & check-in limits
              </span>
            </button>
          </div>

          {/* Recent Activity */}
          <div className="w-full space-y-3 flex-1 flex flex-col justify-start">
            <div className="flex justify-between items-center px-1">
              <span className="text-[16px] font-semibold flex items-center gap-1.5 text-[#261814]">
                <History size={16} className="text-[#5a413a]" />
                Recent Activity
              </span>
              <span className="text-[12px] font-semibold hover:underline cursor-pointer text-[#ac2d00]">
                View All
              </span>
            </div>

            <div className="space-y-2 w-full">
              {recentSessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between p-4 bg-white border border-[#e2bfb5] rounded-xl shadow-xs"
                >
                  <div className="flex flex-col gap-0.5 text-left">
                    <span className="text-[15px] font-bold text-[#261814]">
                      {session.title}
                    </span>
                    <span className="text-[12px] text-[#5a413a]">
                      {session.location} • {session.date}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[12px] font-semibold text-[#1D9E75] bg-[#1D9E75]/10 px-2.5 py-1 rounded-full shrink-0">
                    <CheckCircle size={12} />
                    <span>Ended</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </main>
      </div>

      {/* ========================================== */}
      {/*        DESKTOP LAYOUT (hidden md:flex)     */}
      {/* ========================================== */}
      <div className="hidden md:flex flex-col flex-grow relative w-full">
        
        {/* Top Header */}
        <header className="fixed top-0 left-0 w-full h-16 bg-white border-b border-[#e2bfb5] flex justify-between items-center px-6 z-50">
          <div className="flex items-center gap-2">
            <span className="text-[22px] font-bold tracking-tight text-[#ac2d00]">
              useAnchor
            </span>
          </div>

          <div className="flex items-center gap-6">
            {/* Status bar */}
            <div className="flex items-center gap-2 bg-[#fff1ed] px-4 py-1.5 rounded-full border border-[#e2bfb5]">
              <span className="w-2.5 h-2.5 bg-[#ac2d00] rounded-full animate-ping" />
              <span className="text-[14px] font-bold text-[#ac2d00]">
                Monitoring Active
              </span>
            </div>

            <div className="flex items-center gap-4">
              <button aria-label="Notifications" className="text-[#5a413a] hover:text-[#ac2d00] relative">
                <Bell size={20} />
              </button>
              <div
                className="w-10 h-10 rounded-full overflow-hidden border shadow-sm cursor-pointer"
                style={{ borderColor: "#e2bfb5" }}
              >
                <img
                  className="w-full h-full object-cover"
                  alt="Profile"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuD5UvSkhV6Enqdm-RJHui5mvajYH1wZHhspIMcgjhkLLlFDn4WJrR6gm6Q4AAQd8Kw_QSzUb2QfNk_wkYTd2My9aBekog97vLNKkrU6vyrxdr-V8v3tjE8GtlnCLdpOlY6rsalrs4PXF3YEtYeJuwob3v9mxYkhXVOI9vQDi0NPFnz6ANY4dAFMxsbQncYSXKRPN_ExLyn-0dQL-eh9bkNFDrwsDHw53ZFwJEXsXNiOvkKZ5jDTRibZR73MSLE8J-XfzMXaCKal6MI"
                />
              </div>
            </div>
          </div>
        </header>

        {/* Sidebar Nav */}
        <nav
          className="fixed left-0 top-16 h-[calc(100vh-64px)] w-64 flex flex-col p-4 bg-[#fff8f6] border-r z-50"
          style={{ borderColor: "#e2bfb5" }}
        >
          <div className="flex flex-col gap-1 flex-grow">
            <button className="flex items-center gap-3 px-4 py-3 bg-[#ffe9e4] text-[#ac2d00] font-bold rounded-lg cursor-pointer transition-all w-full text-left">
              <Home size={20} />
              <span className="text-[14px]">Home</span>
            </button>
            <button
              onClick={() => navigate("/session/new")}
              className="flex items-center gap-3 px-4 py-3 text-[#5a413a] hover:bg-[#fff1ed] font-medium rounded-lg cursor-pointer transition-all w-full text-left"
            >
              <Activity size={20} />
              <span className="text-[14px]">Sessions</span>
            </button>
            <button
              onClick={() => navigate("/contacts")}
              className="flex items-center gap-3 px-4 py-3 text-[#5a413a] hover:bg-[#fff1ed] font-medium rounded-lg cursor-pointer transition-all w-full text-left"
            >
              <Users size={20} />
              <span className="text-[14px]">Contacts</span>
            </button>
            <button
              onClick={() => navigate("/settings")}
              className="flex items-center gap-3 px-4 py-3 text-[#5a413a] hover:bg-[#fff1ed] font-medium rounded-lg cursor-pointer transition-all w-full text-left"
            >
              <Settings size={20} />
              <span className="text-[14px]">Settings</span>
            </button>
          </div>

          <button
            onClick={() => navigate("/session/sos")}
            className="mt-auto w-full py-3 bg-[#ac2d00] text-white font-bold rounded-lg flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all shadow-md"
          >
            <Siren size={18} />
            <span>Start SOS</span>
          </button>
        </nav>

        {/* Desktop Main Content Container */}
        <main className="ml-64 mt-16 flex-grow h-[calc(100vh-64px)] overflow-y-auto bg-[#fff8f6] p-8">
          <div className="max-w-6xl mx-auto flex flex-col gap-8">
            
            {/* Greeting Header */}
            <header className="text-left">
              <h1 className="text-[32px] font-semibold text-[#261814]">
                Good morning, {userName.split(" ")[0]}
              </h1>
              <p className="text-[16px] text-[#5a413a] mt-1">
                Stay safe today. Your active monitoring is currently running.
              </p>
            </header>

            {/* Main Dashboard Layout Grid */}
            <div className="grid grid-cols-12 gap-8 items-start">
              
              {/* Left Column: Active Session Detail (Large Card) */}
              <section className="col-span-12 lg:col-span-8 flex flex-col">
                <div className="bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col" style={{ borderColor: "#e2bfb5" }}>
                  
                  {/* Card Header */}
                  <div className="p-5 flex justify-between items-center border-b bg-[#fff1ed]" style={{ borderColor: "#e2bfb5" }}>
                    <div className="flex items-center gap-2">
                      <Radio size={20} className="text-[#ac2d00]" />
                      <h2 className="text-[18px] font-bold text-[#261814]">Active Monitoring</h2>
                    </div>
                    <div className="px-3 py-1 bg-[#ac2d00]/10 text-[#ac2d00] rounded-full text-[12px] font-bold flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-[#ac2d00] rounded-full animate-ping" />
                      LIVE
                    </div>
                  </div>

                  {/* Card Columns */}
                  <div className="grid grid-cols-1 md:grid-cols-2">
                    {/* Maps Preview Panel */}
                    <div className="min-h-[300px] relative bg-[#fff8f6]">
                      <div
                        className="absolute inset-0 bg-cover bg-center grayscale opacity-45"
                        style={{
                          backgroundImage: `url('https://lh3.googleusercontent.com/aida-public/AB6AXuDQpfWQe1Tysy7mUFdcjMtsG1gCEpywJ8rU2AwMxxQYLpj9W85d86jSfy8zdSM0IBo2LtryBGko5W7q79gji8OA3NtUDMUdEZ4xlqY5_I7rMBLPf7mq1c5bpw3hplxj35HpdwGWs9ZPDkQlNgfKiMvUrwSpaDzV3x6Pz3a9-w702n2zPSkdeuzZGRifCGgQ2ZgKxMX2lPWZCk_PiSS_DQJM5-1TTkjBW3K8MRk6JBQzzevGQ-2anYdDP4K_P2gG0BXQBN9f5QDsOdk')`,
                        }}
                      />
                      {/* Destination Overlay */}
                      <div
                        className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur-sm p-3 rounded-xl border flex items-center gap-2.5 shadow-sm"
                        style={{ borderColor: "#e2bfb5" }}
                      >
                        <MapPin size={20} className="text-[#ac2d00]" />
                        <div className="flex flex-col text-left">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-[#5a413a]">Destination</span>
                          <span className="text-[14px] font-semibold text-[#261814]">124 Baker Street</span>
                        </div>
                      </div>
                    </div>

                    {/* Stats & Controls Panel */}
                    <div className="p-6 flex flex-col justify-between text-left">
                      <div>
                        <h3 className="text-[22px] font-semibold text-[#261814] mb-1">
                          Late Night Walk Home
                        </h3>
                        <p className="text-[14px] text-[#5a413a] mb-6">
                          Estimated Arrival: 11:45 PM
                        </p>

                        {/* Progress Bar & Timer */}
                        <div className="mb-6 space-y-1">
                          <div className="flex justify-between items-end">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-[#5a413a]">Progress</span>
                            <span className="font-mono text-[24px] font-bold text-[#ac2d00]">
                              {formatTime(seconds)}
                            </span>
                          </div>
                          <div className="w-full h-3 rounded-full bg-[#fde2dc] overflow-hidden">
                            <div
                              className="h-full bg-[#ac2d00] rounded-full transition-all duration-1000"
                              style={{ width: "65%" }}
                            />
                          </div>
                          <div className="flex justify-between text-[11px] text-[#5a413a] pt-1">
                            <span>Started: 11:20 PM</span>
                            <span>Remaining: ~6m 20s</span>
                          </div>
                        </div>

                        {/* Status Checklists */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-3 p-3 bg-[#fff1ed] rounded-lg border border-[#e2bfb5]/50">
                            <CheckCircle size={18} className="text-[#ac2d00]" />
                            <span className="text-[13px] font-medium text-[#261814]">
                              Tracking high-confidence signal
                            </span>
                          </div>
                          <div className="flex items-center gap-3 p-3 bg-[#fff1ed] rounded-lg border border-[#e2bfb5]/50">
                            <Users size={18} className="text-[#ac2d00]" />
                            <span className="text-[13px] font-medium text-[#261814]">
                              Shared with 3 Emergency Contacts
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* View Button */}
                      <button
                        onClick={() => navigate("/session/timeline/active")}
                        className="mt-6 w-full py-3 border-2 rounded-lg font-bold transition-all flex items-center justify-center gap-2 hover:bg-[#ac2d00]/5 active:scale-95 text-[#ac2d00]"
                        style={{ borderColor: "#ac2d00" }}
                      >
                        <span>View Session Details</span>
                        <ArrowRight size={18} />
                      </button>
                    </div>
                  </div>

                </div>
              </section>

              {/* Right Column: Safety Essentials Sidebar */}
              <aside className="col-span-12 lg:col-span-4 flex flex-col gap-6">
                <div
                  className="bg-white p-6 rounded-2xl border shadow-sm flex flex-col h-full"
                  style={{ borderColor: "#e2bfb5" }}
                >
                  <div className="flex items-center gap-2 mb-6">
                    <Shield size={20} className="text-[#ac2d00]" />
                    <h2 className="text-[18px] font-bold text-[#261814]">Safety Essentials</h2>
                  </div>

                  <div className="space-y-4 flex-grow">
                    {/* Highlight Card 1 */}
                    <div className="group relative overflow-hidden rounded-xl border border-[#e2bfb5] hover:border-[#ac2d00] transition-all cursor-pointer">
                      <div className="h-28 w-full relative overflow-hidden bg-gray-100">
                        <img
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          alt="Well lit route map"
                          src="https://lh3.googleusercontent.com/aida-public/AB6AXuBhsH5tSZNgsncF4ggmwNy_lYMVpZ33nO8V5t34hwilbKYE36yW430-nbvzGrjdoK7ha_lOP0iuK4DlY2oVQEYMevhWemIfELLHOI2ohY20S_C5rkCmfUnq-otZFxRq6Gjexv-f_aqDYkPh7MkDCcXyOOxFKN8UWOTGAg8bd3R3QXsG26n9lZ-zPt6GeWrbBSG7J3yJvybY1FjZ59lRskVNkIfRxR0oH_ADbDPB9SgZ05PoGnrDn75S9GGAyH7o_8jTj2Sbq1TvCwA"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                        <div className="absolute bottom-2 left-3 text-white font-bold text-[14px]">
                          Well-Lit Routes
                        </div>
                      </div>
                      <div className="p-3 bg-white text-left">
                        <p className="text-[12px] text-[#5a413a]">
                          AI-optimized paths favoring brightness and public visibility.
                        </p>
                      </div>
                    </div>

                    {/* Highlight Card 2 */}
                    <div className="group relative overflow-hidden rounded-xl border border-[#e2bfb5] hover:border-[#ac2d00] transition-all cursor-pointer">
                      <div className="h-28 w-full relative overflow-hidden bg-gray-100">
                        <img
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          alt="Live location telemetry"
                          src="https://lh3.googleusercontent.com/aida-public/AB6AXuC_RDogdWc-WEE9qP2w1jrN0Hh_wHNd5berm36Fa8y-QKo-A11PLEVGR9IzmLbGlB5hH7C7Lxs8Chut65gpwc4C4TjpUn1Di-QIZC_B1_zX1iCmFrpokSknzFehYxHJhAvlr0byy2GJJVTIxDhEPy84hEpbKCi5gxumjOgtvVw4NWwWEd_lFsxHXBO61MfwU4cQofAkLOaT5s3b3cE9XBcZ5d6NLwuwfTxERZYx7s_2leb9h7cI72TMWzgs7Dn-9aAR-Ip_pNIF5Is"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                        <div className="absolute bottom-2 left-3 text-white font-bold text-[14px]">
                          Live Tracking
                        </div>
                      </div>
                      <div className="p-3 bg-white text-left">
                        <p className="text-[12px] text-[#5a413a]">
                          Real-time telemetry shared with your trusted circle.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Safety Tip Banner */}
                  <div className="mt-6 p-4 bg-[#fff1ed] rounded-xl border-l-4 border-[#ac2d00] text-left">
                    <h4 className="font-bold text-[#261814] text-[13px] flex items-center gap-1">
                      <Info size={14} className="text-[#ac2d00]" />
                      Safety Tip
                    </h4>
                    <p className="text-[12px] text-[#5a413a] mt-1 leading-snug">
                      Always keep your phone in an easily accessible pocket, never in the bottom of your bag.
                    </p>
                  </div>

                </div>
              </aside>

            </div>

            {/* Bottom Row: Recent Sessions History Panel */}
            <section className="w-full text-left">
              <div className="flex justify-between items-end mb-4">
                <h2 className="text-[20px] font-semibold text-[#261814]">Recent Sessions</h2>
                <button
                  onClick={() => navigate("/session/history")}
                  className="text-[13px] font-bold text-[#ac2d00] hover:underline"
                >
                  View History
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                
                {/* Session Card 1 */}
                <div
                  className="bg-white p-5 rounded-xl border shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center gap-4 text-left"
                  style={{ borderColor: "#e2bfb5" }}
                >
                  <div className="w-12 h-12 bg-[#ffe9e4] rounded-xl flex items-center justify-center text-[#ac2d00] shrink-0 border border-[#e2bfb5]">
                    <Activity size={22} />
                  </div>
                  <div className="flex-grow min-w-0">
                    <h3 className="text-[15px] font-bold text-[#261814] truncate">Work to Metro</h3>
                    <p className="text-[12px] text-[#5a413a] truncate">Yesterday • 6:45 PM</p>
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    <span className="px-2 py-0.5 bg-[#fde2dc] text-[#ac2d00] rounded-full text-[10px] font-bold">12 MIN</span>
                    <ChevronRight size={16} className="text-[#5a413a] mt-1" />
                  </div>
                </div>

                {/* Session Card 2 */}
                <div
                  className="bg-white p-5 rounded-xl border shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center gap-4 text-left"
                  style={{ borderColor: "#e2bfb5" }}
                >
                  <div className="w-12 h-12 bg-[#ffe9e4] rounded-xl flex items-center justify-center text-[#ac2d00] shrink-0 border border-[#e2bfb5]">
                    <Sparkles size={22} />
                  </div>
                  <div className="flex-grow min-w-0">
                    <h3 className="text-[15px] font-bold text-[#261814] truncate">Morning Jog</h3>
                    <p className="text-[12px] text-[#5a413a] truncate">2 days ago • 7:15 AM</p>
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    <span className="px-2 py-0.5 bg-[#fde2dc] text-[#ac2d00] rounded-full text-[10px] font-bold">45 MIN</span>
                    <ChevronRight size={16} className="text-[#5a413a] mt-1" />
                  </div>
                </div>

                {/* Session Card 3: Start New Session CTA */}
                <button
                  onClick={() => navigate("/session/new")}
                  className="bg-[#fff8f6] p-5 rounded-xl border-2 border-dashed border-[#e2bfb5] flex items-center justify-center gap-3 hover:bg-[#fff1ed] hover:border-[#ac2d00] transition-all cursor-pointer group"
                >
                  <div className="w-10 h-10 bg-[#ac2d00]/10 text-[#ac2d00] rounded-full flex items-center justify-center group-hover:bg-[#ac2d00] group-hover:text-white transition-all">
                    <Plus size={20} />
                  </div>
                  <span className="font-bold text-[#5a413a] group-hover:text-[#ac2d00] text-[15px]">
                    Start New Session
                  </span>
                </button>

              </div>
            </section>

          </div>
        </main>

        {/* Floating SOS Trigger Button */}
        <div className="fixed bottom-6 right-6 z-50 group">
          <div className="absolute inset-0 bg-[#ac2d00]/20 rounded-full animate-ping scale-150" />
          <button
            onClick={() => navigate("/session/sos")}
            className="w-20 h-20 bg-[#ac2d00] text-white rounded-full shadow-2xl flex flex-col items-center justify-center gap-1 active:scale-90 transition-transform hover:scale-105"
          >
            <Siren size={30} className="text-white" />
            <span className="text-[10px] font-extrabold uppercase tracking-wider">SOS</span>
          </button>
          <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-[#261814] text-white text-[12px] font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-lg">
            Trigger Emergency Alert
          </div>
        </div>

      </div>

    </div>
  );
}
