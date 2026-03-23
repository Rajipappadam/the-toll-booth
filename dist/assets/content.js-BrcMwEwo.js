(function(){let overlayActive = false;
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "SHOW_TOLL") {
    if (!overlayActive) showToll(msg.site);
    sendResponse({ received: true });
  }
  return false;
});
async function showToll(site) {
  overlayActive = true;
  document.documentElement.style.overflow = "hidden";
  const host = document.createElement("div");
  host.id = "__toll-booth-host__";
  Object.assign(host.style, {
    position: "fixed",
    inset: "0",
    zIndex: "2147483647"
  });
  document.documentElement.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = OVERLAY_CSS;
  shadow.appendChild(style);
  const root = document.createElement("div");
  root.className = "overlay";
  root.innerHTML = `
    <div class="panel">
      <div class="header">
        <span class="icon">🚦</span>
        <h1 class="title">THE TOLL BOOTH</h1>
        <p class="subtitle">Access denied · Toll required</p>
      </div>
      <div class="divider"></div>
      <div class="task-card" id="task-card">
        <div class="loading">Fetching your task…</div>
      </div>
      <p class="site-line">To enter: <strong class="site-name">${site}</strong></p>
    </div>
  `;
  shadow.appendChild(root);
  const { task, source } = await fetchTask();
  renderTask(shadow, task, source, site);
}
function renderTask(shadow, task, source, site) {
  const card = shadow.getElementById("task-card");
  if (!task) {
    card.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <p class="empty-title">No tasks in your queue!</p>
        <p class="empty-sub">
          Open the extension popup and add tasks to enable the Toll Booth.
        </p>
        <button class="btn-pass" id="free-pass">Continue without paying →</button>
      </div>
    `;
    shadow.getElementById("free-pass").addEventListener("click", removeOverlay);
    return;
  }
  card.innerHTML = `
    <div class="task-label">
      YOUR TASK
      ${source === "todoist" ? '<span class="badge">Todoist</span>' : ""}
    </div>
    <div class="task-text">${escapeHtml(task.text)}</div>
    <button class="btn-complete" id="complete-btn">
      <span class="btn-check">✓</span> TASK COMPLETE
    </button>
  `;
  shadow.getElementById("complete-btn").addEventListener(
    "click",
    () => completeToll(shadow, task, source, site)
  );
}
async function completeToll(shadow, task, source, site) {
  const btn = shadow.getElementById("complete-btn");
  btn.disabled = true;
  btn.innerHTML = '<span class="btn-check">⏳</span> Unlocking…';
  if (source === "local") {
    const { tasks = [] } = await chrome.storage.local.get("tasks");
    await chrome.storage.local.set({
      tasks: tasks.filter((t) => t.id !== task.id)
    });
  }
  await chrome.runtime.sendMessage({ type: "TOLL_PAID", site });
  const card = shadow.getElementById("task-card");
  card.innerHTML = `
    <div class="success-state">
      <div class="success-icon">✅</div>
      <p class="success-text">Toll paid! Enjoy your session.</p>
    </div>
  `;
  await sleep(900);
  removeOverlay();
}
async function fetchTask() {
  const { todoistToken, todoistProjectId } = await chrome.storage.local.get([
    "todoistToken",
    "todoistProjectId"
  ]);
  if (todoistToken) {
    try {
      const url = todoistProjectId ? `https://api.todoist.com/rest/v2/tasks?project_id=${encodeURIComponent(todoistProjectId)}` : "https://api.todoist.com/rest/v2/tasks";
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${todoistToken}` }
      });
      if (res.ok) {
        const items = await res.json();
        const active = items.filter((t) => !t.is_completed);
        if (active.length > 0) {
          const t = active[Math.floor(Math.random() * active.length)];
          return { task: { id: t.id, text: t.content }, source: "todoist" };
        }
      }
    } catch (e) {
      console.warn("[TollBooth] Todoist fetch failed, falling back to local:", e);
    }
  }
  const result = await chrome.runtime.sendMessage({ type: "GET_TASK" });
  return { task: (result == null ? void 0 : result.task) ?? null, source: "local" };
}
function removeOverlay() {
  const host = document.getElementById("__toll-booth-host__");
  if (!host) return;
  host.style.transition = "opacity 0.4s ease";
  host.style.opacity = "0";
  setTimeout(() => {
    host.remove();
    document.documentElement.style.overflow = "";
    overlayActive = false;
  }, 400);
}
function escapeHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
const OVERLAY_CSS = `
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

.overlay {
  position: fixed;
  inset: 0;
  background: linear-gradient(135deg, #050505 0%, #0f0800 50%, #050505 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  animation: fadeIn 0.35s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}

/* ── Panel ── */
.panel {
  background: #111827;
  border: 1px solid #1f2937;
  border-radius: 20px;
  padding: 44px 52px;
  max-width: 580px;
  width: 90%;
  text-align: center;
  box-shadow:
    0 0 0 1px rgba(245,158,11,0.08),
    0 0 80px rgba(245,158,11,0.07),
    0 32px 64px rgba(0,0,0,0.7);
}

/* ── Header ── */
.icon {
  display: block;
  font-size: 3.8rem;
  animation: pulse 2.5s ease-in-out infinite;
  line-height: 1;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50%       { transform: scale(1.07); }
}

.title {
  font-size: 2.5rem;
  font-weight: 900;
  letter-spacing: 0.28em;
  color: #f59e0b;
  text-shadow: 0 0 48px rgba(245,158,11,0.45);
  margin: 14px 0 6px;
  line-height: 1;
}

.subtitle {
  font-size: 0.78rem;
  letter-spacing: 0.18em;
  color: #6b7280;
  text-transform: uppercase;
}

/* ── Divider ── */
.divider {
  height: 1px;
  background: linear-gradient(90deg, transparent, #374151, transparent);
  margin: 30px 0;
}

/* ── Task card ── */
.task-card {
  background: #0f172a;
  border: 1px solid #1e293b;
  border-left: 4px solid #f59e0b;
  border-radius: 12px;
  padding: 26px 30px;
  text-align: left;
  margin-bottom: 22px;
  min-height: 120px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.task-label {
  font-size: 0.68rem;
  letter-spacing: 0.22em;
  color: #f59e0b;
  font-weight: 700;
  margin-bottom: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.badge {
  background: #1e3a5f;
  color: #60a5fa;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.62rem;
  letter-spacing: 0.08em;
  font-weight: 600;
}

.task-text {
  font-size: 1.45rem;
  font-weight: 600;
  color: #f1f5f9;
  line-height: 1.45;
  margin-bottom: 26px;
}

/* ── Complete button ── */
.btn-complete {
  width: 100%;
  padding: 15px 24px;
  background: #f59e0b;
  color: #0a0a0a;
  border: none;
  border-radius: 10px;
  font-size: 1rem;
  font-weight: 800;
  letter-spacing: 0.14em;
  cursor: pointer;
  transition: background 0.15s, box-shadow 0.15s, transform 0.1s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.btn-check {
  font-size: 1.2rem;
}

.btn-complete:hover:not(:disabled) {
  background: #fbbf24;
  box-shadow: 0 0 36px rgba(245,158,11,0.6);
  transform: translateY(-2px);
}

.btn-complete:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: none;
}

.btn-complete:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

/* ── Site line ── */
.site-line {
  font-size: 0.78rem;
  color: #4b5563;
  font-family: inherit;
}

.site-name {
  color: #ef4444;
  font-weight: 700;
}

/* ── Loading ── */
.loading {
  color: #6b7280;
  text-align: center;
  font-size: 0.9rem;
  padding: 16px 0;
  animation: blink 1.4s ease-in-out infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.35; }
}

/* ── Empty state ── */
.empty-state { text-align: center; padding: 8px 0; }

.empty-icon {
  font-size: 2.8rem;
  margin-bottom: 14px;
  display: block;
}

.empty-title {
  font-size: 1.15rem;
  font-weight: 700;
  color: #f1f5f9;
  margin-bottom: 8px;
  font-family: inherit;
}

.empty-sub {
  font-size: 0.85rem;
  color: #6b7280;
  margin-bottom: 22px;
  line-height: 1.6;
  font-family: inherit;
}

.btn-pass {
  background: transparent;
  border: 1px solid #374151;
  color: #6b7280;
  padding: 10px 26px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.85rem;
  font-family: inherit;
  transition: border-color 0.15s, color 0.15s;
}

.btn-pass:hover {
  border-color: #6b7280;
  color: #d1d5db;
}

/* ── Success state ── */
.success-state {
  text-align: center;
  padding: 16px 0;
}

.success-icon {
  font-size: 3rem;
  margin-bottom: 12px;
  display: block;
}

.success-text {
  font-size: 1.1rem;
  font-weight: 700;
  color: #10b981;
  font-family: inherit;
}
`;
//# sourceMappingURL=content.js-BrcMwEwo.js.map
})()
