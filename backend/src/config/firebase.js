const admin = require('firebase-admin');
const { env } = require('./env');

let firebaseApp;

const initFirebase = () => {
  if (firebaseApp || !env.FIREBASE_PROJECT_ID) {
    return firebaseApp;
  }

  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert({
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: env.FIREBASE_PRIVATE_KEY
    })
  });

  return firebaseApp;
};

module.exports = { initFirebase };
