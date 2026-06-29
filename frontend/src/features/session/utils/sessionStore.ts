export interface Contact {
  id: string;
  name: string;
  phone: string;
  avatarUrl?: string;
  selected?: boolean;
}

export type TriggerType = 'SOS Button' | 'Voice Safe Word' | 'Power Button' | 'Missed Check-In' | null;
export type SessionStatus = 'active' | 'completed' | 'sos' | 'cancelled';

export interface CheckInEvent {
  timestamp: string;
  type: 'safe' | 'missed';
}

export interface SessionData {
  id: string; // Add ID for history tracking
  title: string;
  personName?: string;
  phone?: string;
  location: string;
  date: string;
  time: string;
  notes?: string;
  durationMinutes: number;
  contacts: Contact[];
  startedAt: string;
  
  // Extended fields for lifecycle tracking
  status: SessionStatus;
  checkIns: CheckInEvent[];
  sosTriggeredAt?: string | null;
  triggerType?: TriggerType;
  endedAt?: string | null;
}

const ACTIVE_SESSION_KEY = "active_safety_session";
const SESSION_HISTORY_KEY = "safety_session_history";

export const sessionStore = {
  // Active Session
  getActiveSession: (): SessionData | null => {
    const stored = localStorage.getItem(ACTIVE_SESSION_KEY);
    if (!stored) return null;
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error("Failed to parse active safety session", e);
      return null;
    }
  },
  
  setActiveSession: (session: SessionData) => {
    localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));
  },
  
  clearActiveSession: () => {
    localStorage.removeItem(ACTIVE_SESSION_KEY);
  },

  // Session History
  getHistory: (): SessionData[] => {
    const stored = localStorage.getItem(SESSION_HISTORY_KEY);
    if (!stored) return [];
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error("Failed to parse session history", e);
      return [];
    }
  },
  
  addToHistory: (session: SessionData) => {
    const history = sessionStore.getHistory();
    history.unshift(session); // Add to beginning
    localStorage.setItem(SESSION_HISTORY_KEY, JSON.stringify(history));
  },
  
  // Helpers
  generateId: () => Math.random().toString(36).substr(2, 9),
};
