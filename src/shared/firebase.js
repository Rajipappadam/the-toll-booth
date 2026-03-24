/**
 * firebase.js — shared Firebase initializer
 *
 * Config is non-secret (public API key for client-side SDK).
 * Real security is enforced by Firebase Security Rules + Authentication.
 *
 * Analytics is guarded behind a typeof check because chrome extension
 * service workers have no `document`/`window`, which Analytics requires.
 * It will still fire on all HTML pages (popup, options, tollbooth).
 */

import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth/web-extension';
import { getAnalytics, isSupported } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const requiredEnvVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
];

const missingEnvVars = requiredEnvVars.filter((key) => !import.meta.env[key]);

if (missingEnvVars.length > 0) {
  throw new Error(
    `Missing Firebase environment variables: ${missingEnvVars.join(', ')}`,
  );
}

// Guard against double-initialisation across service-worker restarts and
// module hot-reloads — getApps() returns existing instances.
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const db   = getFirestore(app);
export const auth = getAuth(app);

// Analytics only works in browser page contexts (popup, options, tollbooth).
// isSupported() returns false in service workers, so we await it safely.
export let analytics = null;
isSupported().then((supported) => {
  if (supported) {
    analytics = getAnalytics(app);
  }
});

export default app;
