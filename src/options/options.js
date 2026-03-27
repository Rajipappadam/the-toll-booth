import {
  getBlockedSites,
  getTasks,
  getTimerDuration,
  setBlockedSites,
  setTasks,
  setTimerDuration,
} from '../shared/storage.js';

async function init() {
  await Promise.all([renderTasks(), renderSites(), loadSettings(), renderStats()]);
}

async function renderStats() {
  const [tasks, sites, timerDuration] = await Promise.all([
    getTasks(),
    getBlockedSites(),
    getTimerDuration(),
  ]);

  document.getElementById('stat-tasks').textContent = tasks.length;
  document.getElementById('stat-sites').textContent = sites.length;
  document.getElementById('stat-timer').textContent = timerDuration;
}

async function renderTasks() {
  const tasks = await getTasks();
  const list = document.getElementById('task-list');

  if (tasks.length === 0) {
    list.innerHTML = `
      <div class="empty">
        <span class="empty-icon">📝</span>
        No tasks yet - add one above.
      </div>`;
    return;
  }

  list.innerHTML = tasks
    .map(
      (task) => `
      <div class="list-item">
        <span class="item-text">${escapeHtml(task.text)}</span>
        <button class="btn-delete" data-id="${task.id}" title="Remove">✕</button>
      </div>`,
    )
    .join('');

  list.querySelectorAll('.btn-delete').forEach((button) => {
    button.addEventListener('click', () => deleteTask(button.dataset.id));
  });
}

async function addTask() {
  const input = document.getElementById('task-input');
  const text = input.value.trim();
  if (!text) return;

  const tasks = await getTasks();
  tasks.push({ id: uid(), text });
  await setTasks(tasks);
  input.value = '';
  await renderTasks();
  await renderStats();
}

async function deleteTask(id) {
  const tasks = await getTasks();
  await setTasks(tasks.filter((task) => task.id !== id));
  await renderTasks();
  await renderStats();
}

document.getElementById('add-task-btn').addEventListener('click', addTask);
document.getElementById('task-input').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') addTask();
});

async function renderSites() {
  const sites = await getBlockedSites();
  const list = document.getElementById('site-list');

  if (sites.length === 0) {
    list.innerHTML = `
      <div class="empty">
        <span class="empty-icon">🔒</span>
        No blocked sites yet.
      </div>`;
    return;
  }

  list.innerHTML = sites
    .map(
      (site) => `
      <div class="list-item">
        <span class="item-text site-text">${escapeHtml(site)}</span>
        <button class="btn-delete" data-site="${escapeHtml(site)}" title="Remove">✕</button>
      </div>`,
    )
    .join('');

  list.querySelectorAll('.btn-delete').forEach((button) => {
    button.addEventListener('click', () => deleteSite(button.dataset.site));
  });
}

async function addSite() {
  const input = document.getElementById('site-input');
  let value = input.value.trim().toLowerCase();
  if (!value) return;

  value = value.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  if (!value) return;

  const sites = await getBlockedSites();
  if (!sites.includes(value)) {
    sites.push(value);
    await setBlockedSites(sites);
  }

  input.value = '';
  await renderSites();
  await renderStats();
}

async function deleteSite(site) {
  const sites = await getBlockedSites();
  await setBlockedSites(sites.filter((item) => item !== site));
  await renderSites();
  await renderStats();
}

document.getElementById('add-site-btn').addEventListener('click', addSite);
document.getElementById('site-input').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') addSite();
});

async function loadSettings() {
  const data = await chrome.storage.local.get(['todoistToken', 'todoistProjectId']);
  document.getElementById('timer-input').value = await getTimerDuration();
  document.getElementById('todoist-token').value = data.todoistToken ?? '';
  document.getElementById('todoist-project').value = data.todoistProjectId ?? '';
}

document.getElementById('save-timer-btn').addEventListener('click', async () => {
  const value = parseInt(document.getElementById('timer-input').value, 10);
  if (!value || value < 1 || value > 120) {
    showToast('Enter a value between 1 and 120.', true);
    return;
  }

  await setTimerDuration(value);
  await renderStats();
  showToast('Timer saved.');
});

document.getElementById('save-todoist-btn').addEventListener('click', async () => {
  const token = document.getElementById('todoist-token').value.trim();
  const projectId = document.getElementById('todoist-project').value.trim();
  await chrome.storage.local.set({ todoistToken: token, todoistProjectId: projectId });
  showToast('Todoist config saved.');
});

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

let toastTimer;
function showToast(message, isError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `${isError ? 'error' : ''} visible`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 2200);
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return;

  if (changes.tasks) {
    void renderTasks();
  }
  if (changes.blockedSites) {
    void renderSites();
  }
  if (changes.timerDuration || changes.tasks || changes.blockedSites) {
    void renderStats();
  }
});

init();
