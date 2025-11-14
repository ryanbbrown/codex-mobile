import { API_BASE_URL, REQUEST_TIMEOUT_MS } from './config.js';

const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const signUpButton = document.getElementById('sign-up');
const signInButton = document.getElementById('sign-in');
const signOutButton = document.getElementById('sign-out');
const signedInAs = document.getElementById('signed-in-as');
const authForm = document.getElementById('auth-form');
const authState = document.getElementById('auth-state');
const captureButton = document.getElementById('capture');
const refreshButton = document.getElementById('refresh');
const sessionNameInput = document.getElementById('session-name');
const sessionList = document.getElementById('session-list');
const statusOutput = document.getElementById('status');
const template = document.getElementById('session-item-template');

let authToken = null;
let authUser = null;

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
  const { signal, timeout = REQUEST_TIMEOUT_MS, headers, ...rest } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(resource, {
      ...rest,
      signal: signal ? mergeAbortSignals(signal, controller.signal) : controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(headers ?? {}),
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
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

async function loadStoredSession() {
  const { betterAuthSession } = await chrome.storage.sync.get(['betterAuthSession']);
  if (betterAuthSession?.token) {
    authToken = betterAuthSession.token;
    authUser = betterAuthSession.user;
    updateAuthUi();
    await refreshSessions();
  } else {
    updateAuthUi();
  }
}

async function storeSession(token, user) {
  authToken = token;
  authUser = user;
  await chrome.storage.sync.set({ betterAuthSession: { token, user } });
  updateAuthUi();
}

async function clearSession() {
  authToken = null;
  authUser = null;
  await chrome.storage.sync.remove('betterAuthSession');
  updateAuthUi();
  sessionList.replaceChildren();
}

function updateAuthUi() {
  const signedIn = Boolean(authToken && authUser);
  authForm.classList.toggle('hidden', signedIn);
  authState.classList.toggle('hidden', !signedIn);
  captureButton.disabled = !signedIn;
  refreshButton.disabled = !signedIn;
  if (signedIn) {
    signedInAs.textContent = `Signed in as ${authUser.email}`;
  } else {
    signedInAs.textContent = '';
    setStatus('Sign in to sync your sessions.');
  }
}

function requireAuth() {
  if (!authToken) {
    throw new Error('You must sign in first.');
  }
}

async function signUp() {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  if (!email || !password) {
    throw new Error('Email and password are required.');
  }
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/auth/sign-up`, {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
  const data = await response.json();
  await storeSession(data.token, data.user);
  setStatus('Account created.');
}

async function signIn() {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  if (!email || !password) {
    throw new Error('Email and password are required.');
  }
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/auth/sign-in`, {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
  const data = await response.json();
  await storeSession(data.token, data.user);
  await refreshSessions();
  setStatus('Signed in successfully.');
}

async function signOut() {
  if (authToken) {
    await fetchWithTimeout(`${API_BASE_URL}/api/auth/sign-out`, {
      method: 'POST',
      body: JSON.stringify({ token: authToken }),
      headers: { Authorization: `Bearer ${authToken}` }
    });
  }
  await clearSession();
  setStatus('Signed out.');
}

async function refreshSessions() {
  if (!authToken) {
    sessionList.replaceChildren();
    return;
  }
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/session`, {
    method: 'GET'
  });
  const { sessions = [] } = await response.json();
  renderSessions(sessions);
  if (!sessions.length) {
    setStatus('No sessions saved yet.');
  } else {
    setStatus(`${sessions.length} session${sessions.length === 1 ? '' : 's'} available.`);
  }
}

async function captureSession() {
  requireAuth();
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
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/session`, {
    method: 'POST',
    body: JSON.stringify({ session })
  });
  await response.json();
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
      await persistSession({ ...session, name: newName });
      await refreshSessions();
    })();
  }
}

async function persistSession(session) {
  await fetchWithTimeout(`${API_BASE_URL}/api/session`, {
    method: 'POST',
    body: JSON.stringify({ session })
  });
}

async function deleteSession(session) {
  requireAuth();
  await fetchWithTimeout(`${API_BASE_URL}/api/session/${session.id}`, {
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

signUpButton.addEventListener('click', withStatus('Creating account...', signUp));
signInButton.addEventListener('click', withStatus('Signing in...', signIn));
signOutButton.addEventListener('click', withStatus('Signing out...', signOut));
captureButton.addEventListener('click', withStatus('Capturing tab groups...', captureSession));
refreshButton.addEventListener('click', withStatus('Refreshing sessions...', refreshSessions));

loadStoredSession();
