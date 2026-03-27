import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

import { db } from './firebase.js';

export const SYNCED_FIELDS = [
  'tasks',
  'blockedSites',
  'timerDuration',
  'visitCounts',
  'unlocks',
];

function getFieldRef(uid, field) {
  return doc(db, 'users', uid, 'data', field);
}

function isOffline() {
  return typeof navigator !== 'undefined' && 'onLine' in navigator && !navigator.onLine;
}

export async function pushFieldToFirestore(uid, field, value) {
  if (!uid || !SYNCED_FIELDS.includes(field) || isOffline()) return false;

  try {
    await setDoc(
      getFieldRef(uid, field),
      {
        value,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    return true;
  } catch (error) {
    console.warn(`Firestore sync failed for ${field}`, error);
    return false;
  }
}

export async function pushToFirestore(uid, data) {
  if (!uid || isOffline()) return false;

  const entries = Object.entries(data).filter(([field]) => SYNCED_FIELDS.includes(field));
  if (entries.length === 0) return false;

  await Promise.all(entries.map(([field, value]) => pushFieldToFirestore(uid, field, value)));
  return true;
}

export async function pullFromFirestore(uid) {
  if (!uid) return {};

  const docs = await Promise.all(
    SYNCED_FIELDS.map(async (field) => {
      try {
        const snapshot = await getDoc(getFieldRef(uid, field));
        if (!snapshot.exists()) return null;
        return [field, snapshot.data().value];
      } catch (error) {
        console.warn(`Firestore pull failed for ${field}`, error);
        return null;
      }
    }),
  );

  return Object.fromEntries(docs.filter(Boolean));
}
