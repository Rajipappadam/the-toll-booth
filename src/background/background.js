/**
 * background.js — Service worker
 * Responsibilities: nav listener, toll gate logic, timer management, badge updates.
 */

import {
  getBlockedSites,
  getTimerDuration,
  getTasks,
  getUnlocks,
  setUnlocks,
  isUnlocked,
} from '../shared/storage.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeHost(hostname) {
  return hostname.replace(/^www\./, '').toLowerCase();
}

async function checkBlocked(hostname) {
  const sites = await getBlockedSites();
  return sites.some((s) => hostname === s || hostname.endsWith('.' + s));
}

async function updateBadge() {
  const unlocks = await getUnlocks();
  const now = Date.now();
  let min = Infinity;
  for (const exp of Object.values(unlocks)) {
    if (exp > now) min = Math.min(min, exp - now);
  }
  if (min === Infinity) {
    chrome.action.setBadgeText({ text: '' });
  } else {
    const mins = Math.ceil(min / 60_000);
    chrome.action.setBadgeText({ text: `${mins}m` });
    chrome.action.setBadgeBackgroundColor({ color: '#10B981' });
  }
}

// ── Navigation listener ───────────────────────────────────────────────────────

chrome.webNavigation.onCommitted.addListener(
  async ({ tabId, url, frameId }) => {
    if (frameId !== 0) return;
    if (!url.startsWith('http')) return;

    let hostname;
    try {
      hostname = normalizeHost(new URL(url).hostname);
    } catch {
      return;
    }

    if (!(await checkBlocked(hostname))) return;
    if (await isUnlocked(hostname)) {
      updateBadge();
      return;
    }

    // Prune expired unlocks
    const unlocks = await getUnlocks();
    const now = Date.now();
    let dirty = false;
    for (const [host, exp] of Object.entries(unlocks)) {
      if (exp <= now) {
        delete unlocks[host];
        dirty = true;
      }
    }
    if (dirty) await setUnlocks(unlocks);

    // Track visit count
    const { visitCounts = {} } = await chrome.storage.local.get('visitCounts');
    visitCounts[hostname] = (visitCounts[hostname] || 0) + 1;
    await chrome.storage.local.set({ visitCounts });

    // Signal content script to show the toll overlay
    try {
      await chrome.tabs.sendMessage(tabId, { type: 'SHOW_TOLL', site: hostname });
    } catch {
      // Content script not ready yet — inject it dynamically
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['src/content/content.js'],
        });
        // Small delay for script to initialise its listener
        await new Promise((r) => setTimeout(r, 100));
        await chrome.tabs.sendMessage(tabId, { type: 'SHOW_TOLL', site: hostname });
      } catch (err) {
        console.error('[TollBooth] Failed to inject content.js:', err);
      }
    }
  },
  { url: [{ schemes: ['http', 'https'] }] },
);

// ── Message handlers ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg.type === 'TOLL_PAID') {
    handleTollPaid(msg.site).then(reply);
    return true;
  }
  if (msg.type === 'GET_TASK') {
    pickRandomLocalTask().then(reply);
    return true;
  }
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
  if (tasks.length === 0) return { task: null };
  return { task: tasks[Math.floor(Math.random() * tasks.length)] };
}

// ── Alarm handler ─────────────────────────────────────────────────────────────

chrome.alarms.onAlarm.addListener(async ({ name }) => {
  if (!name.startsWith('unlock_')) return;
  const site = name.slice('unlock_'.length);
  const unlocks = await getUnlocks();
  delete unlocks[site];
  await setUnlocks(unlocks);
  await updateBadge();
});

// ── Init ──────────────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get([
    'timerDuration',
    'blockedSites',
    'tasks',
  ]);
  const defaults = {};
  if (existing.timerDuration === undefined) defaults.timerDuration = 15;
  if (existing.blockedSites === undefined) defaults.blockedSites = [];
  if (existing.tasks === undefined) defaults.tasks = [];
  if (Object.keys(defaults).length) await chrome.storage.local.set(defaults);
  await updateBadge();
});

chrome.runtime.onStartup.addListener(updateBadge);
