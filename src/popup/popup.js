import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signOut,
} from 'firebase/auth/web-extension';

import { auth } from '../shared/firebase.js';
import {
  applySyncedData,
  getAllSyncedData,
  getBlockedSites,
  getTasks,
  getTimerDuration,
  getUid,
  getUnlocks,
  getUserProfile,
  setBlockedSites,
  setTasks,
  setTimerDuration,
  setUid,
  setUserProfile,
} from '../shared/storage.js';
import { pullFromFirestore, pushToFirestore } from '../shared/sync.js';

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    const id = tab.dataset.tab;
    document.querySelectorAll('.tab').forEach((item) => {
      item.classList.toggle('active', item.dataset.tab === id);
    });
    document.querySelectorAll('.tab-pane').forEach((pane) => {
      pane.classList.toggle('active', pane.id === `pane-${id}`);
    });
  });
});

async function init() {
  await Promise.all([
    renderAuthState(),
    renderTasks(),
    renderSites(),
    renderUnlocks(),
    loadSettings(),
    renderStats(),
  ]);

  const { anthropicKey } = await chrome.storage.local.get('anthropicKey');
  if (anthropicKey) {
    document.getElementById('ai-btn-row').style.display = 'flex';
  }
}

async function renderTasks() {
  const tasks = await getTasks();
  document.getElementById('task-count').textContent = tasks.length;
  const list = document.getElementById('task-list');

  if (tasks.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">📝</span>
        <p>No tasks yet - add one above.</p>
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
  document.getElementById('site-count').textContent = sites.length;
  const list = document.getElementById('site-list');

  if (sites.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">🔒</span>
        <p>No blocked sites yet.</p>
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

async function renderUnlocks() {
  const unlocks = await getUnlocks();
  const section = document.getElementById('unlocks-section');
  const list = document.getElementById('unlocks-list');
  const now = Date.now();
  const active = Object.entries(unlocks).filter(([, expiresAt]) => expiresAt > now);

  section.style.display = active.length ? 'block' : 'none';
  if (!active.length) return;

  list.innerHTML = active
    .map(([site, expiresAt]) => {
      const minutes = Math.ceil((expiresAt - now) / 60_000);
      return `
        <div class="unlock-item">
          <span class="unlock-site">${escapeHtml(site)}</span>
          <span class="unlock-time">${minutes}m left</span>
        </div>`;
    })
    .join('');
}

async function loadSettings() {
  const data = await chrome.storage.local.get([
    'todoistToken',
    'todoistProjectId',
    'anthropicKey',
  ]);

  document.getElementById('timer-input').value = await getTimerDuration();
  document.getElementById('todoist-token').value = data.todoistToken ?? '';
  document.getElementById('todoist-project').value = data.todoistProjectId ?? '';
  document.getElementById('anthropic-key').value = data.anthropicKey ?? '';
}

document.getElementById('save-timer-btn').addEventListener('click', async () => {
  const value = parseInt(document.getElementById('timer-input').value, 10);
  if (!value || value < 1 || value > 120) {
    showToast('Enter a value between 1 and 120.', true);
    return;
  }

  await setTimerDuration(value);
  showToast('Timer saved.');
});

document.getElementById('save-todoist-btn').addEventListener('click', async () => {
  const token = document.getElementById('todoist-token').value.trim();
  const projectId = document.getElementById('todoist-project').value.trim();
  await chrome.storage.local.set({ todoistToken: token, todoistProjectId: projectId });
  showToast('Todoist config saved.');
});

document.getElementById('save-anthropic-btn').addEventListener('click', async () => {
  const key = document.getElementById('anthropic-key').value.trim();
  await chrome.storage.local.set({ anthropicKey: key });
  document.getElementById('ai-btn-row').style.display = key ? 'flex' : 'none';
  showToast(key ? 'API key saved.' : 'API key cleared.');
});

document.getElementById('options-btn').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

document.getElementById('sign-in-btn').addEventListener('click', handleSignIn);
document.getElementById('sign-out-btn').addEventListener('click', handleSignOut);
document.getElementById('sync-now-btn').addEventListener('click', handleManualSync);

async function renderAuthState() {
  const [uidValue, profile] = await Promise.all([getUid(), getUserProfile()]);
  const banner = document.getElementById('sync-banner');
  const accountCard = document.getElementById('account-card');
  const emptyState = document.getElementById('account-empty');
  const syncActions = document.getElementById('sync-actions');

  if (!uidValue || !profile) {
    banner.classList.remove('hidden');
    document.getElementById('sync-title').textContent = 'Back up your queue with Google Sign-In';
    document.getElementById('sync-subtitle').textContent = 'Local mode stays enabled even when sync is off.';
    syncActions.innerHTML = '<button class="btn btn-primary" id="sign-in-btn">Enable Sync</button>';
    document.getElementById('sign-in-btn').addEventListener('click', handleSignIn);
    accountCard.classList.add('hidden');
    emptyState.classList.remove('hidden');
    return;
  }

  banner.classList.remove('hidden');
  document.getElementById('sync-title').textContent = 'Sync is active';
  document.getElementById('sync-subtitle').textContent = profile.email || 'Signed in to Firestore sync.';
  syncActions.innerHTML = '<button class="btn btn-secondary" id="banner-sync-btn">Sync Now</button>';
  document.getElementById('banner-sync-btn').addEventListener('click', handleManualSync);

  document.getElementById('account-name').textContent = profile.displayName || 'Google account';
  document.getElementById('account-email').textContent = profile.email || '';

  const avatar = document.getElementById('account-avatar');
  if (profile.photoURL) {
    avatar.src = profile.photoURL;
    avatar.classList.remove('hidden');
  } else {
    avatar.classList.add('hidden');
    avatar.removeAttribute('src');
  }

  accountCard.classList.remove('hidden');
  emptyState.classList.add('hidden');
}

async function handleSignIn() {
  const signInButton = document.getElementById('sign-in-btn');
  signInButton.disabled = true;

  try {
    const accessToken = await getChromeAuthToken(true);
    const credential = GoogleAuthProvider.credential(null, accessToken);
    const result = await signInWithCredential(auth, credential);

    await Promise.all([
      setUid(result.user.uid),
      setUserProfile({
        email: result.user.email ?? '',
        displayName: result.user.displayName ?? '',
        photoURL: result.user.photoURL ?? '',
      }),
    ]);

    const remoteData = await pullFromFirestore(result.user.uid);
    if (Object.keys(remoteData).length > 0) {
      await applySyncedData(remoteData);
      showToast('Synced data restored from Firestore.');
    } else {
      await pushToFirestore(result.user.uid, await getAllSyncedData());
      showToast('Signed in. Local data backed up.');
    }

    await refreshUi();
  } catch (error) {
    showToast(error.message || 'Sign-in failed.', true);
  } finally {
    signInButton.disabled = false;
  }
}

async function handleSignOut() {
  try {
    const accessToken = await getChromeAuthToken(false).catch(() => null);
    await signOut(auth);
    if (accessToken) {
      await removeCachedAuthToken(accessToken);
    } else {
      chrome.identity.clearAllCachedAuthTokens(() => void chrome.runtime.lastError);
    }

    await Promise.all([setUid(null), setUserProfile(null)]);
    await renderAuthState();
    showToast('Signed out. Local data remains on this device.');
  } catch (error) {
    showToast(error.message || 'Sign-out failed.', true);
  }
}

async function handleManualSync() {
  try {
    const uidValue = await getUid();
    if (!uidValue) {
      showToast('Sign in first to sync.', true);
      return;
    }

    await pushToFirestore(uidValue, await getAllSyncedData());
    showToast('Sync complete.');
  } catch (error) {
    showToast(error.message || 'Sync failed.', true);
  }
}

document.getElementById('ai-suggest-btn').addEventListener('click', async () => {
  const button = document.getElementById('ai-suggest-btn');
  const suggestionsEl = document.getElementById('ai-suggestions');
  const { anthropicKey } = await chrome.storage.local.get('anthropicKey');
  if (!anthropicKey) return;

  button.disabled = true;
  button.textContent = 'Thinking...';
  suggestionsEl.style.display = 'none';
  suggestionsEl.innerHTML = '';

  try {
    const suggestions = await fetchAISuggestions(anthropicKey);

    suggestionsEl.innerHTML = suggestions
      .map(
        (suggestion, index) => `
        <div class="suggestion-item" data-idx="${index}">
          <span class="suggestion-add">+</span>
          <span>${escapeHtml(suggestion)}</span>
        </div>`,
      )
      .join('');

    suggestionsEl.style.display = 'flex';

    suggestionsEl.querySelectorAll('.suggestion-item').forEach((item, index) => {
      item.addEventListener('click', async () => {
        if (item.classList.contains('added')) return;
        const tasks = await getTasks();
        tasks.push({ id: uid(), text: suggestions[index] });
        await setTasks(tasks);
        item.classList.add('added');
        item.querySelector('.suggestion-add').textContent = '✓';
        await renderTasks();
        await renderStats();
      });
    });
  } catch (error) {
    showToast(`AI error: ${error.message}`, true);
  } finally {
    button.disabled = false;
    button.textContent = 'Suggest tasks with AI';
  }
});

async function fetchAISuggestions(apiKey) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-client-side-api-key-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content:
            'Generate 5 quick productivity micro-tasks. Each task must be under 20 words and achievable in 5-15 minutes. Respond with only a valid JSON array of strings.',
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message ?? `HTTP ${response.status}`);
  }

  const data = await response.json();
  const text = data.content[0].text.trim();
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) {
    throw new Error('Unexpected response format from AI.');
  }

  return JSON.parse(match[0]);
}

