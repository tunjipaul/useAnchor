import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  Check, Clock, Timer, Verified, ArrowRight,
  TrendingUp, MapPin, Phone, AlertCircle
} from "lucide-react";
import DesktopSidebar from "../../../components/DesktopSidebar";
import DesktopHeader from "../../../components/DesktopHeader";
import MobileBottomNav from "../../../components/MobileBottomNav";


export default function IncidentResolvedScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [alert, setAlert] = useState<any | null>(null);

  useEffect(() => {
    async function loadResolvedAlert() {
      if (!id) return;
      try {
        // Mock for MVP since no alerts endpoint exists
        setAlert({
          id: id,
          sessionId: id,
          userName: "Unknown User",
          triggeredAt: new Date().toISOString(),
          resolvedAt: new Date().toISOString(),
          triggerReason: "SOS Triggered",
          status: "resolved",
          resolutionTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          incidentDuration: "5 minutes",
          finalStatus: "Resolved",
          notes: "Incident concluded securely."
        });
      } catch (e) {
        console.error("Failed to load resolved alert:", e);
        navigate("/alerts");
      }
    }
    loadResolvedAlert();
  }, [id, navigate]);

  if (!alert) return null;

  return (
    <div className="bg-[#fff8f6] text-[#261814] font-body min-h-screen flex flex-col lg:flex-row">
      
      {/* Desktop Navigation */}
      <div className="hidden lg:block">
        <DesktopSidebar />
        <DesktopHeader />
      </div>

      <main className="flex-1 lg:ml-64 lg:mt-16 bg-[#fff8f6] min-h-screen flex flex-col p-4 lg:p-8 pb-24 lg:pb-8 relative">
        <div className="max-w-4xl w-full mx-auto mt-4 lg:mt-10">
          
          {/* Header Section */}
          <div className="text-center mb-12">
             <div className="relative inline-block mb-6">
                <div className="absolute inset-0 bg-[#ac2d00] opacity-20 rounded-full scale-150 animate-ping"></div>
                <div className="relative w-20 h-20 bg-[#ac2d00] rounded-full flex items-center justify-center shadow-lg">
                   <Check size={40} className="text-white" strokeWidth={3} />
                </div>
             </div>
             <h1 className="text-[28px] font-semibold text-[#261814] mb-2">User Is Safe</h1>
             <p className="text-[16px] text-[#5a413a] max-w-lg mx-auto">
                The emergency session for <span className="font-bold text-[#261814]">{alert.userName}</span> has been resolved. All contacts have been notified that the situation is secure.
             </p>
          </div>

          {/* Bento Grid Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
             <div className="bg-[#fff1ed] border border-[#e2bfb5] p-6 rounded-xl flex flex-col gap-2 shadow-sm transition-all hover:border-[#ac2d00]">
                <span className="text-[12px] font-semibold text-[#5a413a] flex items-center gap-1 uppercase">
                   <Clock size={16} /> Resolution Time
                </span>
                <p className="text-[22px] font-semibold text-[#261814]">{alert.resolutionTime || "11:58 PM"}</p>
             </div>
             <div className="bg-[#fff1ed] border border-[#e2bfb5] p-6 rounded-xl flex flex-col gap-2 shadow-sm transition-all hover:border-[#ac2d00]">
                <span className="text-[12px] font-semibold text-[#5a413a] flex items-center gap-1 uppercase">
                   <Timer size={16} /> Incident Duration
                </span>
                <p className="text-[22px] font-semibold text-[#261814]">{alert.incidentDuration || "16 minutes"}</p>
             </div>
             <div className="bg-[#fff1ed] border border-[#e2bfb5] p-6 rounded-xl flex flex-col gap-2 shadow-sm transition-all hover:border-[#ac2d00]">
                <span className="text-[12px] font-semibold text-[#5a413a] flex items-center gap-1 uppercase">
                   <Verified size={16} /> Final Status
                </span>
                <p className="text-[22px] font-semibold text-[#ac2d00]">{alert.finalStatus || "Manual Check-in"}</p>
             </div>
          </div>

          {/* Activity Snapshot Section */}
          <div className="bg-white border border-[#e2bfb5] rounded-xl overflow-hidden shadow-sm mb-8">
             <div className="px-6 py-4 border-b border-[#e2bfb5] bg-[#fff1ed] flex justify-between items-center">
                <h2 className="text-[18px] font-semibold flex items-center gap-2 text-[#261814]">
                   <TrendingUp size={20} /> Activity Snapshot
                </h2>
                <span className="text-[12px] font-medium px-3 py-1 bg-[#ff9c80] text-[#78321d] rounded-full">Archive ID: #{alert.id.split('-')[1]}</span>
             </div>
             
             <div className="p-6 space-y-6 relative">
                {/* Timeline Line */}
                <div className="absolute left-[39px] top-6 bottom-6 w-[2px] bg-[#e2bfb5] opacity-50"></div>
                
                <div className="flex gap-4 relative">
                   <div className="w-8 h-8 rounded-full bg-[#ac2d00] flex items-center justify-center z-10 shrink-0">
                      <MapPin size={16} className="text-white" />
                   </div>
                   <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                         <p className="text-[16px] font-bold text-[#261814]">Safe Location Reached</p>
                         <span className="text-[13px] font-mono text-[#5a413a]">{alert.resolutionTime || "11:58 PM"}</span>
                      </div>
                      <p className="text-[14px] text-[#5a413a]">{alert.notes || 'Incident concluded securely.'}</p>
                   </div>
                </div>

                <div className="flex gap-4 relative">
                   <div className="w-8 h-8 rounded-full bg-[#ff9c80] flex items-center justify-center z-10 shrink-0">
                      <Phone size={16} className="text-[#78321d]" />
                   </div>
                   <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                         <p className="text-[16px] font-bold text-[#261814]">Circle Notification Sent</p>
                         <span className="text-[13px] font-mono text-[#5a413a]">
                           {new Date(alert.triggeredAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                         </span>
                      </div>
                      <p className="text-[14px] text-[#5a413a]">Emergency alerts dispatched to safety circle.</p>
                   </div>
                </div>

                <div className="flex gap-4 relative">
                   <div className="w-8 h-8 rounded-full bg-[#ffdad6] flex items-center justify-center z-10 shrink-0">
                      <AlertCircle size={16} className="text-[#93000a]" />
                   </div>
                   <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                         <p className="text-[16px] font-bold text-[#261814]">SOS Triggered</p>
                         <span className="text-[13px] font-mono text-[#5a413a]">{new Date(alert.triggeredAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      </div>
                      <p className="text-[14px] text-[#5a413a]">Manual or auto-escalation SOS activated.</p>
                   </div>
                </div>
             </div>
          </div>

          {/* Final Actions */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
             <button 
               onClick={() => navigate("/dashboard")}
               className="w-full sm:w-auto px-8 py-4 bg-[#ac2d00] text-white rounded-lg font-bold shadow-md hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2"
             >
                Return to Dashboard
                <ArrowRight size={20} />
             </button>
             <button 
               onClick={() => alert.sessionId && navigate(`/session/timeline/${alert.sessionId}`)}
               className="w-full sm:w-auto px-8 py-4 bg-white border border-[#8e7068] text-[#261814] rounded-lg font-bold hover:bg-[#fff1ed] active:scale-95 transition-all flex items-center justify-center gap-2"
             >
                View Full Timeline
             </button>
          </div>

        </div>
      </main>

      {/* Mobile Nav */}
      <div className="lg:hidden fixed bottom-0 w-full z-50">
        <MobileBottomNav />
      </div>
    </div>
  );
}
