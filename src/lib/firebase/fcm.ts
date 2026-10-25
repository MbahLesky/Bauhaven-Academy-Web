import { getToken, onMessage, type MessagePayload } from "firebase/messaging";
import { getFirebaseMessagingInstance } from "./client";
import { createClient } from "@/lib/supabase/client";

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || "";

/**
 * Requests browser push notification permission and retrieves an FCM registration token.
 */
export async function requestAndRegisterFcmToken(): Promise<{
  ok: boolean;
  token?: string;
  error?: string;
}> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return { ok: false, error: "Push notifications are not supported on this browser." };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return { ok: false, error: "Notification permission was denied." };
    }

    const messaging = await getFirebaseMessagingInstance();
    if (!messaging) {
      return { ok: false, error: "Firebase messaging is not configured." };
    }

    // Register service worker if not already registered
    let registration: ServiceWorkerRegistration | undefined;
    if ("serviceWorker" in navigator) {
      registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
        scope: "/",
      });
      await navigator.serviceWorker.ready;
    }

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY || undefined,
      serviceWorkerRegistration: registration,
    });

    if (!token) {
      return { ok: false, error: "No registration token available." };
    }

    // Persist token in Supabase fcm_device_tokens table
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();

    if (userData?.user?.id) {
      const { error: upsertError } = await (supabase.from("fcm_device_tokens" as any) as any).upsert(
        {
          profile_id: userData.user.id,
          token,
          platform: "web",
          device_info: {
            userAgent: navigator.userAgent,
            language: navigator.language,
          },
          last_used_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "profile_id,token" }
      );

      if (upsertError) {
        console.warn("Could not save FCM token to database:", upsertError.message);
      }
    }

    return { ok: true, token };
  } catch (err) {
    console.error("Error obtaining FCM token:", err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Listens for FCM push notifications arriving while the app is in the foreground.
 */
export function onForegroundFcmMessage(callback: (payload: MessagePayload) => void): (() => void) | undefined {
  if (typeof window === "undefined") return undefined;

  let unsubscribe: (() => void) | undefined;
  getFirebaseMessagingInstance().then((messaging) => {
    if (messaging) {
      unsubscribe = onMessage(messaging, (payload) => {
        callback(payload);
      });
    }
  });

  return () => {
    if (unsubscribe) unsubscribe();
  };
}
