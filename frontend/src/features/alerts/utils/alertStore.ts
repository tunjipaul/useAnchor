export type AlertStatus = "active" | "resolved";
export type AlertTrigger = "SOS Triggered" | "Missed Check-In";

export interface AlertData {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  triggeredAt: string;
  triggerReason: AlertTrigger;
  sessionTitle: string;
  status: AlertStatus;
  lastKnownLocation: {
    lat: number;
    lng: number;
    address: string;
  };
  batteryLevel?: number;
  signalStrength?: "Strong" | "Medium" | "Weak";
  resolvedAt?: string;
  resolutionTime?: string;
  incidentDuration?: string;
  finalStatus?: string;
}
