import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase only if the config is valid
let app;
let messaging: ReturnType<typeof getMessaging> | null = null;

try {
  app = initializeApp(firebaseConfig);
  messaging = getMessaging(app);
} catch (error) {
  console.warn('Firebase initialization failed (probably missing config):', error);
}

export { messaging, onMessage };

export async function requestNotificationPermission(): Promise<string | null> {
  try {
    if (!("Notification" in window)) {
      console.warn("This browser does not support desktop notifications");
      return null;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn("Notification permission was not granted:", permission);
      return null;
    }

    if (!messaging) {
      console.warn("FCM messaging not initialized. Permission granted but no token will be generated.");
      return null;
    }

    // Check if IndexedDB is available - required for Firebase Messaging (often blocked in Incognito)
    if (!window.indexedDB) {
      console.error("IndexedDB is not supported in this environment. Notifications may not work (common in Incognito mode).");
      return null;
    }

    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
    });
    return token;
  } catch (error: any) {
    if (error?.code === 'messaging/indexed-db-unsupported' || error?.message?.includes('indexedDB')) {
      console.error('FCM error: IndexedDB is unsupported. This is common in Incognito/Private mode.', error);
    } else {
      console.error('FCM token error:', error);
    }
    return null;
  }
}
