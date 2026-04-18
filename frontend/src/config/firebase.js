import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

// REPLACE WITH YOUR ACTUAL FIREBASE CONFIG FROM CONSOLE
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
export const messaging = getMessaging(app);

// Check if config is still using placeholders
export const isConfigPlaceholder = !firebaseConfig.apiKey || firebaseConfig.apiKey === 'YOUR_API_KEY';

// REPLACE WITH YOUR ACTUAL VAPID KEY FROM FIREBASE CONSOLE
export const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || "YOUR_VAPID_PUBLIC_KEY";

export const isVapidPlaceholder = !VAPID_KEY || VAPID_KEY.includes('YOUR_VAPID');

export { getToken, onMessage };
