// A tiny hash router. Hash URLs need no server rewrite rules, and every screen change is a real
// history entry, so the Android back button / browser back button work like in a native app.
//
//   #/                  chat list
//   #/new               "new chat" picker
//   #/chat/CS101        a conversation        (#/chat/class = the class group)
//   #/chat/CS101/new    a conversation with the "new chat" panel open (desktop)
import { useMemo, useSyncExternalStore } from 'react';
import { CLASS_ID } from './types';

export interface Route {
  chat: string | null;
  newChat: boolean;
}

let idx: number = typeof history.state?.idx === 'number' ? history.state.idx : 0;
history.replaceState({ idx }, '');

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
// a transient layer (e.g. the emoji panel on a phone) that owns one history entry, so back closes it
let overlay: { idx: number; close: () => void } | null = null;

window.addEventListener('popstate', (e) => {
  idx = typeof e.state?.idx === 'number' ? e.state.idx : 0;
  if (overlay && idx < overlay.idx) {
    const { close } = overlay;
    overlay = null;
    close();
  }
  emit();
});
window.addEventListener('hashchange', emit);

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  if (parts[0] === 'chat' && parts[1]) {
    const id = parts[1].toLowerCase() === CLASS_ID ? CLASS_ID : parts[1].toUpperCase();
    return { chat: id, newChat: parts[2] === 'new' };
  }
  if (parts[0] === 'new') return { chat: null, newChat: true };
  return { chat: null, newChat: false };
}

export const currentRoute = () => parseHash(location.hash);

export function useRoute(): Route {
  const hash = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => location.hash,
  );
  return useMemo(() => parseHash(hash), [hash]);
}

export const isMobileLayout = () => window.matchMedia('(max-width: 899px)').matches;

export function navigate(path: string, mode: 'push' | 'replace' = 'push') {
  const url = `#${path}`;
  if (location.hash === url) return;
  if (mode === 'replace') history.replaceState({ idx }, '', url);
  else history.pushState({ idx: ++idx }, '', url);
  emit();
}

/**
 * Push a history entry for a transient layer: the back button calls `close` instead of leaving the
 * screen. Returns a disposer that removes the entry again if the layer was closed some other way.
 */
export function pushOverlay(close: () => void): () => void {
  const mine = { idx: ++idx, close };
  history.pushState({ idx }, '');
  overlay = mine;
  return () => {
    if (overlay !== mine) return;
    overlay = null;
    history.back();
  };
}

/** Go back one screen; if the app was opened on this screen, go to `fallback` instead. */
export function goBack(fallback = '/') {
  if (idx > 0) history.back();
  else navigate(fallback, 'replace');
}

export const chatPath = (id: string) => `/chat/${encodeURIComponent(id)}`;

export function openChat(id: string) {
  const r = currentRoute();
  // from the "new chat" picker, swap it out; on a phone every chat is a new screen; on a laptop switching chats shouldn't stack history
  const mode = r.newChat ? 'replace' : isMobileLayout() ? 'push' : r.chat ? 'replace' : 'push';
  navigate(chatPath(id), mode);
}

export function openNewChat() {
  const r = currentRoute();
  navigate(r.chat ? `${chatPath(r.chat)}/new` : '/new');
}
