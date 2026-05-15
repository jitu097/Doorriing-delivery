const admin = require('firebase-admin');
const { env } = require('./env');

let firebaseApp;

const initFirebase = () => {
  if (firebaseApp) {
    // Already initialised — return the existing app
    return firebaseApp;
  }

  if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) {
    console.error('[Firebase] ❌ Missing Firebase credentials in environment variables.');
    console.error(`[Firebase]   FIREBASE_PROJECT_ID    : ${env.FIREBASE_PROJECT_ID ? '✓ set' : '✗ MISSING'}`);
    console.error(`[Firebase]   FIREBASE_CLIENT_EMAIL  : ${env.FIREBASE_CLIENT_EMAIL ? '✓ set' : '✗ MISSING'}`);
    console.error(`[Firebase]   FIREBASE_PRIVATE_KEY   : ${env.FIREBASE_PRIVATE_KEY ? '✓ set' : '✗ MISSING'}`);
    return null;
  }

  try {
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId:   env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey:  env.FIREBASE_PRIVATE_KEY
      })
    });
    console.log(`[Firebase] ✅ Firebase Admin SDK initialised (project: ${env.FIREBASE_PROJECT_ID})`);
  } catch (err) {
    console.error('[Firebase] ❌ Failed to initialise Firebase Admin SDK:', err.message);
    return null;
  }

  return firebaseApp;
};

/**
 * Returns the Firebase Messaging instance tied to the initialised app.
 * Always call initFirebase() before this.
 */
const getMessaging = () => {
  const app = firebaseApp || initFirebase();
  if (!app) {
    throw new Error('[Firebase] Firebase app is not initialised. Check your environment variables.');
  }
  return admin.messaging(app);
};

module.exports = { initFirebase, getMessaging };
