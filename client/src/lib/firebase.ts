/**
 * Firebase Client SDK Configuration
 * For receiving push notifications via Firebase Cloud Messaging
 */
import { initializeApp, getApps, getApp } from "firebase/app";
import { getMessaging, getToken, onMessage, Messaging, MessagePayload } from "firebase/messaging";
import { pushTokensApi } from "./api/pushTokens";

const FCM_TOKEN_STORAGE_KEY = "crm_fcm_token";

export function getStoredFcmToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(FCM_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredFcmToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FCM_TOKEN_STORAGE_KEY, token);
  } catch {
    // Ignore storage errors
  }
}

export function clearStoredFcmToken(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(FCM_TOKEN_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase
let app = getApps().length > 0 ? getApp() : null;
let messaging: Messaging | null = null;

export function isFirebaseConfigured(): boolean {
  return !!(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.messagingSenderId
  );
}

export function initializeFirebase() {
  if (!isFirebaseConfigured()) {
    console.log("[Firebase] Not configured - push notifications disabled");
    return null;
  }

  try {
    if (!app) {
      app = initializeApp(firebaseConfig);
    }
    return app;
  } catch (error) {
    console.error("[Firebase] Failed to initialize:", error);
    return null;
  }
}

/**
 * Get Firebase Messaging instance
 */
export function getFirebaseMessaging(): Messaging | null {
  if (messaging) return messaging;

  if (!app) {
    app = initializeFirebase();
    if (!app) return null;
  }

  try {
    // Check if browser supports notifications
    if (!("Notification" in window)) {
      console.log("[Firebase] Browser does not support notifications");
      return null;
    }

    // Check if service worker is supported
    if (!("serviceWorker" in navigator)) {
      console.log("[Firebase] Service workers not supported");
      return null;
    }

    messaging = getMessaging(app);
    return messaging;
  } catch (error) {
    console.error("[Firebase] Failed to get messaging:", error);
    return null;
  }
}

/**
 * Request notification permission and get FCM token
 */
export async function requestNotificationPermission(): Promise<string | null> {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.log("[Firebase] Notification permission denied");
      return null;
    }

    const messagingInstance = getFirebaseMessaging();
    if (!messagingInstance) return null;

    // Register service worker
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    console.log("[Firebase] Service worker registered:", registration.scope);

    // Ensure SW receives config for background messages
    const readyRegistration = await navigator.serviceWorker.ready;
    const activeWorker = readyRegistration.active || registration.active || registration.waiting;
    if (activeWorker) {
      activeWorker.postMessage({ type: "firebase-config", config: firebaseConfig });
    }

    // Get FCM token
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    const token = await getToken(messagingInstance, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });

    if (token) {
      console.log("[Firebase] FCM token obtained");
      // Save token to server
      await saveTokenToServer(token);
      setStoredFcmToken(token);
      return token;
    } else {
      console.log("[Firebase] No token available");
      return null;
    }
  } catch (error) {
    console.error("[Firebase] Error requesting permission:", error);
    return null;
  }
}

/**
 * Save FCM token to server
 */
async function saveTokenToServer(token: string) {
  try {
    await pushTokensApi.register({ token });
    console.log("[Firebase] Token saved to server");
  } catch (error) {
    console.error("[Firebase] Error saving token:", error);
  }
}

/**
 * Listen for foreground messages
 */
export function onForegroundMessage(callback: (payload: MessagePayload) => void): () => void {
  const messagingInstance = getFirebaseMessaging();
  if (!messagingInstance) {
    return () => {};
  }

  const unsubscribe = onMessage(messagingInstance, (payload) => {
    console.log("[Firebase] Foreground message received:", payload);
    callback(payload);
  });

  return unsubscribe;
}

/**
 * Check if notifications are enabled
 */
export function areNotificationsEnabled(): boolean {
  if (!("Notification" in window)) return false;
  return Notification.permission === "granted";
}

/**
 * Get current notification permission status
 */
export function getNotificationPermissionStatus(): NotificationPermission | "unsupported" {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission;
}
