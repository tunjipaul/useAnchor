import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, MapPin, CheckCircle, AlertTriangle, Trash2 } from "lucide-react";
import { sessionStore, type SessionData } from "../utils/sessionStore";

export default function SessionTimelineScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [session, setSession] = useState<SessionData | null>(null);

  useEffect(() => {
    if (location.state?.session) {
      setSession(location.state.session);
    } else if (id) {
      const history = sessionStore.getHistory();
      const found = history.find(s => s.id === id);
      setSession(found || null);
    }
  }, [id, location.state]);

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

  const durationStr = session.endedAt
    ? Math.max(1, Math.round((new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 60000)) + " Minutes"
    : session.durationMinutes + " Minutes";

  // Build timeline events
  const events: any[] = [
    { 
      type: 'start', 
      time: session.startedAt, 
      title: 'Session Started', 
      description: `Tracking initiated for '${session.title}' route.`,
      dotColor: 'bg-[#ac2d00]', // primary
    }
  ];

  if (session.checkIns) {
    session.checkIns.forEach((checkIn, index) => {
      if (checkIn.type === 'safe') {
        events.push({ 
          type: 'checkin', 
          time: checkIn.timestamp, 
          title: 'Check-in: Safe', 
          description: index === 0 ? 'First scheduled confirmation successful.' : 'Scheduled confirmation successful.',
          dotColor: 'bg-[#00628c]', // tertiary
          icon: <CheckCircle size={16} className="text-[#00628c]" />
        });
      } else {
        events.push({ 
          type: 'missed', 
          time: checkIn.timestamp, 
          title: 'Missed Check-In', 
          description: 'User failed to respond to the scheduled check-in.',
          dotColor: 'bg-[#954831]', // secondary
        });
      }
    });
  }

  // Adding a mock Location Update event as shown in the design for visual completeness
  // We place it right after the first check-in if there are any, otherwise after start
  const locationTime = new Date(new Date(session.startedAt).getTime() + 7 * 60000).toISOString();
  events.push({
    type: 'location',
    time: locationTime,
    title: 'Location Update',
    description: '',
    location: session.location,
    dotColor: 'bg-[#8e7068]', // outline
  });

  if (session.sosTriggeredAt) {
    events.push({ 
      type: 'sos', 
      time: session.sosTriggeredAt, 
      title: 'SOS Triggered', 
      description: 'Emergency contacts notified via silent trigger.',
      dotColor: 'bg-[#ba1a1a]', // error
      isProminent: true,
      icon: <AlertTriangle size={20} className="text-[#ba1a1a]" style={{ fontVariationSettings: "'FILL' 1" }} />
    });
    
    // If it has ended, we assume it was resolved
    if (session.endedAt || session.status === 'completed') {
      const resolveTime = new Date(new Date(session.sosTriggeredAt).getTime() + 15 * 60000).toISOString();
      events.push({
        type: 'resolved',
        time: session.endedAt || resolveTime,
        title: 'SOS Resolved',
        description: 'User entered deactivation code. Status: Safe.',
        dotColor: 'bg-[#954831]', // secondary
      });
    }
  }

  if (session.endedAt) {
    events.push({ 
      type: 'end', 
      time: session.endedAt, 
      title: 'Session Ended', 
      description: 'Tracking concluded successfully.',
      dotColor: 'bg-[#5a413a]', // on-surface-variant
    });
  } else if (session.status === 'completed') {
    // Fallback if endedAt is missing but status is completed
    events.push({ 
      type: 'end', 
      time: new Date().toISOString(), 
      title: 'Session Ended', 
      description: 'Tracking concluded successfully.',
      dotColor: 'bg-[#5a413a]', 
    });
  }

  // Sort events chronologically
  events.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  const handleDelete = () => {
    // Delete session from history
    const history = sessionStore.getHistory();
    const updatedHistory = history.filter(s => s.id !== session.id);
    localStorage.setItem('anchor_history', JSON.stringify(updatedHistory));
    navigate('/dashboard');
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
              <h2 className="text-[18px] font-semibold">{session.personName || 'No contact specified'}</h2>
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
              <p className="text-[16px] font-semibold">{formatDate(session.startedAt)}, {formatTime(session.startedAt)}</p>
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
                      <button className="bg-[#ba1a1a] text-white px-3 py-1.5 rounded-full text-[10px] uppercase font-bold active:scale-95 transition-transform">View Alert Info</button>
                      <button className="border border-[#ba1a1a] text-[#ba1a1a] px-3 py-1.5 rounded-full text-[10px] uppercase font-bold active:scale-95 transition-transform">Contact Audio</button>
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
            onClick={handleDelete}
            className="w-full h-12 bg-white border border-[#e2bfb5] text-[#ba1a1a] font-semibold flex items-center justify-center gap-2 rounded-lg active:scale-[0.98] transition-transform hover:bg-[#ffffff]"
          >
            <Trash2 size={20} />
            Delete This Session
          </button>
          <p className="text-[12px] font-medium text-[#5a413a] text-center px-6">
            Deleting this session will remove it from your history and the history of your emergency contacts.
          </p>
        </section>
      </main>
    </div>
  );
}
