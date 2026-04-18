/*
 * Firebase Messaging Service Worker
 */

importScripts('https://www.gstatic.com/firebasejs/10.10.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.10.0/firebase-messaging-compat.js');

// REPLACE WITH YOUR ACTUAL FIREBASE CONFIG FROM CONSOLE
const firebaseConfig = {
  apiKey: "AIzaSyDx0UGfBc-5hC539VVksN011N5DImznzEQ",
  authDomain: "bazarse-d4963.firebaseapp.com",
  projectId: "bazarse-d4963",
  storageBucket: "bazarse-d4963.firebasestorage.app",
  messagingSenderId: "1049973675081",
  appId: "1:1049973675081:web:44a9e65e94c375e0ab5b98"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Background message received:', payload);

  // ✅ CRITICAL: Role-based filtering to ensure isolation from other apps
  if (payload.data?.role !== 'delivery') {
    console.log('[firebase-messaging-sw.js] Ignoring non-delivery notification. Role:', payload.data?.role);
    return;
  }

  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/logo192.png', // Update with your actual icon path
    data: payload.data
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const orderId = event.notification.data?.order_id;
  
  // URL to open
  const urlToOpen = orderId 
    ? `/delivery/orders/${orderId}` 
    : '/delivery/dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window open with this app
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if ('focus' in client) {
          return client.focus();
        }
      }
      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
