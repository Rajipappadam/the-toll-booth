/**
 * tollbooth.js — Standalone fallback toll page.
 * Used when content.js overlay cannot be injected (e.g. chrome:// pages).
 * Reads ?redirect=<url>&site=<hostname> from the query string.
 */

const params = new URLSearchParams(location.search);
const redirectUrl = params.get('redirect') || null;
const site = params.get('site') || 'this site';

// Show blocked site name
const siteLine = document.getElementById('site-line');
if (siteLine) {
  siteLine.innerHTML = `To enter: <strong class="site-name">${escapeHtml(site)}</strong>`;
}

init();

async function init() {
  const { task, source } = await fetchTask();
  renderTask(task, source);
}

function renderTask(task, source) {
  const card = document.getElementById('task-card');

  if (!task) {
    card.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">📋</span>
        <p class="empty-title">No tasks in your queue!</p>
        <p class="empty-sub">Open the extension popup and add tasks to enable the Toll Booth.</p>
        <button class="btn-pass" id="free-pass">Continue without paying →</button>
      </div>
    `;
    document.getElementById('free-pass').addEventListener('click', proceed);
    return;
  }

  card.innerHTML = `
    <div class="task-label">
      YOUR TASK ${source === 'todoist' ? '<span style="background:#1e3a5f;color:#60a5fa;padding:2px 8px;border-radius:4px;font-size:0.65rem;letter-spacing:0.08em;font-weight:600">Todoist</span>' : ''}
    </div>
    <div class="task-text">${escapeHtml(task.text)}</div>
    <button class="btn-complete" id="complete-btn">
      <span>✓</span> TASK COMPLETE
    </button>
  `;

  document.getElementById('complete-btn').addEventListener('click', () =>
    completeToll(task, source),
  );
}

async function completeToll(task, source) {
  const btn = document.getElementById('complete-btn');
  btn.disabled = true;
  btn.innerHTML = '<span>⏳</span> Unlocking…';

  if (source === 'local') {
    const { tasks = [] } = await chrome.storage.local.get('tasks');
    await chrome.storage.local.set({ tasks: tasks.filter((t) => t.id !== task.id) });
  }

  await chrome.runtime.sendMessage({ type: 'TOLL_PAID', site });

  const card = document.getElementById('task-card');
  card.innerHTML = `
    <div class="success-state">
      <span class="success-icon">✅</span>
      <p class="success-text">Toll paid! Enjoy your session.</p>
    </div>
  `;

  setTimeout(proceed, 900);
}

function proceed() {
  if (redirectUrl) {
    location.href = redirectUrl;
  } else {
    history.back();
  }
}

async function fetchTask() {
  const { todoistToken, todoistProjectId } = await chrome.storage.local.get([
    'todoistToken',
    'todoistProjectId',
  ]);

  if (todoistToken) {
    try {
      const url = todoistProjectId
        ? `https://api.todoist.com/rest/v2/tasks?project_id=${encodeURIComponent(todoistProjectId)}`
        : 'https://api.todoist.com/rest/v2/tasks';
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${todoistToken}` },
      });
      if (res.ok) {
        const items = await res.json();
        const active = items.filter((t) => !t.is_completed);
        if (active.length > 0) {
          const t = active[Math.floor(Math.random() * active.length)];
          return { task: { id: t.id, text: t.content }, source: 'todoist' };
        }
      }
    } catch (e) {
      console.warn('[TollBooth] Todoist fetch failed:', e);
    }
  }

  const result = await chrome.runtime.sendMessage({ type: 'GET_TASK' });
  return { task: result?.task ?? null, source: 'local' };
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
