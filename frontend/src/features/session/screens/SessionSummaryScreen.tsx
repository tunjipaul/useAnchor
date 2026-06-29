import { useLocation, useNavigate } from "react-router-dom";
import { CheckCircle, Clock, Users, Activity, Home, ShieldCheck } from "lucide-react";
import type { SessionData } from "../utils/sessionStore";

export default function SessionSummaryScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const session = location.state?.session as SessionData | undefined;

  if (!session) {
    // Fallback if accessed directly
    return (
      <div className="flex-grow flex flex-col items-center justify-center bg-[#fff8f6] p-6 text-center">
        <h1 className="text-xl font-bold text-[#261814] mb-4">No Session Data Found</h1>
        <button
          onClick={() => navigate("/dashboard")}
          className="h-12 px-6 bg-emerald-600 text-white rounded-xl font-bold flex items-center gap-2"
        >
          <Home size={18} />
          <span>Return to Dashboard</span>
        </button>
      </div>
    );
  }

  const durationStr = session.endedAt
    ? Math.max(1, Math.round((new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 60000)) + " minutes"
    : session.durationMinutes + " minutes";

  const successfulCheckIns = session.checkIns?.filter(c => c.type === 'safe').length || 0;
  const missedCheckIns = session.checkIns?.filter(c => c.type === 'missed').length || 0;
  const sosTriggered = !!session.sosTriggeredAt;

  return (
    <div className="flex-grow flex flex-col items-center justify-start overflow-y-auto w-full bg-[#fff8f6]">
      <main className="w-full max-w-[390px] min-h-[700px] flex flex-col justify-between py-8 px-5 space-y-6">
        
        <div className="space-y-6 flex-grow flex flex-col items-center justify-center text-center">
          <div className="w-24 h-24 bg-[#e8f5e9] rounded-full flex items-center justify-center shadow-inner">
            <ShieldCheck size={48} className="text-[#2e7d32]" />
          </div>

          <div className="space-y-2">
            <h1 className="text-[28px] font-bold text-[#261814]">Session Ended Safely</h1>
            <p className="text-[15px] text-[#5a413a]">
              Your anchor session for <span className="font-bold">{session.title}</span> has been completed.
            </p>
          </div>

          <div className="w-full bg-white border border-[#e2bfb5] rounded-xl shadow-sm overflow-hidden text-left mt-4">
            <div className="p-4 border-b border-[#e2bfb5]/50 bg-[#fff1ed]/30 flex items-center gap-3">
              <Activity size={20} className="text-[#ac2d00]" />
              <h3 className="font-bold text-[#261814]">Session Summary</h3>
            </div>
            <div className="divide-y divide-[#e2bfb5]/50">
              <div className="flex justify-between p-4">
                <span className="text-[#5a413a] flex items-center gap-2"><Clock size={16} /> Total Duration</span>
                <span className="font-bold text-[#261814]">{durationStr}</span>
              </div>
              <div className="flex justify-between p-4">
                <span className="text-[#5a413a] flex items-center gap-2"><CheckCircle size={16} /> Safe Check-Ins</span>
                <span className="font-bold text-[#261814]">{successfulCheckIns}</span>
              </div>
              {(missedCheckIns > 0 || sosTriggered) && (
                <>
                  <div className="flex justify-between p-4">
                    <span className="text-[#5a413a] flex items-center gap-2">Missed Check-Ins</span>
                    <span className="font-bold text-[#ba1a1a]">{missedCheckIns}</span>
                  </div>
                  <div className="flex justify-between p-4 bg-[#ffdad6]/20">
                    <span className="text-[#ba1a1a] font-medium flex items-center gap-2">SOS Triggered</span>
                    <span className="font-bold text-[#ba1a1a]">Yes ({session.triggerType})</span>
                  </div>
                </>
              )}
              <div className="flex justify-between p-4">
                <span className="text-[#5a413a] flex items-center gap-2"><Users size={16} /> Contacts Notified</span>
                <span className="font-bold text-[#261814]">{session.contacts?.length || 0}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Footer */}
        <div className="pt-6 w-full">
          <button
            onClick={() => navigate("/dashboard")}
            className="w-full h-14 bg-[#261814] text-white rounded-xl font-bold text-[16px] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-md"
          >
            <Home size={20} />
            <span>Return to Dashboard</span>
          </button>
        </div>

      </main>
    </div>
  );
}
