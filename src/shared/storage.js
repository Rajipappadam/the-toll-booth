/**
 * storage.js — typed wrappers around chrome.storage.local
 *
 * Acts as the fast local cache / offline layer. The background service worker
 * is responsible for keeping these values in sync with Firestore whenever the
 * user is authenticated.
 *
 * Schema (all keys in chrome.storage.local):
 *   tasks          — Array<{ id: string, text: string }>
 *   blockedSites   — Array<string>   (bare hostnames, e.g. "youtube.com")
 *   timerDuration  — number          (minutes granted after paying the toll)
 *   unlocks        — Record<hostname, expiresAtMs>
 *   uid            — string | null   (Firebase user id, set by background)
 */

/** @returns {Promise<Array<{id: string, text: string}>>} */
export async function getTasks() {
  const { tasks = [] } = await chrome.storage.local.get('tasks');
  return tasks;
}

/** @param {Array<{id: string, text: string}>} tasks */
export async function setTasks(tasks) {
  await chrome.storage.local.set({ tasks });
}

/** @returns {Promise<string[]>} */
export async function getBlockedSites() {
  const { blockedSites = [] } = await chrome.storage.local.get('blockedSites');
  return blockedSites;
}

/** @param {string[]} sites */
export async function setBlockedSites(sites) {
  await chrome.storage.local.set({ blockedSites: sites });
}

/** @returns {Promise<number>} minutes */
export async function getTimerDuration() {
  const { timerDuration = 15 } = await chrome.storage.local.get('timerDuration');
  return timerDuration;
}

/** @param {number} minutes */
export async function setTimerDuration(minutes) {
  await chrome.storage.local.set({ timerDuration: minutes });
}

/** @returns {Promise<Record<string, number>>} hostname → expiry timestamp ms */
export async function getUnlocks() {
  const { unlocks = {} } = await chrome.storage.local.get('unlocks');
  return unlocks;
}

/** @param {Record<string, number>} unlocks */
export async function setUnlocks(unlocks) {
  await chrome.storage.local.set({ unlocks });
}

/**
 * Check if a hostname is currently unlocked (toll already paid, timer active).
 * @param {string} hostname
 * @returns {Promise<boolean>}
 */
export async function isUnlocked(hostname) {
  const unlocks = await getUnlocks();
  return typeof unlocks[hostname] === 'number' && unlocks[hostname] > Date.now();
}

/** @returns {Promise<string|null>} */
export async function getUid() {
  const { uid = null } = await chrome.storage.local.get('uid');
  return uid;
}

/** @param {string|null} uid */
export async function setUid(uid) {
  await chrome.storage.local.set({ uid });
}
