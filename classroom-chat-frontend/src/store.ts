// One small global store (no library): state + actions + the polling loop that keeps it fresh.
import { useSyncExternalStore } from 'react';
import * as api from './api';
import { ApiError } from './api';
import { titleCase } from './names';
import { navigate } from './router';
import { CLASS_ID, type ChatId, type PendingMessage, type ServerMessage, type User } from './types';

export interface ModalSpec {
  title: string;
  body?: string;
  confirmLabel: string;
  onConfirm: () => void;
}

export type ThemeMode = 'light' | 'dark' | 'system';

export interface State {
  me: User | null;
  users: User[];
  messages: Record<number, ServerMessage>;
  pending: PendingMessage[];
  lastRead: Record<ChatId, number>;
  drafts: Record<ChatId, string>;
  online: boolean;
  ready: boolean; // first sync finished
  toast: { id: number; text: string } | null;
  modal: ModalSpec | null;
  theme: ThemeMode;
}

// ---------------------------------------------------------------- persistence
const AUTH_KEY = 'cc.auth';
const THEME_KEY = 'cc.theme';
const readKey = (rollNo: string) => `cc.read.${rollNo}`;

function load<T>(key: string): T | null {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode / quota: the app still works, it just forgets */
  }
}

// ---------------------------------------------------------------- store core
const savedAuth = load<User & { token: string }>(AUTH_KEY);
if (savedAuth) api.setToken(savedAuth.token);

let hasStoredRead = false;
const savedRead = savedAuth ? load<Record<ChatId, number>>(readKey(savedAuth.rollNo)) : null;
if (savedRead) hasStoredRead = true;

let state: State = {
  me: savedAuth ? { rollNo: savedAuth.rollNo, name: titleCase(savedAuth.name) } : null,
  users: [],
  messages: {},
  pending: [],
  lastRead: savedRead ?? {},
  drafts: {},
  online: true,
  ready: false,
  toast: null,
  modal: null,
  theme: load<ThemeMode>(THEME_KEY) ?? 'system',
};

const listeners = new Set<() => void>();
function set(patch: Partial<State> | ((s: State) => Partial<State>)) {
  state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
  listeners.forEach((l) => l());
}
export const getState = () => state;
export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => selector(state),
  );
}

// ---------------------------------------------------------------- helpers
export const chatOf = (m: Pick<ServerMessage, 'from' | 'to'>, me: string): ChatId =>
  m.to === CLASS_ID ? CLASS_ID : m.from === me ? m.to : m.from;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// remember what we changed locally, so a slow poll that started earlier can't undo it
const touchedAt = new Map<number, number>(); // id -> time we last edited/created it locally
const deletedAt = new Map<number, number>(); // id -> time we deleted it locally

// ---------------------------------------------------------------- toast & modal
let toastId = 0;
let toastTimer: number | undefined;
export function showToast(text: string) {
  const id = ++toastId;
  set({ toast: { id, text } });
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    if (state.toast?.id === id) set({ toast: null });
  }, 3800);
}
export const openModal = (modal: ModalSpec) => set({ modal });
export const closeModal = () => set({ modal: null });

// ---------------------------------------------------------------- theme
const resolveDark = (mode: ThemeMode) =>
  mode === 'dark' || (mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);

export function applyTheme() {
  const dark = resolveDark(state.theme);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#161717' : '#ffffff');
}
export function setTheme(theme: ThemeMode) {
  save(THEME_KEY, theme);
  set({ theme });
  applyTheme();
}
export const toggleTheme = () => setTheme(resolveDark(state.theme) ? 'light' : 'dark');
export const isDark = (mode: ThemeMode) => resolveDark(mode);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => state.theme === 'system' && applyTheme());
applyTheme();

// ---------------------------------------------------------------- session
function startSession(me: User) {
  const stored = load<Record<ChatId, number>>(readKey(me.rollNo));
  hasStoredRead = stored !== null;
  set({
    me,
    users: [],
    messages: {},
    pending: [],
    drafts: {},
    lastRead: stored ?? {},
    ready: false,
    online: true,
  });
}

export async function login(rollNo: string, password: string) {
  api.setToken(api.makeToken(rollNo.trim(), password));
  try {
    const me = await api.getMe();
    save(AUTH_KEY, { ...me, token: api.makeToken(rollNo.trim(), password) });
    startSession(me);
  } catch (e) {
    api.setToken(null);
    throw e;
  }
}

export async function register(rollNo: string, name: string, password: string) {
  await api.registerUser(rollNo.trim(), name.trim(), password);
  await login(rollNo, password);
}

