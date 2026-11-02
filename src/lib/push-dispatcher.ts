import { createClient } from "@/lib/supabase/server";

export interface PushNotificationPayload {
  recipientIds?: string[];
  topic?: string;
  title: string;
  body: string;
  url?: string;
  type?: string;
  data?: Record<string, string>;
}

/**
 * Dispatches a push notification via the `send-push-notification` Edge Function.
 * Delivers to FCM mobile apps and Web push subscribers.
 * Best-effort and non-blocking.
 */
export async function sendPushNotification(
  payload: PushNotificationPayload
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.functions.invoke("send-push-notification", {
      body: {
        recipient_ids: payload.recipientIds,
        topic: payload.topic,
        title: payload.title,
        body: payload.body,
        url: payload.url,
        type: payload.type || "system",
        data: payload.data,
      },
    });

    if (error) {
      console.warn("sendPushNotification warning:", error);
      return { ok: false, error: String(error) };
    }

    return { ok: true };
  } catch (err) {
    console.error("sendPushNotification exception:", err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