async function renderStats() {
  const [tasks, sites] = await Promise.all([getTasks(), getBlockedSites()]);
  document.getElementById('stats-text').textContent =
    `${tasks.length} task${tasks.length !== 1 ? 's' : ''} · ${sites.length} site${sites.length !== 1 ? 's' : ''} blocked`;
}

const OAUTH_CLIENT_ID = '591194995140-l9tnvc65fk1sijgfrhicahb8sl2vl76a.apps.googleusercontent.com';
const OAUTH_SCOPES = 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile';

function getChromeAuthToken(interactive) {
  return new Promise((resolve, reject) => {
    if (!interactive) {
      reject(new Error('Non-interactive auth not supported with launchWebAuthFlow.'));
      return;
    }

    const redirectUri = chrome.identity.getRedirectURL();
    const authUrl = new URL('https://accounts.google.com/o/oauth2/auth');
    authUrl.searchParams.set('client_id', OAUTH_CLIENT_ID);
    authUrl.searchParams.set('response_type', 'token');
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', OAUTH_SCOPES);

    chrome.identity.launchWebAuthFlow(
      { url: authUrl.toString(), interactive: true },
      (responseUrl) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!responseUrl) {
          reject(new Error('No response URL from auth flow.'));
          return;
        }
        const params = new URLSearchParams(new URL(responseUrl).hash.slice(1));
        const token = params.get('access_token');
        if (!token) {
          reject(new Error('No access token in auth response.'));
          return;
        }
        resolve(token);
      },
    );
  });
}

function removeCachedAuthToken(_token) {
  // launchWebAuthFlow does not use Chrome's token cache — nothing to remove.
  return Promise.resolve();
}

async function refreshUi() {
  await Promise.all([
    renderAuthState(),
    renderTasks(),
    renderSites(),
    renderUnlocks(),
    loadSettings(),
    renderStats(),
  ]);
}

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

  if (changes.uid || changes.userProfile) {
    void renderAuthState();
  }
  if (changes.tasks) {
    void renderTasks();
  }
  if (changes.blockedSites) {
    void renderSites();
  }
  if (changes.unlocks) {
    void renderUnlocks();
  }
  if (changes.timerDuration) {
    document.getElementById('timer-input').value = changes.timerDuration.newValue ?? 15;
  }
  if (changes.tasks || changes.blockedSites) {
    void renderStats();
  }
});

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
  await renderAuthState();
});

init();
