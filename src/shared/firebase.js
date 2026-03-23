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
  apiKey: 'AIzaSyA8LGskj6m-zORNcrpz9O1bN22ddaBeJDk',
  authDomain: 'the-toll-booth.firebaseapp.com',
  projectId: 'the-toll-booth',
  storageBucket: 'the-toll-booth.firebasestorage.app',
  messagingSenderId: '591194995140',
  appId: '1:591194995140:web:30291d0e81620d72e2cc91',
  measurementId: 'G-PTXRY26N75',
};

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
