"use client";

import { useEffect, useState } from "react";
import { requestAndRegisterFcmToken, onForegroundFcmMessage } from "@/lib/firebase/fcm";
import { Bell, Check, X } from "lucide-react";

export function PushNotificationBanner() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "denied">("idle");

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("Notification" in window) ||
      !process.env.NEXT_PUBLIC_FIREBASE_API_KEY
    ) {
      return;
    }

    if (Notification.permission === "granted") {
      // User has already granted permission: keep token registration synchronized in background
      requestAndRegisterFcmToken().catch(() => {});
    } else if (Notification.permission === "default") {
      const dismissed = localStorage.getItem("bauhaven_fcm_dismissed");
      if (!dismissed) {
        setShowPrompt(true);
      }
    }

    // Handle incoming messages while the app is in the foreground
    const unsubscribe = onForegroundFcmMessage((payload) => {
      if (payload.notification?.title && Notification.permission === "granted") {
        new Notification(payload.notification.title, {
          body: payload.notification.body,
          icon: "/favicon.ico",
        });
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  async function handleEnable() {
    setLoading(true);
    const result = await requestAndRegisterFcmToken();
    setLoading(false);

    if (result.ok) {
      setStatus("success");
      setTimeout(() => setShowPrompt(false), 3000);
    } else {
      setStatus("denied");
      setTimeout(() => setShowPrompt(false), 4000);
    }
  }

  function handleDismiss() {
    setShowPrompt(false);
    if (typeof window !== "undefined") {
      localStorage.setItem("bauhaven_fcm_dismissed", "true");
    }
  }

  if (!showPrompt) return null;

  return (
    <aside
      aria-label="Notification permissions prompt"
      className="relative mb-4 flex flex-col items-start justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center text-foreground"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Bell className="h-4 w-4" />
        </div>
        <div className="text-xs">
          <span className="font-semibold block text-sm">Enable Web Push Notifications</span>
          <span className="text-muted-foreground">
            Get instant browser notifications for task assignments, milestone deadlines, and cohort announcements.
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
        {status === "success" ? (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
            <Check className="h-4 w-4" /> Enabled
          </span>
        ) : (
          <>
            <button
              type="button"
              onClick={handleEnable}
              disabled={loading}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Enabling..." : "Enable"}
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-neutral-100 hover:text-foreground"
              aria-label="Dismiss banner"
            >
              <X className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </aside>
  );
}
