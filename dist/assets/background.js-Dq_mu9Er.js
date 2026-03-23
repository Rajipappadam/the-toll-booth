async function getTasks() {
  const { tasks = [] } = await chrome.storage.local.get("tasks");
  return tasks;
}
async function getBlockedSites() {
  const { blockedSites = [] } = await chrome.storage.local.get("blockedSites");
  return blockedSites;
}
async function getTimerDuration() {
  const { timerDuration = 15 } = await chrome.storage.local.get("timerDuration");
  return timerDuration;
}
async function getUnlocks() {
  const { unlocks = {} } = await chrome.storage.local.get("unlocks");
  return unlocks;
}
async function setUnlocks(unlocks) {
  await chrome.storage.local.set({ unlocks });
}
async function isUnlocked(hostname) {
  const unlocks = await getUnlocks();
  return typeof unlocks[hostname] === "number" && unlocks[hostname] > Date.now();
}
function normalizeHost(hostname) {
  return hostname.replace(/^www\./, "").toLowerCase();
}
async function checkBlocked(hostname) {
  const sites = await getBlockedSites();
  return sites.some((s) => hostname === s || hostname.endsWith("." + s));
}
async function updateBadge() {
  const unlocks = await getUnlocks();
  const now = Date.now();
  let min = Infinity;
  for (const exp of Object.values(unlocks)) {
    if (exp > now) min = Math.min(min, exp - now);
  }
  if (min === Infinity) {
    chrome.action.setBadgeText({ text: "" });
  } else {
    const mins = Math.ceil(min / 6e4);
    chrome.action.setBadgeText({ text: `${mins}m` });
    chrome.action.setBadgeBackgroundColor({ color: "#10B981" });
  }
}
chrome.webNavigation.onCommitted.addListener(
  async ({ tabId, url, frameId }) => {
    if (frameId !== 0) return;
    if (!url.startsWith("http")) return;
    let hostname;
    try {
      hostname = normalizeHost(new URL(url).hostname);
    } catch {
      return;
    }
    if (!await checkBlocked(hostname)) return;
    if (await isUnlocked(hostname)) {
      updateBadge();
      return;
    }
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
    const { visitCounts = {} } = await chrome.storage.local.get("visitCounts");
    visitCounts[hostname] = (visitCounts[hostname] || 0) + 1;
    await chrome.storage.local.set({ visitCounts });
    try {
      await chrome.tabs.sendMessage(tabId, { type: "SHOW_TOLL", site: hostname });
    } catch {
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ["src/content/content.js"]
        });
        await new Promise((r) => setTimeout(r, 100));
        await chrome.tabs.sendMessage(tabId, { type: "SHOW_TOLL", site: hostname });
      } catch (err) {
        console.error("[TollBooth] Failed to inject content.js:", err);
      }
    }
  },
  { url: [{ schemes: ["http", "https"] }] }
);
chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg.type === "TOLL_PAID") {
    handleTollPaid(msg.site).then(reply);
    return true;
  }
  if (msg.type === "GET_TASK") {
    pickRandomLocalTask().then(reply);
    return true;
  }
});
async function handleTollPaid(site) {
  const duration = await getTimerDuration();
  const unlocks = await getUnlocks();
  unlocks[site] = Date.now() + duration * 6e4;
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
chrome.alarms.onAlarm.addListener(async ({ name }) => {
  if (!name.startsWith("unlock_")) return;
  const site = name.slice("unlock_".length);
  const unlocks = await getUnlocks();
  delete unlocks[site];
  await setUnlocks(unlocks);
  await updateBadge();
});
chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get([
    "timerDuration",
    "blockedSites",
    "tasks"
  ]);
  const defaults = {};
  if (existing.timerDuration === void 0) defaults.timerDuration = 15;
  if (existing.blockedSites === void 0) defaults.blockedSites = [];
  if (existing.tasks === void 0) defaults.tasks = [];
  if (Object.keys(defaults).length) await chrome.storage.local.set(defaults);
  await updateBadge();
});
chrome.runtime.onStartup.addListener(updateBadge);
//# sourceMappingURL=background.js-Dq_mu9Er.js.map
