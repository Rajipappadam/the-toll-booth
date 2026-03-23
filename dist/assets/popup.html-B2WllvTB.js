import "./modulepreload-polyfill-DaKOjhqt.js";
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    const id = tab.dataset.tab;
    document.querySelectorAll(".tab").forEach(
      (t) => t.classList.toggle("active", t.dataset.tab === id)
    );
    document.querySelectorAll(".tab-pane").forEach(
      (p) => p.classList.toggle("active", p.id === `pane-${id}`)
    );
  });
});
async function init() {
  await Promise.all([
    renderTasks(),
    renderSites(),
    renderUnlocks(),
    loadSettings()
  ]);
  await renderStats();
  const { anthropicKey } = await chrome.storage.local.get("anthropicKey");
  if (anthropicKey) document.getElementById("ai-btn-row").style.display = "flex";
}
async function renderTasks() {
  const tasks = await getTasks();
  document.getElementById("task-count").textContent = tasks.length;
  const list = document.getElementById("task-list");
  if (tasks.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">📝</span>
        <p>No tasks yet — add one above!</p>
      </div>`;
    return;
  }
  list.innerHTML = tasks.map(
    (t) => `
      <div class="list-item">
        <span class="item-text">${escapeHtml(t.text)}</span>
        <button class="btn-delete" data-id="${t.id}" title="Remove">✕</button>
      </div>`
  ).join("");
  list.querySelectorAll(".btn-delete").forEach(
    (btn) => btn.addEventListener("click", () => deleteTask(btn.dataset.id))
  );
}
async function addTask() {
  const input = document.getElementById("task-input");
  const text = input.value.trim();
  if (!text) return;
  const tasks = await getTasks();
  tasks.push({ id: uid(), text });
  await chrome.storage.local.set({ tasks });
  input.value = "";
  await renderTasks();
  await renderStats();
}
async function deleteTask(id) {
  const tasks = await getTasks();
  await chrome.storage.local.set({ tasks: tasks.filter((t) => t.id !== id) });
  await renderTasks();
  await renderStats();
}
document.getElementById("add-task-btn").addEventListener("click", addTask);
document.getElementById("task-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") addTask();
});
async function renderSites() {
  const sites = await getSites();
  document.getElementById("site-count").textContent = sites.length;
  const list = document.getElementById("site-list");
  if (sites.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">🔒</span>
        <p>No blocked sites yet.</p>
      </div>`;
    return;
  }
  list.innerHTML = sites.map(
    (s) => `
      <div class="list-item">
        <span class="item-text site-text">${escapeHtml(s)}</span>
        <button class="btn-delete" data-site="${escapeHtml(s)}" title="Remove">✕</button>
      </div>`
  ).join("");
  list.querySelectorAll(".btn-delete").forEach(
    (btn) => btn.addEventListener("click", () => deleteSite(btn.dataset.site))
  );
}
async function addSite() {
  const input = document.getElementById("site-input");
  let value = input.value.trim().toLowerCase();
  if (!value) return;
  value = value.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  if (!value) return;
  const sites = await getSites();
  if (!sites.includes(value)) {
    sites.push(value);
    await chrome.storage.local.set({ blockedSites: sites });
  }
  input.value = "";
  await renderSites();
  await renderStats();
}
async function deleteSite(site) {
  const sites = await getSites();
  await chrome.storage.local.set({ blockedSites: sites.filter((s) => s !== site) });
  await renderSites();
  await renderStats();
}
document.getElementById("add-site-btn").addEventListener("click", addSite);
document.getElementById("site-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") addSite();
});
async function renderUnlocks() {
  const { unlocks = {} } = await chrome.storage.local.get("unlocks");
  const section = document.getElementById("unlocks-section");
  const list = document.getElementById("unlocks-list");
  const now = Date.now();
  const active = Object.entries(unlocks).filter(([, exp]) => exp > now);
  section.style.display = active.length ? "block" : "none";
  if (!active.length) return;
  list.innerHTML = active.map(([site, exp]) => {
    const mins = Math.ceil((exp - now) / 6e4);
    return `
        <div class="unlock-item">
          <span class="unlock-site">${escapeHtml(site)}</span>
          <span class="unlock-time">${mins}m left</span>
        </div>`;
  }).join("");
}
async function loadSettings() {
  const data = await chrome.storage.local.get([
    "timerDuration",
    "todoistToken",
    "todoistProjectId",
    "anthropicKey"
  ]);
  document.getElementById("timer-input").value = data.timerDuration ?? 15;
  document.getElementById("todoist-token").value = data.todoistToken ?? "";
  document.getElementById("todoist-project").value = data.todoistProjectId ?? "";
  document.getElementById("anthropic-key").value = data.anthropicKey ?? "";
}
document.getElementById("save-timer-btn").addEventListener("click", async () => {
  const val = parseInt(document.getElementById("timer-input").value, 10);
  if (!val || val < 1 || val > 120) {
    showToast("Enter a value between 1 and 120.", true);
    return;
  }
  await chrome.storage.local.set({ timerDuration: val });
  showToast("Timer saved!");
});
document.getElementById("save-todoist-btn").addEventListener("click", async () => {
  const token = document.getElementById("todoist-token").value.trim();
  const projectId = document.getElementById("todoist-project").value.trim();
  await chrome.storage.local.set({ todoistToken: token, todoistProjectId: projectId });
  showToast("Todoist config saved!");
});
document.getElementById("save-anthropic-btn").addEventListener("click", async () => {
  const key = document.getElementById("anthropic-key").value.trim();
  await chrome.storage.local.set({ anthropicKey: key });
  document.getElementById("ai-btn-row").style.display = key ? "flex" : "none";
  showToast(key ? "API key saved!" : "API key cleared.");
});
document.getElementById("options-btn").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});
document.getElementById("ai-suggest-btn").addEventListener("click", async () => {
  const btn = document.getElementById("ai-suggest-btn");
  const suggestionsEl = document.getElementById("ai-suggestions");
  const { anthropicKey } = await chrome.storage.local.get("anthropicKey");
  if (!anthropicKey) return;
  btn.disabled = true;
  btn.textContent = "✨ Thinking…";
  suggestionsEl.style.display = "none";
  suggestionsEl.innerHTML = "";
  try {
    const suggestions = await fetchAISuggestions(anthropicKey);
    suggestionsEl.innerHTML = suggestions.map(
      (s, i) => `
        <div class="suggestion-item" data-idx="${i}">
          <span class="suggestion-add">+</span>
          <span>${escapeHtml(s)}</span>
        </div>`
    ).join("");
    suggestionsEl.style.display = "flex";
    suggestionsEl.querySelectorAll(".suggestion-item").forEach((item, i) => {
      item.addEventListener("click", async () => {
        if (item.classList.contains("added")) return;
        const tasks = await getTasks();
        tasks.push({ id: uid(), text: suggestions[i] });
        await chrome.storage.local.set({ tasks });
        item.classList.add("added");
        item.querySelector(".suggestion-add").textContent = "✓";
        await renderTasks();
        await renderStats();
      });
    });
  } catch (err) {
    showToast("AI error: " + err.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = "✨ Suggest tasks with AI";
  }
});
async function fetchAISuggestions(apiKey) {
  var _a;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
      "anthropic-dangerous-client-side-api-key-access": "true"
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: "Generate 5 quick productivity micro-tasks. Each task must be under 20 words and achievable in 5–15 minutes — things someone could realistically do before browsing social media (e.g. clear inbox, write a paragraph, water the plants). Respond with ONLY a valid JSON array of strings. No markdown, no explanation, no code fences."
        }
      ]
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(((_a = err.error) == null ? void 0 : _a.message) ?? `HTTP ${res.status}`);
  }
  const data = await res.json();
  const text = data.content[0].text.trim();
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error("Unexpected response format from AI.");
  return JSON.parse(match[0]);
}
async function renderStats() {
  const [tasks, sites] = await Promise.all([getTasks(), getSites()]);
  document.getElementById("stats-text").textContent = `${tasks.length} task${tasks.length !== 1 ? "s" : ""} · ${sites.length} site${sites.length !== 1 ? "s" : ""} blocked`;
}
async function getTasks() {
  const { tasks = [] } = await chrome.storage.local.get("tasks");
  return tasks;
}
async function getSites() {
  const { blockedSites = [] } = await chrome.storage.local.get("blockedSites");
  return blockedSites;
}
function escapeHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
let _toastTimer;
function showToast(msg, isError = false) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = `${isError ? "error" : ""} visible`;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove("visible"), 2200);
}
init();
//# sourceMappingURL=popup.html-B2WllvTB.js.map
