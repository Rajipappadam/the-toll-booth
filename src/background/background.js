import { onAuthStateChanged } from 'firebase/auth/web-extension';

import { auth } from '../shared/firebase.js';
import {
  getBlockedSites,
  getTasks,
  getTimerDuration,
  getUnlocks,
  getVisitCounts,
  isUnlocked,
  setUid,
  setUnlocks,
  setUserProfile,
  setVisitCounts,
} from '../shared/storage.js';

function normalizeHost(hostname) {
  return hostname.replace(/^www\./, '').toLowerCase();
}

async function checkBlocked(hostname) {
  const sites = await getBlockedSites();
  return sites.some((site) => hostname === site || hostname.endsWith(`.${site}`));
}

async function updateBadge() {
  const unlocks = await getUnlocks();
  const now = Date.now();
  let min = Infinity;

  for (const expiresAt of Object.values(unlocks)) {
    if (expiresAt > now) {
      min = Math.min(min, expiresAt - now);
    }
  }

  if (min === Infinity) {
    chrome.action.setBadgeText({ text: '' });
    return;
  }

  chrome.action.setBadgeText({ text: `${Math.ceil(min / 60_000)}m` });
  chrome.action.setBadgeBackgroundColor({ color: '#10B981' });
}

chrome.webNavigation.onCompleted.addListener(
  async ({ tabId, url, frameId }) => {
    if (frameId !== 0 || !url.startsWith('http')) return;

    let hostname;
    try {
      hostname = normalizeHost(new URL(url).hostname);
    } catch {
      return;
    }

    if (!(await checkBlocked(hostname))) return;
    if (await isUnlocked(hostname)) {
      await updateBadge();
      return;
    }

    const unlocks = await getUnlocks();
    const now = Date.now();
    let dirty = false;

    for (const [host, expiresAt] of Object.entries(unlocks)) {
      if (expiresAt <= now) {
        delete unlocks[host];
        dirty = true;
      }
    }

    if (dirty) {
      await setUnlocks(unlocks);
    }

    const visitCounts = await getVisitCounts();
    visitCounts[hostname] = (visitCounts[hostname] || 0) + 1;
    await setVisitCounts(visitCounts);

    chrome.tabs.sendMessage(tabId, { type: 'SHOW_TOLL', site: hostname });
  },
  { url: [{ schemes: ['http', 'https'] }] },
);

chrome.runtime.onMessage.addListener((message, _sender, reply) => {
  if (message.type === 'TOLL_PAID') {
    handleTollPaid(message.site).then(reply);
    return true;
  }

  if (message.type === 'GET_TASK') {
    pickRandomLocalTask().then(reply);
    return true;
  }

  return false;
});

async function handleTollPaid(site) {
  const duration = await getTimerDuration();
  const unlocks = await getUnlocks();
  unlocks[site] = Date.now() + duration * 60_000;
  await setUnlocks(unlocks);
  chrome.alarms.create(`unlock_${site}`, { delayInMinutes: duration });
  await updateBadge();
  return { ok: true };
}

async function pickRandomLocalTask() {
  const tasks = await getTasks();
  if (tasks.length === 0) {
    return { task: null };
  }

  return { task: tasks[Math.floor(Math.random() * tasks.length)] };
}

chrome.alarms.onAlarm.addListener(async ({ name }) => {
  if (!name.startsWith('unlock_')) return;

  const site = name.slice('unlock_'.length);
  const unlocks = await getUnlocks();
  delete unlocks[site];
  await setUnlocks(unlocks);
  await updateBadge();
});

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get([
    'timerDuration',
    'blockedSites',
    'tasks',
    'visitCounts',
    'unlocks',
  ]);

  const defaults = {};
  if (existing.timerDuration === undefined) defaults.timerDuration = 15;
  if (existing.blockedSites === undefined) defaults.blockedSites = [];
  if (existing.tasks === undefined) defaults.tasks = [];
  if (existing.visitCounts === undefined) defaults.visitCounts = {};
  if (existing.unlocks === undefined) defaults.unlocks = {};

  if (Object.keys(defaults).length > 0) {
    await chrome.storage.local.set(defaults);
  }

  await updateBadge();
});

chrome.runtime.onStartup.addListener(updateBadge);

onAuthStateChanged(auth, async (user) => {
  await Promise.all([
    setUid(user?.uid ?? null),
    setUserProfile(
      user
        ? {
            email: user.email ?? '',
            displayName: user.displayName ?? '',
            photoURL: user.photoURL ?? '',
          }
        : null,
    ),
  ]);
});
