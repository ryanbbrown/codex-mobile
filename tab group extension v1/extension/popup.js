import { API_BASE_URL, REQUEST_TIMEOUT_MS } from './config.js';

const keyInput = document.getElementById('universal-key');
const saveKeyButton = document.getElementById('save-key');
const captureButton = document.getElementById('capture');
const refreshButton = document.getElementById('refresh');
const sessionNameInput = document.getElementById('session-name');
const sessionList = document.getElementById('session-list');
const statusOutput = document.getElementById('status');
const template = document.getElementById('session-item-template');

function setStatus(message, { error = false } = {}) {
  statusOutput.textContent = message ?? '';
  statusOutput.style.color = error ? '#dc2626' : 'var(--text-muted)';
}

function withStatus(message, fn) {
  return async (...args) => {
    try {
      setStatus(message);
      await fn(...args);
      if (statusOutput.textContent === message) {
        setStatus('');
      }
    } catch (error) {
      console.error(error);
      setStatus(error.message ?? 'Something went wrong', { error: true });
    }
  };
}

async function fetchWithTimeout(resource, options = {}) {
  const { signal, timeout = REQUEST_TIMEOUT_MS, ...rest } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(resource, {
      ...rest,
      signal: signal ? mergeAbortSignals(signal, controller.signal) : controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(rest.headers ?? {})
      }
    });
    if (!response.ok) {
      const body = await safeParseJson(response);
      const message = body?.error ?? `Request failed (${response.status})`;
      throw new Error(message);
    }
    return response;
  } finally {
    clearTimeout(id);
  }
}

function mergeAbortSignals(...signals) {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signals.filter(Boolean).forEach((signal) => {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener('abort', onAbort);
    }
  });
  return controller.signal;
}

async function safeParseJson(response) {
  try {
    return await response.json();
  } catch (error) {
    return null;
  }
}

async function getStoredKey() {
  const { universalKey } = await chrome.storage.sync.get(['universalKey']);
  return universalKey ?? '';
}

async function setStoredKey(value) {
  await chrome.storage.sync.set({ universalKey: value });
}

function requireKey() {
  const key = keyInput.value.trim();
  if (!key) {
    throw new Error('Enter a universal key first.');
  }
  return key;
}

async function loadInitialState() {
  const savedKey = await getStoredKey();
  if (savedKey) {
    keyInput.value = savedKey;
    await refreshSessions();
  }
}

async function saveKey() {
  const key = keyInput.value.trim();
  if (!key) {
    throw new Error('Universal key cannot be empty.');
  }
  await setStoredKey(key);
  setStatus('Key saved.');
}

async function refreshSessions() {
  const key = keyInput.value.trim();
  if (!key) {
    sessionList.replaceChildren();
    setStatus('Enter a universal key to load sessions.');
    return;
  }
  const response = await fetchWithTimeout(`${API_BASE_URL}/sessions/${encodeURIComponent(key)}`, {
    method: 'GET'
  });
  const { sessions = [] } = await response.json();
  renderSessions(sessions);
  if (!sessions.length) {
    setStatus('No sessions found for this key yet.');
  } else {
    setStatus(`${sessions.length} session${sessions.length === 1 ? '' : 's'} available.`);
  }
}

async function captureSession() {
  const key = requireKey();
  const name = sessionNameInput.value.trim() || 'Untitled session';
  const groups = await exportCurrentTabGroups();
  if (!groups.length) {
    throw new Error('No tab groups found in the current window.');
  }
  const session = {
    id: crypto.randomUUID(),
    name,
    createdAt: new Date().toISOString(),
    groups
  };
  await persistSession(key, session);
  sessionNameInput.value = '';
  await refreshSessions();
  setStatus('Session saved successfully.');
}

async function exportCurrentTabGroups() {
  const groups = await chrome.tabGroups.query({});
  const result = [];
  for (const group of groups) {
    const tabs = await chrome.tabs.query({ groupId: group.id });
    result.push({
      id: String(group.id),
      title: group.title ?? '',
      color: group.color,
      collapsed: group.collapsed,
      tabs: tabs.map((tab) => ({
        id: String(tab.id),
        url: tab.url,
        title: tab.title,
        pinned: Boolean(tab.pinned)
      }))
    });
  }
  return result;
}

async function persistSession(key, session) {
  const response = await fetchWithTimeout(`${API_BASE_URL}/sessions/${encodeURIComponent(key)}`, {
    method: 'POST',
    body: JSON.stringify({ session })
  });
  await response.json();
}

function renderSessions(sessions) {
  sessionList.replaceChildren();
  sessions.forEach((session) => {
    const element = createSessionElement(session);
    sessionList.appendChild(element);
  });
}

function createSessionElement(session) {
  const clone = template.content.firstElementChild.cloneNode(true);
  clone.dataset.sessionId = session.id;
  clone.dataset.sessionPayload = JSON.stringify(session);
  clone.querySelector('.session-name').textContent = session.name;
  clone
    .querySelector('.session-date')
    .textContent = new Date(session.createdAt).toLocaleString();
  clone.addEventListener('click', (event) => handleSessionAction(event, session));
  return clone;
}

async function handleSessionAction(event, session) {
  const action = event.target?.dataset?.action;
  if (!action) return;
  event.preventDefault();
  if (action === 'restore') {
    await withStatus('Restoring session...', async () => {
      await restoreSession(session);
    })();
  } else if (action === 'delete') {
    const confirmed = confirm(`Delete the session “${session.name}”?`);
    if (!confirmed) return;
    await withStatus('Deleting session...', async () => {
      await deleteSession(session);
      await refreshSessions();
    })();
  } else if (action === 'rename') {
    const newName = prompt('Rename session', session.name)?.trim();
    if (!newName || newName === session.name) {
      return;
    }
    await withStatus('Renaming session...', async () => {
      await persistSession(requireKey(), { ...session, name: newName });
      await refreshSessions();
    })();
  }
}

async function deleteSession(session) {
  const key = requireKey();
  await fetchWithTimeout(`${API_BASE_URL}/sessions/${encodeURIComponent(key)}/${session.id}`, {
    method: 'DELETE'
  });
}

async function restoreSession(session) {
  for (const group of session.groups) {
    const createdTabIds = [];
    for (const tab of group.tabs) {
      const createdTab = await chrome.tabs.create({ url: tab.url, active: false });
      createdTabIds.push(createdTab.id);
      if (tab.pinned) {
        await chrome.tabs.update(createdTab.id, { pinned: true });
      }
      await delay(50);
    }
    if (!createdTabIds.length) continue;
    const groupId = await chrome.tabs.group({ tabIds: createdTabIds });
    await chrome.tabGroups.update(groupId, {
      title: group.title || undefined,
      color: group.color,
      collapsed: group.collapsed
    });
    await delay(50);
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

saveKeyButton.addEventListener('click', withStatus('Saving key...', saveKey));
captureButton.addEventListener('click', withStatus('Capturing tab groups...', captureSession));
refreshButton.addEventListener('click', withStatus('Refreshing sessions...', refreshSessions));

loadInitialState();
