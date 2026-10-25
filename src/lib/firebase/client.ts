import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getMessaging, type Messaging, isSupported } from "firebase/messaging";

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
};

export function getFirebaseClientApp(): FirebaseApp | null {
  if (typeof window === "undefined" || !firebaseConfig.apiKey) {
    return null;
  }
  return getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
}

export async function getFirebaseMessagingInstance(): Promise<Messaging | null> {
  if (typeof window === "undefined") return null;
  const supported = await isSupported().catch(() => false);
  if (!supported) return null;

  const app = getFirebaseClientApp();
  if (!app) return null;

  try {
    return getMessaging(app);
  } catch (err) {
    console.warn("Could not initialize Firebase Messaging:", err);
    return null;
  }
}

