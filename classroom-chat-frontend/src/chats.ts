// Derived data: the chat list and a single conversation, computed from the raw message store.
import { useMemo } from 'react';
import { chatOf, useStore } from './store';
import { CLASS_ID, type ChatId, type ChatMessage, type PendingMessage, type ServerMessage, type User } from './types';

export interface ChatSummary {
  id: ChatId;
  name: string;
  isGroup: boolean;
  last?: ChatMessage;
  unread: number;
  draft: string;
}

export const toChatMessage = (m: ServerMessage): ChatMessage => ({ ...m, key: String(m.id), status: 'sent' });
export const pendingToChatMessage = (p: PendingMessage, me: string): ChatMessage => ({
  key: p.tempId,
  from: me,
  to: p.to,
  text: p.text,
  createdAt: p.createdAt,
  status: p.status,
});

export const chatName = (id: ChatId, users: User[]) =>
  id === CLASS_ID ? 'Class' : (users.find((u) => u.rollNo === id)?.name ?? id);

export function useChats(): ChatSummary[] {
  const me = useStore((s) => s.me);
  const messages = useStore((s) => s.messages);
  const pending = useStore((s) => s.pending);
  const users = useStore((s) => s.users);
  const lastRead = useStore((s) => s.lastRead);
  const drafts = useStore((s) => s.drafts);

  return useMemo(() => {
    if (!me) return [];
    const byChat = new Map<ChatId, ChatSummary>();
    const ensure = (id: ChatId) => {
      let c = byChat.get(id);
      if (!c) {
        c = { id, name: chatName(id, users), isGroup: id === CLASS_ID, unread: 0, draft: drafts[id] ?? '' };
        byChat.set(id, c);
      }
      return c;
    };
    ensure(CLASS_ID); // the class group is always there, like a pinned chat

    for (const m of Object.values(messages)) {
      const c = ensure(chatOf(m, me.rollNo));
      if (!c.last || m.id > (c.last.id ?? 0)) c.last = toChatMessage(m);
      if (m.from !== me.rollNo && m.id > (lastRead[c.id] ?? 0)) c.unread++;
    }
    for (const p of pending) ensure(p.to).last = pendingToChatMessage(p, me.rollNo);
    for (const [id, text] of Object.entries(drafts)) if (text.trim()) ensure(id);

    return [...byChat.values()].sort((a, b) => {
      const ta = a.last ? Date.parse(a.last.createdAt) : 0;
      const tb = b.last ? Date.parse(b.last.createdAt) : 0;
      return tb - ta || a.name.localeCompare(b.name);
    });
  }, [me, messages, pending, users, lastRead, drafts]);
}

export function useConversation(chatId: ChatId): ChatMessage[] {
  const me = useStore((s) => s.me);
  const messages = useStore((s) => s.messages);
  const pending = useStore((s) => s.pending);

  return useMemo(() => {
    if (!me) return [];
    const out: ChatMessage[] = [];
    for (const m of Object.values(messages)) if (chatOf(m, me.rollNo) === chatId) out.push(toChatMessage(m));
    out.sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
    for (const p of pending) if (p.to === chatId) out.push(pendingToChatMessage(p, me.rollNo));
    return out;
  }, [me, messages, pending, chatId]);
}

/** total unread across every chat (for the tab title) */
export const useTotalUnread = () => {
  const chats = useChats();
  return useMemo(() => chats.reduce((n, c) => n + c.unread, 0), [chats]);
};
