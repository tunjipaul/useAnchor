import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster, toast } from "react-hot-toast";
import { messaging, onMessage } from "./lib/firebase";
import { useAuthStore } from "./features/auth/stores/useAuthStore";

// Feature: auth
import OnboardingScreen from "./features/auth/screens/OnboardingScreen";
import PhoneNumberEntryScreen from "./features/auth/screens/PhoneNumberEntryScreen";
import OTPVerificationScreen from "./features/auth/screens/OTPVerificationScreen";
import ProfileSetupScreen from "./features/auth/screens/ProfileSetupScreen";
import TrustedContactsScreen from "./features/auth/screens/TrustedContactsScreen";
import PermissionsScreen from "./features/auth/screens/PermissionsScreen";

// Feature: dashboard
import HomeScreen from "./features/dashboard/screens/HomeScreen";

// Feature: session
import CreateSessionScreen from "./features/session/screens/CreateSessionScreen";
import ActiveSessionScreen from "./features/session/screens/ActiveSessionScreen";
import SessionTimelineScreen from "./features/session/screens/SessionTimelineScreen";
import SOSActivatedScreen from "./features/session/screens/SOSActivatedScreen";
import SessionSummaryScreen from "./features/session/screens/SessionSummaryScreen";
import SessionHistoryScreen from "./features/session/screens/SessionHistoryScreen";

// Feature: contacts
import ContactsManagerScreen from "./features/contacts/screens/ContactsManagerScreen";
import ContactOptInScreen from "./features/contacts/screens/ContactOptInScreen";

// Feature: alert
import AlertLandingScreen from "./features/alert/screens/AlertLandingScreen";
import LiveLocationScreen from "./features/alert/screens/LiveLocationScreen";

// Feature: settings
import SettingsScreen from "./features/settings/screens/SettingsScreen";

// Feature: alerts (Trusted Contacts)
import EmergencyAlertsScreen from "./features/alerts/screens/EmergencyAlertsScreen";
import IncidentDetailsScreen from "./features/alerts/screens/IncidentDetailsScreen";
import IncidentResolvedScreen from "./features/alerts/screens/IncidentResolvedScreen";

import ProtectedRoute from "./components/ProtectedRoute";

import { WebSocketProvider } from "./providers/WebSocketProvider";

export default function App() {
  const initializeAuth = useAuthStore((state) => state.initialize);

  useEffect(() => {
    initializeAuth();
    
    // Set up FCM foreground message listener
    if (messaging) {
      const unsubscribe = onMessage(messaging, (payload) => {
        console.log("Received foreground message:", payload);
        if (payload.notification) {
          toast(payload.notification.title || "Emergency Alert", {
            duration: 8000,
            icon: '🚨',
            style: {
              background: '#ba1a1a',
              color: '#ffffff',
              fontWeight: 'bold'
            }
          });
        }
      });
      return () => unsubscribe();
    }
  }, [initializeAuth]);

  return (
    <WebSocketProvider>
      <BrowserRouter>
        <Toaster position="top-center" />
        <Routes>
          {/* Auth */}
          <Route path="/" element={<OnboardingScreen />} />
          <Route path="/auth/signup" element={<PhoneNumberEntryScreen />} />
          <Route path="/auth/login" element={<PhoneNumberEntryScreen />} />
          <Route path="/auth/verify" element={<OTPVerificationScreen />} />
          <Route path="/auth/profile-setup" element={<ProfileSetupScreen />} />
          <Route path="/auth/trusted-contacts" element={<TrustedContactsScreen />} />
          <Route path="/auth/permissions" element={<PermissionsScreen />} />

          <Route element={<ProtectedRoute />}>
            {/* Dashboard */}
            <Route path="/dashboard" element={<HomeScreen />} />

            {/* Session */}
            <Route path="/session/new" element={<CreateSessionScreen />} />
            <Route path="/session/active" element={<ActiveSessionScreen />} />
            <Route path="/session/summary" element={<SessionSummaryScreen />} />
            <Route path="/session/timeline/:id" element={<SessionTimelineScreen />} />
            <Route path="/session/history" element={<SessionHistoryScreen />} />
            <Route path="/session/sos" element={<SOSActivatedScreen />} />

            {/* Contacts */}
            <Route path="/contacts" element={<ContactsManagerScreen />} />
            <Route path="/contacts/opt-in" element={<ContactOptInScreen />} />

            {/* Alert */}
            <Route path="/alert" element={<AlertLandingScreen />} />
            <Route path="/alert/live" element={<LiveLocationScreen />} />

            {/* Alerts (Trusted Contacts) */}
            <Route path="/alerts" element={<EmergencyAlertsScreen />} />
            <Route path="/alerts/:id" element={<IncidentDetailsScreen />} />
            <Route path="/alerts/:id/resolved" element={<IncidentResolvedScreen />} />

            {/* Settings */}
            <Route path="/settings" element={<SettingsScreen />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </WebSocketProvider>
  );
}
