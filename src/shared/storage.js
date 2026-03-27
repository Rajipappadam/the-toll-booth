import { pushFieldToFirestore, SYNCED_FIELDS } from './sync.js';

const DEFAULTS = {
  tasks: [],
  blockedSites: [],
  timerDuration: 15,
  visitCounts: {},
  unlocks: {},
};

async function writeSyncedField(field, value) {
  await chrome.storage.local.set({ [field]: value });
  const uid = await getUid();
  if (uid) {
    void pushFieldToFirestore(uid, field, value);
  }
}

export async function getAllSyncedData() {
  const data = await chrome.storage.local.get(SYNCED_FIELDS);
  return {
    tasks: data.tasks ?? DEFAULTS.tasks,
    blockedSites: data.blockedSites ?? DEFAULTS.blockedSites,
    timerDuration: data.timerDuration ?? DEFAULTS.timerDuration,
    visitCounts: data.visitCounts ?? DEFAULTS.visitCounts,
    unlocks: data.unlocks ?? DEFAULTS.unlocks,
  };
}

export async function applySyncedData(data) {
  const payload = {};
  for (const field of SYNCED_FIELDS) {
    if (data[field] !== undefined) {
      payload[field] = data[field];
    }
  }

  if (Object.keys(payload).length > 0) {
    await chrome.storage.local.set(payload);
  }
}

export async function getTasks() {
  const { tasks = DEFAULTS.tasks } = await chrome.storage.local.get('tasks');
  return tasks;
}

export async function setTasks(tasks) {
  await writeSyncedField('tasks', tasks);
}

export async function getBlockedSites() {
  const { blockedSites = DEFAULTS.blockedSites } = await chrome.storage.local.get('blockedSites');
  return blockedSites;
}

export async function setBlockedSites(sites) {
  await writeSyncedField('blockedSites', sites);
}

export async function getTimerDuration() {
  const { timerDuration = DEFAULTS.timerDuration } = await chrome.storage.local.get('timerDuration');
  return timerDuration;
}

export async function setTimerDuration(minutes) {
  await writeSyncedField('timerDuration', minutes);
}

export async function getVisitCounts() {
  const { visitCounts = DEFAULTS.visitCounts } = await chrome.storage.local.get('visitCounts');
  return visitCounts;
}

export async function setVisitCounts(visitCounts) {
  await writeSyncedField('visitCounts', visitCounts);
}

export async function getUnlocks() {
  const { unlocks = DEFAULTS.unlocks } = await chrome.storage.local.get('unlocks');
  return unlocks;
}

export async function setUnlocks(unlocks) {
  await writeSyncedField('unlocks', unlocks);
}

export async function isUnlocked(hostname) {
  const unlocks = await getUnlocks();
  return typeof unlocks[hostname] === 'number' && unlocks[hostname] > Date.now();
}

export async function getUid() {
  const { uid = null } = await chrome.storage.local.get('uid');
  return uid;
}

export async function setUid(uid) {
  await chrome.storage.local.set({ uid });
}

export async function getUserProfile() {
  const { userProfile = null } = await chrome.storage.local.get('userProfile');
  return userProfile;
}

export async function setUserProfile(userProfile) {
  await chrome.storage.local.set({ userProfile });
}
