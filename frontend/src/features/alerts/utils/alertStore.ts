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

const mockAlerts: AlertData[] = [
  {
    id: "alert-1",
    userId: "user-sarah",
    userName: "Sarah Jenkins",
    userAvatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuADgKvhfU1mMNJSMUNFz4zOvMN-HYNaYFFwZ4STbl9f9xUGhgJ6LVeSuNHHqmnXECm4Wzcxv-0WIPG4ZV5MiQkz1QxxqCLtm7dh5l1kCxvOkMIGI-6wS2y2AWq2mBmiSHat3Esk4K1UF0KFjvNzjIC-uzix5CnsqvGPIHo70NN6ozRDtDpJCWAsJg35V8IZdvMvqD_TDBTNpv82VrJHaEVTm8W4tIv_pTFRtqP4Z0JSwhfhbD0tHDds37lq-Y-yfPKGORtxYdl6Pog",
    triggeredAt: new Date(Date.now() - 2 * 60000).toISOString(), // 2 mins ago
    triggerReason: "SOS Triggered",
    sessionTitle: "Late Night Walk from Library",
    status: "active",
    lastKnownLocation: {
      lat: 41.9250,
      lng: -87.6441,
      address: "North Lincoln Ave & W Fullerton Pkwy"
    },
    batteryLevel: 82,
    signalStrength: "Strong"
  },
  {
    id: "alert-2",
    userId: "user-marcus",
    userName: "Marcus Thorne",
    userAvatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuB7Z6e0XWdDndLQ2MYHqasAvdwXKq1HOCrd6vNB1kfG6J7QPOmYBLMdl7aEbIwg1bo1jtodTmJ6jwbF1c0ZHZ32-isJzZvQEzjoKd7MgbZOVYSPBp8U50uAGF7gQCFOUgX5XUvZX_VvRc2sJpadqv7lStgcT4XV4XQPUdzjrhm3IqnYrqux3IC-O4IYKr3YNpjuVTuLdKbdyT3e6_o7oYyYVHaX-FnQ0wTO08kF47B0B765F-Caq1ggdNrGNwtMcumeVk2Qrj6RQUc",
    triggeredAt: new Date(Date.now() - 15 * 60000).toISOString(), // 15 mins ago
    triggerReason: "Missed Check-In",
    sessionTitle: "Evening Jog in Central Park",
    status: "active",
    lastKnownLocation: {
      lat: 40.7812,
      lng: -73.9665,
      address: "Central Park West & 85th St"
    },
    batteryLevel: 45,
    signalStrength: "Medium"
  },
  {
    id: "alert-3",
    userId: "user-elena",
    userName: "Elena Rossi",
    userAvatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuB-CNxRMKwZXWkFUwTHgdUwjdbkF4ESw3GSgJ4vPfVUr6-qmDOhL0ezz8x18v1BLFHc8Aoyx_s3SMQ50BL2Wd3goQ8ukzqd6BtlJbxJUPnZlGLa3bQ89k1fT1Q2SjmgWr8kM1KBFzQyOlfaKqZkkuIx5GPJy47ZSKKg_838okNqQa7yqGgthrXhkirrWwfh14-0tL8Lc6IdRT9d8p_E-Mh5ZjGHX5tYb_KXCMOIepSfIDUhXCshmkhcOHUYp0GfU9PYvH9fFKybV8E",
    triggeredAt: new Date(Date.now() - 60 * 60000).toISOString(), // 1 hr ago
    triggerReason: "SOS Triggered",
    sessionTitle: "Commute to South Station",
    status: "resolved",
    resolvedAt: new Date(Date.now() - 44 * 60000).toISOString(),
    resolutionTime: "11:58 PM",
    incidentDuration: "16 minutes",
    finalStatus: "Manual Check-in",
    lastKnownLocation: {
      lat: 42.3522,
      lng: -71.0552,
      address: "South Station, Boston"
    }
  }
];

class AlertStore {
  private alerts: AlertData[] = [...mockAlerts];

  getAlerts(): AlertData[] {
    // In a real app, this would come from an API/WebSocket
    const stored = localStorage.getItem("anchor_alerts");
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error("Failed to parse alerts from localStorage", e);
      }
    }
    // Initialize if empty
    this.saveAlerts(this.alerts);
    return this.alerts;
  }

  getAlertById(id: string): AlertData | undefined {
    return this.getAlerts().find(a => a.id === id);
  }

  resolveAlert(id: string, resolutionDetails: Partial<AlertData>) {
    const alerts = this.getAlerts();
    const index = alerts.findIndex(a => a.id === id);
    if (index !== -1) {
      alerts[index] = {
        ...alerts[index],
        status: "resolved",
        resolvedAt: new Date().toISOString(),
        resolutionTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        incidentDuration: "16 minutes", // Mock duration
        finalStatus: "Manual Check-in",
        ...resolutionDetails
      };
      this.saveAlerts(alerts);
    }
  }

  private saveAlerts(alerts: AlertData[]) {
    this.alerts = alerts;
    localStorage.setItem("anchor_alerts", JSON.stringify(alerts));
  }
  
  // Method to manually clear/reset state for testing
  resetStore() {
    this.alerts = [...mockAlerts];
    this.saveAlerts(this.alerts);
  }
}

export const alertStore = new AlertStore();
