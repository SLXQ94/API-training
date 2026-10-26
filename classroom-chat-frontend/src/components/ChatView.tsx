import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { chatName, useConversation } from '../chats';
import { formatDayLabel, sameDay } from '../format';
import { Avatar, Icon } from '../icons';
import { goBack, isMobileLayout } from '../router';
import {
  deleteMessage,
  discardPending,
  getState,
  isDark,
  loadHistory,
  markRead,
  openModal,
  retryMessage,
  showToast,
  toggleTheme,
  useStore,
} from '../store';
import { CLASS_ID, type ChatMessage } from '../types';
import { Composer, type EditTarget } from './Composer';
import { ContextMenu, type MenuAnchor, type MenuItem } from './ContextMenu';
import { MessageRow } from './MessageRow';
import { SearchPanel } from './SearchPanel';

type Item =
  | { type: 'day'; key: string; label: string }
  | { type: 'unread'; key: string; count: number }
  | { type: 'msg'; key: string; msg: ChatMessage; first: boolean };

const NEAR_BOTTOM_PX = 70;

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // plain http (e.g. opened over the wifi) has no clipboard API: fall back to the old way
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  showToast('Message copied');
}

export function ChatView({ chatId }: { chatId: string }) {
  const me = useStore((s) => s.me)!;
  const users = useStore((s) => s.users);
  const online = useStore((s) => s.online);
  const ready = useStore((s) => s.ready);
  const theme = useStore((s) => s.theme);
  const msgs = useConversation(chatId);

  const isGroup = chatId === CLASS_ID;
  const title = chatName(chatId, users);
  const nameOf = useCallback(
    (id: string) => (id === me.rollNo ? 'You' : (users.find((u) => u.rollNo === id)?.name ?? id)),
    [users, me.rollNo],
  );

  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const initialDone = useRef(false);
  const lastKeyRef = useRef<string | null>(null);

  const [atBottom, setAtBottom] = useState(true);
  const [seenId, setSeenId] = useState(0); // newest incoming message the user has had in view
  const [flashKey, setFlashKey] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ anchor: MenuAnchor; msg: ChatMessage } | null>(null);
  const [headerMenu, setHeaderMenu] = useState<MenuAnchor | null>(null);
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // the "N unread messages" divider is placed once, relative to what was read when the chat opened
  const [readAtOpen, setReadAtOpen] = useState<number | null>(() => (getState().ready ? (getState().lastRead[chatId] ?? 0) : null));
  useEffect(() => {
    if (ready && readAtOpen === null) setReadAtOpen(getState().lastRead[chatId] ?? 0);
  }, [ready, readAtOpen, chatId]);

  useEffect(() => {
    void loadHistory(chatId);
  }, [chatId]);

  // ---------------------------------------------------------------- items
  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    const unreadCount =
      readAtOpen === null ? 0 : msgs.filter((m) => m.from !== me.rollNo && m.id !== undefined && m.id > readAtOpen).length;
    let dividerDone = unreadCount === 0;
    let prev: ChatMessage | undefined;
    for (const m of msgs) {
      let breakRun = false;
      if (!prev || !sameDay(prev.createdAt, m.createdAt)) {
        out.push({ type: 'day', key: `d-${m.key}`, label: formatDayLabel(m.createdAt) });
        breakRun = true;
      }
      if (!dividerDone && m.from !== me.rollNo && m.id !== undefined && m.id > (readAtOpen ?? 0)) {
        out.push({ type: 'unread', key: 'unread-divider', count: unreadCount });
        dividerDone = true;
        breakRun = true;
      }
      out.push({ type: 'msg', key: m.key, msg: m, first: breakRun || !prev || prev.from !== m.from });
      prev = m;
    }
    return out;
  }, [msgs, readAtOpen, me.rollNo]);

  const maxIncomingId = useMemo(
    () => msgs.reduce((max, m) => (m.from !== me.rollNo && m.id !== undefined && m.id > max ? m.id : max), 0),
    [msgs, me.rollNo],
  );
  const unreadBelow = useMemo(
    () => msgs.filter((m) => m.from !== me.rollNo && m.id !== undefined && m.id > seenId).length,
    [msgs, me.rollNo, seenId],
  );

  // ---------------------------------------------------------------- scrolling
  const scrollToBottom = useCallback((smooth = false) => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    atBottomRef.current = near;
    setAtBottom(near);
  }, []);

  // first paint of this chat: jump to the first unread message, or to the newest one
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || initialDone.current || readAtOpen === null) return;
    initialDone.current = true;
    const divider = el.querySelector<HTMLElement>('#unread-divider');
    el.scrollTop = divider ? Math.max(0, divider.offsetTop - 48) : el.scrollHeight;
    onScroll();
  }, [readAtOpen, onScroll]);

  // a new message at the end: follow it if we're at the bottom (or it's ours), otherwise let the badge count it
  useLayoutEffect(() => {
    const last = msgs[msgs.length - 1];
    if (!last || !initialDone.current) {
      lastKeyRef.current = last?.key ?? null;
      return;
    }
    if (lastKeyRef.current !== last.key) {
      lastKeyRef.current = last.key;
      if (atBottomRef.current || last.from === me.rollNo) scrollToBottom(true);
    }
  }, [msgs, me.rollNo, scrollToBottom]);

  // content or viewport changed size (history loaded, composer grew, keyboard opened): stay glued to the bottom
  useEffect(() => {
    const inner = innerRef.current;
    const outer = scrollRef.current;
    if (!inner || !outer) return;
    const ro = new ResizeObserver(() => {
      if (initialDone.current && atBottomRef.current) outer.scrollTop = outer.scrollHeight;
    });
    ro.observe(inner);
    ro.observe(outer);
    return () => ro.disconnect();
  }, []);

  // everything up to the bottom has been seen
  useEffect(() => {
    if (atBottom) setSeenId(maxIncomingId);
  }, [atBottom, maxIncomingId]);

  // mark the chat read while it's on screen and scrolled to the newest message
  useEffect(() => {
    const run = () => {
      if (atBottomRef.current && !document.hidden && initialDone.current) markRead(chatId);
    };
    run();
    document.addEventListener('visibilitychange', run);
    return () => document.removeEventListener('visibilitychange', run);
  }, [chatId, atBottom, maxIncomingId, readAtOpen]);

  // ---------------------------------------------------------------- actions
  const jumpTo = useCallback((msg: ChatMessage) => {
    if (isMobileLayout()) setSearchOpen(false);
    document.getElementById(`msg-${msg.key}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setFlashKey(msg.key);
    window.setTimeout(() => setFlashKey((k) => (k === msg.key ? null : k)), 1800);
  }, []);

  const openMenu = useCallback((msg: ChatMessage, anchor: MenuAnchor) => setMenu({ msg, anchor }), []);
  const onRetry = useCallback((key: string) => retryMessage(key), []);

  const itemsFor = (msg: ChatMessage): MenuItem[] => {
    const list: MenuItem[] = [{ label: 'Copy', icon: 'copy', onClick: () => void copyText(msg.text) }];
    if (msg.from !== me.rollNo) return list;
    if (msg.status === 'failed') {
      list.unshift({ label: 'Retry', icon: 'retry', onClick: () => retryMessage(msg.key) });
      list.push({ label: 'Delete', icon: 'trash', danger: true, onClick: () => discardPending(msg.key) });
    } else if (msg.status === 'sent' && msg.id !== undefined) {
      const id = msg.id;
      list.push({ label: 'Edit', icon: 'edit', onClick: () => setEditing({ id, text: msg.text }) });
      list.push({
        label: 'Delete',
        icon: 'trash',
        danger: true,
        onClick: () =>
          openModal({
            title: 'Delete message?',
            body: 'This message will be deleted for everyone in this chat.',
            confirmLabel: 'Delete',
            onConfirm: () => void deleteMessage(id),
          }),
      });
    }
    return list;
  };

  const headerItems: MenuItem[] = [
    { label: 'Search messages', icon: 'search', onClick: () => setSearchOpen(true) },
    { label: isDark(theme) ? 'Light mode' : 'Dark mode', icon: isDark(theme) ? 'sun' : 'moon', onClick: toggleTheme },
    { label: 'Close chat', icon: 'close', onClick: () => goBack('/') },
  ];

  // Esc: close search first, then (on a laptop) close the chat. Menus/modals have their own Esc.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Escape' || !rootRef.current?.contains(e.target as Node)) return;
    if (searchOpen) setSearchOpen(false);
    else if (!isMobileLayout()) goBack('/');
  };

  const subtitle = !online
    ? 'connecting…'
    : isGroup
      ? ['You', ...users.filter((u) => u.rollNo !== me.rollNo).map((u) => u.name)].join(', ')
      : chatId;

  // ---------------------------------------------------------------- render
  return (
    <div className="chat" ref={rootRef} onKeyDown={onKeyDown}>
      <div className="chat-main">
        <header className="chat-header">
          <button className="icon-btn hide-desktop" aria-label="Back" onClick={() => goBack('/')}>
            <Icon name="back" />
          </button>
          <Avatar group={isGroup} id={chatId} name={title} size={40} />
          <div className="chat-title">
            <h2>{title}</h2>
            <p className={!online ? 'connecting' : ''}>{subtitle}</p>
          </div>
          <div className="header-actions">
            <button className="icon-btn" aria-label="Search messages" title="Search messages" onClick={() => setSearchOpen((v) => !v)}>
              <Icon name="search" />
            </button>
            <button
              className="icon-btn"
              aria-label="Menu"
              title="Menu"
              aria-haspopup="menu"
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                setHeaderMenu({ x: r.right, y: r.bottom + 4, alignRight: true });
              }}
            >
              <Icon name="more" />
            </button>
          </div>
        </header>

        <div className="messages-wrap">
          <div className="messages" ref={scrollRef} onScroll={onScroll} role="log" aria-label={`Conversation with ${title}`}>
            <div className="messages-inner" ref={innerRef}>
              {!ready && (
                <div className="center-hint">
                  <span className="spinner" aria-label="Loading messages" />
                </div>
              )}
              {ready && msgs.length === 0 && (
                <div className="info-pill">
                  {isGroup
                    ? 'This is the class group. Everyone who has joined can read what you send here.'
                    : `No messages yet. Say hi to ${title}!`}
                </div>
              )}

              {items.map((it) => {
                if (it.type === 'day') return <div className="date-pill" key={it.key}><span>{it.label}</span></div>;
                if (it.type === 'unread')
                  return (
                    <div className="unread-divider" id="unread-divider" key={it.key}>
                      <span>
                        {it.count} UNREAD MESSAGE{it.count === 1 ? '' : 'S'}
                      </span>
                    </div>
                  );
                const mine = it.msg.from === me.rollNo;
                return (
                  <MessageRow
                    key={it.key}
                    msg={it.msg}
                    mine={mine}
                    first={it.first}
                    senderName={isGroup && !mine ? nameOf(it.msg.from) : undefined}
                    flash={flashKey === it.msg.key}
                    onMenu={openMenu}
                    onRetry={onRetry}
                  />
                );
              })}
            </div>
          </div>

          <button
            className={`scroll-down${atBottom ? '' : ' show'}`}
            aria-label="Scroll to latest message"
            tabIndex={atBottom ? -1 : 0}
            onClick={() => scrollToBottom(true)}
          >
            {unreadBelow > 0 && <span className="badge">{unreadBelow > 99 ? '99+' : unreadBelow}</span>}
            <Icon name="chevronDown" size={28} />
          </button>
        </div>

        <Composer
          chatId={chatId}
          editing={editing}
          onCancelEdit={() => setEditing(null)}
          onSent={() => scrollToBottom(true)}
        />
      </div>

      {searchOpen && (
        <SearchPanel
          messages={msgs}
          query={searchQuery}
          onQuery={setSearchQuery}
          nameOf={nameOf}
          onPick={jumpTo}
          onClose={() => setSearchOpen(false)}
        />
      )}

      {menu && <ContextMenu anchor={menu.anchor} items={itemsFor(menu.msg)} onClose={() => setMenu(null)} />}
      {headerMenu && <ContextMenu anchor={headerMenu} items={headerItems} onClose={() => setHeaderMenu(null)} />}
    </div>
  );
}