export function logout(message?: string) {
  stopSync();
  api.setToken(null);
  try {
    localStorage.removeItem(AUTH_KEY);
  } catch {
    /* ignore */
  }
  historyLoaded.clear();
  set({ me: null, users: [], messages: {}, pending: [], drafts: {}, lastRead: {}, ready: false, modal: null });
  navigate('/', 'replace');
  if (message) showToast(message);
}

// ---------------------------------------------------------------- data in
export async function refreshUsers() {
  const res = await api.listUsers();
  const users = [...res.users].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  set({ users });
  lastUsersFetch = Date.now();
  needUsers = false;
}
let lastUsersFetch = 0;
let needUsers = false;

/** Merge a list from the server into the store. `prune` also drops messages the server no longer returns. */
function applyList(res: { count: number; total: number; messages: ServerMessage[] }, startedAt: number, prune: boolean) {
  const list = res.messages;
  set((s) => {
    let changed = false;
    const next = { ...s.messages };

    for (const m of list) {
      if ((deletedAt.get(m.id) ?? 0) > startedAt || (touchedAt.get(m.id) ?? 0) > startedAt) continue;
      const old = next[m.id];
      if (!old || old.text !== m.text || old.editedAt !== m.editedAt) {
        next[m.id] = m;
        changed = true;
      }
      if (!needUsers && !s.users.some((u) => u.rollNo === m.from)) needUsers = true;
    }

    if (prune) {
      // the list is the newest N visible messages: anything cached at or after its first id must be in it, or it was deleted
      const minId = res.count === res.total ? 0 : (list[0]?.id ?? Infinity);
      const ids = new Set(list.map((m) => m.id));
      for (const key of Object.keys(next)) {
        const id = Number(key);
        if (id >= minId && !ids.has(id) && (touchedAt.get(id) ?? 0) <= startedAt) {
          delete next[id];
          changed = true;
        }
      }
    }
    return changed ? { messages: next } : {};
  });
}

const historyLoaded = new Set<ChatId>();
/** Fetch up to 100 messages of one conversation (the global feed only holds the newest 100 overall). */
export async function loadHistory(chatId: ChatId) {
  if (historyLoaded.has(chatId)) return;
  historyLoaded.add(chatId);
  const startedAt = Date.now();
  try {
    applyList(await api.listMessages({ with: chatId, limit: 100 }), startedAt, false);
  } catch {
    historyLoaded.delete(chatId); // try again next time the chat is opened
  }
}

// ---------------------------------------------------------------- polling loop
const POLL_MS = 3000;
const POLL_HIDDEN_MS = 15000;
let stopped = true;
let inFlight = false;
let generation = 0;
let failures = 0;
let timer: number | undefined;

export function startSync() {
  if (!stopped) return;
  stopped = false;
  const gen = ++generation;
  document.addEventListener('visibilitychange', poke);
  window.addEventListener('online', poke);
  window.addEventListener('focus', poke);
  void tick(gen);
}
export function stopSync() {
  stopped = true;
  generation++;
  inFlight = false; // a request still in the air belongs to the old generation and will be ignored
  clearTimeout(timer);
  document.removeEventListener('visibilitychange', poke);
  window.removeEventListener('online', poke);
  window.removeEventListener('focus', poke);
}
/** poll right now (tab became visible again, network came back, ...) */
function poke() {
  if (stopped || inFlight || document.hidden) return;
  clearTimeout(timer);
  void tick(generation);
}

async function tick(gen: number) {
  if (stopped || gen !== generation || inFlight) return;
  inFlight = true;
  let delay = document.hidden ? POLL_HIDDEN_MS : POLL_MS;
  const startedAt = Date.now();
  try {
    const usersDue = needUsers || startedAt - lastUsersFetch > 30000;
    const [feed] = await Promise.all([
      api.listMessages({ limit: 100 }),
      usersDue ? refreshUsers().catch(() => undefined) : undefined,
    ]);
    if (gen !== generation) return;
    applyList(feed, startedAt, true);
    if (!state.ready) firstSyncDone();
    failures = 0;
    if (!state.online) set({ online: true });
  } catch (e) {
    if (gen !== generation) return;
    if (e instanceof ApiError && e.status === 401) {
      logout('Your session expired. Please log in again.');
      return;
    }
    if (e instanceof ApiError && e.status === 429) {
      delay = Math.max(delay, (e.retryAfter ?? 5) * 1000 + 250);
    } else {
      failures++;
      if (state.online) set({ online: false });
      delay = Math.min(3000 * 2 ** failures, 15000);
    }
  } finally {
    if (gen === generation) inFlight = false;
  }
  if (!stopped && gen === generation) timer = window.setTimeout(() => void tick(gen), delay);
}

