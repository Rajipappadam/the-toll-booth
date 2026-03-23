import "./modulepreload-polyfill-DaKOjhqt.js";
async function init() {
  await Promise.all([renderTasks(), renderSites(), loadSettings(), renderStats()]);
}
async function renderStats() {
  const [tasks, sites, { timerDuration = 15 }] = await Promise.all([
    getTasks(),
    getSites(),
    chrome.storage.local.get("timerDuration")
  ]);
  document.getElementById("stat-tasks").textContent = tasks.length;
  document.getElementById("stat-sites").textContent = sites.length;
  document.getElementById("stat-timer").textContent = timerDuration;
}
async function renderTasks() {
  const tasks = await getTasks();
  const list = document.getElementById("task-list");
  if (tasks.length === 0) {
    list.innerHTML = `
      <div class="empty">
        <span class="empty-icon">📝</span>
        No tasks yet — add one above.
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
  const list = document.getElementById("site-list");
  if (sites.length === 0) {
    list.innerHTML = `
      <div class="empty">
        <span class="empty-icon">🔒</span>
        No blocked sites yet.
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
async function loadSettings() {
  const data = await chrome.storage.local.get([
    "timerDuration",
    "todoistToken",
    "todoistProjectId"
  ]);
  document.getElementById("timer-input").value = data.timerDuration ?? 15;
  document.getElementById("todoist-token").value = data.todoistToken ?? "";
  document.getElementById("todoist-project").value = data.todoistProjectId ?? "";
}
document.getElementById("save-timer-btn").addEventListener("click", async () => {
  const val = parseInt(document.getElementById("timer-input").value, 10);
  if (!val || val < 1 || val > 120) {
    showToast("Enter a value between 1 and 120.", true);
    return;
  }
  await chrome.storage.local.set({ timerDuration: val });
  await renderStats();
  showToast("Timer saved!");
});
document.getElementById("save-todoist-btn").addEventListener("click", async () => {
  const token = document.getElementById("todoist-token").value.trim();
  const projectId = document.getElementById("todoist-project").value.trim();
  await chrome.storage.local.set({ todoistToken: token, todoistProjectId: projectId });
  showToast("Todoist config saved!");
});
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
//# sourceMappingURL=options.html-yIAsK8fi.js.map
