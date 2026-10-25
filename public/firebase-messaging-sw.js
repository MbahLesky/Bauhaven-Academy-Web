// firebase-messaging-sw.js
// Background Service Worker for Firebase Cloud Messaging (FCM) Web Push

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Native Push listener
self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    const notification = payload.notification || {};
    const title = notification.title || "Bauhaven Hub";
    const options = {
      body: notification.body || "",
      icon: notification.icon || "/favicon.ico",
      badge: "/favicon.ico",
      data: {
        url: (payload.data && payload.data.url) || payload.fcmOptions?.link || "/",
      },
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.error("Error handling push notification:", err);
  }
});

// Click listener to navigate to the relevant page
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/dashboard";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === targetUrl && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