/** On a brand-new device everything that already exists counts as read; only what arrives later is "unread". */
function firstSyncDone() {
  let lastRead = state.lastRead;
  if (!hasStoredRead && state.me) {
    lastRead = {};
    for (const m of Object.values(state.messages)) {
      const chat = chatOf(m, state.me.rollNo);
      lastRead[chat] = Math.max(lastRead[chat] ?? 0, m.id);
    }
    save(readKey(state.me.rollNo), lastRead);
    hasStoredRead = true;
  }
  set({ ready: true, lastRead });
}

// ---------------------------------------------------------------- read state & drafts
export function markRead(chatId: ChatId) {
  const me = state.me?.rollNo;
  if (!me) return;
  let max = 0;
  for (const m of Object.values(state.messages)) if (m.id > max && chatOf(m, me) === chatId) max = m.id;
  if (max <= (state.lastRead[chatId] ?? 0)) return;
  const lastRead = { ...state.lastRead, [chatId]: max };
  save(readKey(me), lastRead);
  set({ lastRead });
}

export function setDraft(chatId: ChatId, text: string) {
  if ((state.drafts[chatId] ?? '') === text) return;
  set((s) => ({ drafts: { ...s.drafts, [chatId]: text } }));
}

// ---------------------------------------------------------------- sending
let tempSeq = 0;
let sendQueue: Promise<void> = Promise.resolve(); // sends go out one at a time, in order

export function sendMessage(to: ChatId, text: string) {
  const p: PendingMessage = {
    tempId: `p${++tempSeq}`,
    to,
    text: text.trim(),
    createdAt: new Date().toISOString(),
    status: 'sending',
  };
  set((s) => ({ pending: [...s.pending, p] }));
  sendQueue = sendQueue.then(() => deliver(p.tempId));
}

export function retryMessage(tempId: string) {
  set((s) => ({ pending: s.pending.map((p) => (p.tempId === tempId ? { ...p, status: 'sending' } : p)) }));
  sendQueue = sendQueue.then(() => deliver(tempId));
}

export function discardPending(tempId: string) {
  set((s) => ({ pending: s.pending.filter((p) => p.tempId !== tempId) }));
}

async function deliver(tempId: string) {
  const find = () => state.pending.find((p) => p.tempId === tempId);
  for (let attempt = 0; attempt < 4; attempt++) {
    const p = find();
    if (!p) return; // discarded meanwhile
    try {
      const msg = await api.sendMessage(p.to, p.text);
      touchedAt.set(msg.id, Date.now());
      set((s) => ({
        messages: { ...s.messages, [msg.id]: msg },
        pending: s.pending.filter((x) => x.tempId !== tempId),
      }));
      return;
    } catch (e) {
      if (e instanceof ApiError && e.status === 429 && attempt < 3) {
        await sleep((e.retryAfter ?? 3) * 1000 + 250); // sending too fast: wait it out, the bubble keeps its clock
        continue;
      }
      if (e instanceof ApiError && e.status === 401) {
        logout('Your session expired. Please log in again.');
        return;
      }
      set((s) => ({ pending: s.pending.map((x) => (x.tempId === tempId ? { ...x, status: 'failed' } : x)) }));
      if (e instanceof ApiError && e.status !== 0 && e.status !== 429) showToast(e.message);
      return;
    }
  }
}

// ---------------------------------------------------------------- edit & delete (optimistic)
export async function editMessage(id: number, text: string) {
  const before = state.messages[id];
  if (!before) return;
  const optimistic: ServerMessage = { ...before, text: text.trim(), editedAt: new Date().toISOString() };
  touchedAt.set(id, Date.now());
  set((s) => ({ messages: { ...s.messages, [id]: optimistic } }));
  try {
    const saved = await api.editMessage(id, text.trim());
    touchedAt.set(id, Date.now());
    set((s) => (s.messages[id] ? { messages: { ...s.messages, [id]: saved } } : {}));
  } catch (e) {
    touchedAt.set(id, Date.now());
    set((s) => ({ messages: { ...s.messages, [id]: before } }));
    showToast(e instanceof ApiError && e.status === 0 ? "Couldn't edit the message. You're offline." : (e as Error).message);
  }
}

export async function deleteMessage(id: number) {
  const before = state.messages[id];
  if (!before) return;
  deletedAt.set(id, Date.now());
  set((s) => {
    const next = { ...s.messages };
    delete next[id];
    return { messages: next };
  });
  try {
    await api.deleteMessage(id);
    deletedAt.set(id, Date.now());
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return; // already gone
    deletedAt.delete(id);
    touchedAt.set(id, Date.now());
    set((s) => ({ messages: { ...s.messages, [id]: before } }));
    showToast(e instanceof ApiError && e.status === 0 ? "Couldn't delete the message. You're offline." : (e as Error).message);
  }
}
