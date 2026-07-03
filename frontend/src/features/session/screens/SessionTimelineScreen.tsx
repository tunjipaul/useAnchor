import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, CheckCircle, AlertTriangle, Trash2, Loader2 } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { motion, AnimatePresence } from "framer-motion";

export default function SessionTimelineScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<any | null>(null);
  const [checkins, setCheckins] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeletePrompt, setShowDeletePrompt] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadTimelineData() {
      if (!id) return;
      setIsLoading(true);
      try {
        const { data: sessionData, error: sessionError } = await supabase
          .from("anchor_sessions")
          .select("*")
          .eq("id", id)
          .single();

        if (sessionError) throw sessionError;
        setSession(sessionData);

        const { data: checkinData } = await supabase
          .from("checkins")
          .select("*")
          .eq("session_id", id)
          .order("sequence_number", { ascending: true });

        if (checkinData) {
          setCheckins(checkinData);
        }

        const { data: alertData } = await supabase
          .from("alerts")
          .select("*")
          .eq("session_id", id)
          .order("created_at", { ascending: true });

        if (alertData) {
          setAlerts(alertData);
        }
      } catch (e) {
        console.error("Failed to load timeline data", e);
      } finally {
        setIsLoading(false);
      }
    }
    loadTimelineData();
  }, [id]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#fff8f6] flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-[#ac2d00]" size={36} />
        <p className="text-[14px] text-[#5a413a] font-medium animate-pulse">Loading session timeline...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center bg-[#fff8f6] p-6 text-center">
        <h1 className="text-xl font-bold text-[#261814] mb-4">Session Not Found</h1>
        <button onClick={() => navigate(-1)} className="text-[#ac2d00] font-bold">Go Back</button>
      </div>
    );
  }

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const durationStr = (session.actual_end || session.endedAt) && (session.actual_start || session.startedAt || session.created_at || session.createdAt)
    ? Math.max(1, Math.round((new Date(session.actual_end || session.endedAt).getTime() - new Date(session.actual_start || session.startedAt || session.created_at || session.createdAt).getTime()) / 60000)) + " Minutes"
    : (session.checkin_interval_minutes || session.durationMinutes || 30) + " Minutes";

  // Build timeline events dynamically from DB records
  const events: any[] = [
    { 
      type: 'start', 
      time: session.actual_start || session.startedAt || session.created_at || session.createdAt, 
      title: 'Session Started', 
      description: `Tracking initiated for '${session.title}' route.`,
      dotColor: 'bg-[#ac2d00]',
    }
  ];

  checkins.forEach((checkIn: any) => {
    if (checkIn.status === 'completed') {
      events.push({ 
        type: 'checkin', 
        time: checkIn.actual_response_time || checkIn.updated_at, 
        title: 'Check-in: Safe', 
        description: `Scheduled checkpoint #${checkIn.sequence_number} confirmed successful.`,
        dotColor: 'bg-[#00628c]',
        icon: <CheckCircle size={16} className="text-[#00628c]" />
      });
    } else if (checkIn.status === 'missed') {
      events.push({ 
        type: 'missed', 
        time: checkIn.deadline_time, 
        title: 'Missed Check-In', 
        description: `Checkpoint #${checkIn.sequence_number} was missed by the user.`,
        dotColor: 'bg-[#954831]',
      });
    }
  });

  alerts.forEach((alertItem: any) => {
    events.push({ 
      type: 'sos', 
      id: alertItem.id,
      time: alertItem.created_at, 
      title: alertItem.trigger_type === 'missed_checkin' ? 'Missed Check-In Alert' : 'SOS Triggered', 
      description: `Emergency alert dispatched to safety contacts. Status: ${alertItem.status.toUpperCase()}.`,
      dotColor: 'bg-[#ba1a1a]',
      isProminent: true,
      icon: <AlertTriangle size={20} className="text-[#ba1a1a]" />
    });

    if (alertItem.status === 'resolved') {
      events.push({ 
        type: 'resolved', 
        time: alertItem.resolved_at || alertItem.updated_at, 
        title: 'SOS Resolved', 
        description: `Alert resolved: ${alertItem.resolution_reason || 'Verified Safe'}. Details: ${alertItem.resolution_notes || ''}`,
        dotColor: 'bg-[#1D9E75]',
      });
    }
  });

  if (session.actual_end || session.endedAt) {
    events.push({ 
      type: 'end', 
      time: session.actual_end || session.endedAt, 
      title: 'Session Ended', 
      description: `Tracking concluded successfully (Reason: ${session.completion_reason || session.completionReason || 'safe'}).`,
      dotColor: 'bg-[#5a413a]',
    });
  } else if (session.status === 'completed') {
    events.push({ 
      type: 'end', 
      time: session.updated_at || session.endedAt, 
      title: 'Session Ended', 
      description: 'Tracking concluded successfully.',
      dotColor: 'bg-[#5a413a]', 
    });
  }

  events.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const handleDelete = async () => {
    try {
      const { error } = await supabase
        .from("anchor_sessions")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", session.id);
        
      if (error) throw error;
      navigate('/dashboard');
    } catch (e: any) {
      triggerToast(e.message || "Failed to delete session history record.");
    }
  };

  return (
    <div className="flex-grow flex flex-col items-center justify-start overflow-y-auto w-full min-h-[100dvh] bg-[#FAFAF7] text-[#261814]">
      {/* TopAppBar */}
      <header className="fixed top-0 w-full z-50 bg-[#fff8f6] border-b border-[#e2bfb5] shadow-sm px-4 h-[64px] flex justify-between items-center">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center active:scale-95 transition-transform text-[#5a413a]">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-[20px] font-bold text-[#ac2d00] tracking-tight truncate max-w-[200px]">{session.title}</h1>
        </div>
        <div className="w-8 h-8 rounded-full bg-[#f7ddd6] overflow-hidden border border-[#e2bfb5]">
          <img className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCsoYbLxssscp2WsGDv2d8ZlfFL0iLtG_60UqAK-n2TYPJsxQ2He3K-bhykg_jps0c9lci5cTHVWhQyctt0xwq9q5mrBW4KzQSmuAPzhgJPDfDuOG6HdTHmHxVh_PoPNNi6YpcvoRoEBLBXZ3Szq4tSKZMXILjZajlBDDeIi3l8JtRhl73pmvc3kMu-wFC6BhZWvS-2PuIPfxonqL5RgYQgknos6twmkmI67XfKBca2vdGB2xoHyIu9nSerP0IoRbBqQmU-5wtRGoE" alt="Profile" />
        </div>
      </header>

      <main className="mt-[64px] mb-[80px] p-4 flex flex-col gap-4 max-w-[500px] w-full mx-auto">
        {/* Summary Card */}
        <section className="bg-white border border-[#e2bfb5] rounded-xl p-4 custom-card-shadow">
          <div className="flex justify-between items-start mb-3">
            <div>
              <p className="text-[10px] font-bold text-[#5a413a] uppercase tracking-widest mb-1">Session with</p>
              <h2 className="text-[18px] font-semibold">{session.meet_person || session.personName || 'No contact specified'}</h2>
            </div>
            <span className="bg-[#ECFDF5] text-[#065F46] text-[10px] px-2 py-1 rounded-full uppercase font-bold border border-[#A7F3D0]">
              Ended Safely
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[#e2bfb5]">
            <div>
              <p className="text-[12px] font-medium text-[#5a413a]">Total Duration</p>
              <p className="text-[16px] font-semibold">{durationStr}</p>
            </div>
            <div>
              <p className="text-[12px] font-medium text-[#5a413a]">Date</p>
              <p className="text-[16px] font-semibold">
                {formatDate(session.actual_start || session.startedAt || session.created_at || session.createdAt)}, {formatTime(session.actual_start || session.startedAt || session.created_at || session.createdAt)}
              </p>
            </div>
          </div>
        </section>

        {/* Timeline */}
        <section className="relative mt-2">
          <div className="timeline-line"></div>
          <div className="flex flex-col gap-6">
            {events.map((evt, idx) => (
              <div key={idx} className="relative pl-[40px] flex flex-col gap-1 transition-transform duration-200 hover:translate-x-1">
                <div className="absolute left-0 top-1 w-[40px] h-[40px] flex items-center justify-center z-10">
                  <div className={`w-3 h-3 ${evt.dotColor} rounded-full ring-4 ring-[#FAFAF7] ${evt.isProminent ? 'w-4 h-4 node-pulse' : ''}`}></div>
                </div>

                {evt.isProminent ? (
                  <div className="bg-[#FEF2F2] border border-[#ffdad6] rounded-xl p-3 z-10 relative">
                    <div className="flex justify-between items-center mb-1">
                      <h3 className="text-[18px] font-semibold text-[#ba1a1a] flex items-center gap-1">
                        {evt.title}
                        {evt.icon}
                      </h3>
                      <span className="font-mono text-[12px] text-[#ba1a1a]">{formatTime(evt.time)}</span>
                    </div>
                    <p className="text-[14px] text-[#261814] mb-2">{evt.description}</p>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => navigate(`/alerts/${evt.id}`)}
                        className="bg-[#ba1a1a] text-white px-3 py-1.5 rounded-full text-[10px] uppercase font-bold active:scale-95 transition-transform hover:opacity-90"
                      >
                        View Alert Info
                      </button>
                      <button 
                        onClick={() => triggerToast("Voice recording or audio stream is not available for this session.")}
                        className="border border-[#ba1a1a] text-[#ba1a1a] px-3 py-1.5 rounded-full text-[10px] uppercase font-bold active:scale-95 transition-transform hover:bg-[#ba1a1a]/5"
                      >
                        Contact Audio
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-center">
                      <h3 className="text-[18px] font-semibold flex items-center gap-1">
                        {evt.title}
                        {evt.icon}
                      </h3>
                      <span className="font-mono text-[12px] text-[#5a413a]">{formatTime(evt.time)}</span>
                    </div>
                    {evt.description && <p className="text-[14px] text-[#5a413a]">{evt.description}</p>}
                    
                    {evt.type === 'location' && (
                      <div className="bg-[#fff1ed] rounded-lg p-2 border border-[#e2bfb5] mt-1">
                        <p className="text-[14px] text-[#261814] flex items-center gap-1">
                          <MapPin size={16} />
                          {evt.location}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Actions */}
        <section className="mt-6 flex flex-col gap-3">
          <button 
            onClick={() => setShowDeletePrompt(true)}
            className="w-full h-12 bg-white border border-[#e2bfb5] text-[#ba1a1a] font-semibold flex items-center justify-center gap-2 rounded-lg active:scale-[0.98] transition-all hover:bg-[#ffdad6]/60 hover:border-[#ffdad6]"
          >
            <Trash2 size={20} />
            Delete This Session
          </button>
          <p className="text-[12px] font-medium text-[#5a413a] text-center px-6">
            Deleting this session will remove it from your history and the history of your emergency contacts.
          </p>
        </section>
      </main>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeletePrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-[320px] bg-white rounded-2xl p-6 shadow-xl text-center space-y-6"
            >
              <div className="mx-auto w-16 h-16 bg-[#ffdad6] rounded-full flex items-center justify-center">
                <Trash2 size={32} className="text-[#ba1a1a]" />
              </div>
              <div>
                <h3 className="text-[20px] font-bold text-[#261814]">Delete Session?</h3>
                <p className="text-[15px] text-[#5a413a] mt-2">
                  Are you sure you want to delete this session history record? This action cannot be undone.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setShowDeletePrompt(false)}
                  className="h-12 bg-gray-100 text-[#5a413a] font-bold rounded-xl active:scale-95 transition-transform"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    setShowDeletePrompt(false);
                    await handleDelete();
                  }}
                  className="h-12 bg-[#ba1a1a] text-white font-bold rounded-xl active:scale-95 transition-transform"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-[#261814] text-[#fff8f6] px-5 py-3 rounded-xl shadow-xl flex items-center gap-2 max-w-[90%] w-[340px] text-center justify-center font-semibold text-[13px] border border-[#e2bfb5]/20"
          >
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
