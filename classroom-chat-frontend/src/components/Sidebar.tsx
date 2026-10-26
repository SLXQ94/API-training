import { useMemo, useState, type ReactNode } from 'react';
import { chatName, useChats, type ChatSummary } from '../chats';
import { formatListTime, formatTime, highlight } from '../format';
import { renderEmojiText } from '../emoji-render';
import { Avatar, Icon, MessageStatus, NewChatIcon } from '../icons';
import { openChat, openNewChat, useRoute } from '../router';
import { chatOf, isDark, logout, openModal, toggleTheme, useStore } from '../store';
import { CLASS_ID } from '../types';
import { ContextMenu, type MenuAnchor, type MenuItem } from './ContextMenu';
import { NewChat } from './NewChat';

type Filter = 'all' | 'unread' | 'groups';

function confirmLogout() {
  openModal({
    title: 'Log out?',
    body: 'You will need your roll number and password to log back in.',
    confirmLabel: 'Log out',
    onConfirm: () => logout(),
  });
}

/** items for the ⋮ menu and the profile menu */
function useAppMenu(): MenuItem[] {
  const theme = useStore((s) => s.theme);
  const dark = isDark(theme);
  return [
    { label: 'New chat', icon: 'newChat', onClick: openNewChat },
    { label: dark ? 'Light mode' : 'Dark mode', icon: dark ? 'sun' : 'moon', onClick: toggleTheme },
    { label: 'Log out', icon: 'logout', onClick: confirmLogout },
  ];
}

// ------------------------------------------------------------------ desktop rail
export function Rail() {
  const me = useStore((s) => s.me);
  const theme = useStore((s) => s.theme);
  const unread = useChats().reduce((n, c) => n + c.unread, 0);
  const [menu, setMenu] = useState<MenuAnchor | null>(null);
  const dark = isDark(theme);

  return (
    <nav className="rail" aria-label="Main">
      <div className="rail-top">
        <button className="rail-btn active" aria-label="Chats" aria-current="page">
          <Icon name="chat" size={24} />
          {unread > 0 && <span className="rail-badge">{unread > 99 ? '99+' : unread}</span>}
        </button>
      </div>
      <div className="rail-bottom">
        <button className="rail-btn" onClick={toggleTheme} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} title={dark ? 'Light mode' : 'Dark mode'}>
          <Icon name={dark ? 'sun' : 'moon'} size={24} />
        </button>
        <button
          className="rail-btn rail-avatar"
          aria-label={`Account: ${me?.name}`}
          title={me?.name}
          aria-haspopup="menu"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setMenu({ x: r.right + 8, y: r.bottom - 10 }); // the menu flips upward by itself, the avatar is at the bottom of the screen
          }}
        >
          <Avatar id={me?.rollNo} name={me?.name} size={36} />
        </button>
      </div>
      {menu && me && (
        <ContextMenu
          anchor={menu}
          onClose={() => setMenu(null)}
          profile={{ id: me.rollNo, name: me.name }}
          items={[{ label: 'Log out', icon: 'logout', onClick: confirmLogout }]}
        />
      )}
    </nav>
  );
}

// ------------------------------------------------------------------ chat list row
function ChatRow({ chat, active, onOpen, query = '' }: { chat: ChatSummary; active: boolean; onOpen: () => void; query?: string }) {
  const me = useStore((s) => s.me)!;
  const users = useStore((s) => s.users);
  const { last, unread, draft } = chat;
  const mine = last?.from === me.rollNo;
  const showDraft = draft.trim() && !active;

  let preview: ReactNode =<span className="preview-muted">{chat.isGroup ? 'No messages yet' : 'Tap to start chatting'}</span>;
  if (showDraft) {
    preview = (
      <>
        <span className="preview-draft">Draft:</span> {renderEmojiText(draft)}
      </>
    );
  } else if (last) {
    const who = chat.isGroup && !mine ? `${users.find((u) => u.rollNo === last.from)?.name ?? last.from}: ` : chat.isGroup && mine ? 'You: ' : '';
    preview = (
      <>
        {mine && !chat.isGroup && last.status !== 'failed' && <MessageStatus status={last.status} />}
        {who}
        {renderEmojiText(last.text.replace(/\s*\n\s*/g, ' '))}
      </>
    );
  }

  return (
    <button className={`chat-row${active ? ' active' : ''}`} onClick={onOpen} aria-current={active ? 'true' : undefined}>
      <Avatar group={chat.isGroup} id={chat.id} name={chat.name} />
      <span className="chat-row-body">
        <span className="chat-row-top">
          <span className="chat-row-name">{highlight(chat.name, query)}</span>
          {last && <span className={`chat-row-time${unread ? ' unread' : ''}`}>{formatListTime(last.createdAt)}</span>}
        </span>
        <span className="chat-row-bottom">
          <span className="chat-row-preview">{preview}</span>
          {unread > 0 && (
            <span className="badge" aria-label={`${unread} unread`}>
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

function Skeleton() {
  return (
    <div className="skeleton-list" aria-hidden="true">
      {Array.from({ length: 8 }, (_, i) => (
        <div className="skeleton-row" key={i}>
          <span className="sk sk-avatar" />
          <span className="sk-lines">
            <span className="sk sk-line" style={{ width: `${45 + ((i * 17) % 35)}%` }} />
            <span className="sk sk-line short" style={{ width: `${60 + ((i * 11) % 30)}%` }} />
          </span>
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ search results
function SearchResults({ query, chats, activeId }: { query: string; chats: ChatSummary[]; activeId: string | null }) {
  const me = useStore((s) => s.me)!;
  const users = useStore((s) => s.users);
  const messages = useStore((s) => s.messages);
  const q = query.trim().toLowerCase();

  const { matchedChats, contacts, hits } = useMemo(() => {
    const matchedChats = chats.filter((c) => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q));
    const chatIds = new Set(chats.map((c) => c.id));
    const contacts = users.filter(
      (u) => u.rollNo !== me.rollNo && !chatIds.has(u.rollNo) && (u.name.toLowerCase().includes(q) || u.rollNo.toLowerCase().includes(q)),
    );
    const hits = Object.values(messages)
      .filter((m) => m.text.toLowerCase().includes(q))
      .sort((a, b) => b.id - a.id)
      .slice(0, 40);
    return { matchedChats, contacts, hits };
  }, [q, chats, users, messages, me.rollNo]);

  if (!matchedChats.length && !contacts.length && !hits.length) {
    return <div className="list-empty">No chats, contacts or messages found for “{query.trim()}”</div>;
  }

  return (
    <div className="search-results">
      {matchedChats.length > 0 && <h3 className="section-title">Chats</h3>}
      {matchedChats.map((c) => (
        <ChatRow key={c.id} chat={c} active={c.id === activeId} query={query.trim()} onOpen={() => openChat(c.id)} />
      ))}

      {contacts.length > 0 && <h3 className="section-title">Contacts</h3>}
      {contacts.map((u) => (
        <button className="chat-row" key={u.rollNo} onClick={() => openChat(u.rollNo)}>
          <Avatar id={u.rollNo} name={u.name} />
          <span className="chat-row-body">
            <span className="chat-row-top">
              <span className="chat-row-name">{highlight(u.name, query.trim())}</span>
            </span>
            <span className="chat-row-bottom">
              <span className="chat-row-preview">{highlight(u.rollNo, query.trim())}</span>
            </span>
          </span>
        </button>
      ))}

      {hits.length > 0 && <h3 className="section-title">Messages</h3>}
      {hits.map((m) => {
        const chat = chatOf(m, me.rollNo);
        return (
          <button className="chat-row" key={m.id} onClick={() => openChat(chat)}>
            <Avatar group={chat === CLASS_ID} id={chat} name={chatName(chat, users)} />
            <span className="chat-row-body">
              <span className="chat-row-top">
                <span className="chat-row-name">{chatName(chat, users)}</span>
                <span className="chat-row-time">{formatTime(m.createdAt)}</span>
              </span>
              <span className="chat-row-bottom">
                <span className="chat-row-preview">{highlight(m.text.replace(/\s*\n\s*/g, ' '), query.trim())}</span>
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------ the sidebar
export function Sidebar() {
  const route = useRoute();
  const chats = useChats();
  const ready = useStore((s) => s.ready);
  const online = useStore((s) => s.online);
  const me = useStore((s) => s.me);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [menu, setMenu] = useState<MenuAnchor | null>(null);
  const menuItems = useAppMenu();

  const visible = useMemo(
    () => chats.filter((c) => (filter === 'unread' ? c.unread > 0 : filter === 'groups' ? c.isGroup : true)),
    [chats, filter],
  );
  const unreadChats = useMemo(() => chats.filter((c) => c.unread > 0).length, [chats]);
  const searching = query.trim().length > 0;

  return (
    <aside className="sidebar">
      <header className="sidebar-header">
        <h1>
          <span className="title-desktop">Chats</span>
          <span className="title-mobile">Classroom Chat</span>
        </h1>
        <div className="header-actions">
          <button
            className="icon-btn"
            aria-label="Menu"
            title="Menu"
            aria-haspopup="menu"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setMenu({ x: r.right, y: r.bottom + 4, alignRight: true });
            }}
          >
            <Icon name="more" />
          </button>
          <button className="new-chat-btn hide-mobile" aria-label="New chat" title="New chat (Ctrl+Alt+N)" onClick={openNewChat}>
            <NewChatIcon size={24} />
          </button>
        </div>
      </header>

      {!online && (
        <div className="offline-bar" role="status">
          <span className="spinner small" /> Can't reach the server. Trying to reconnect…
        </div>
      )}

      <div className="search-wrap">
        <label className="search-box">
          <span className="search-icon">
            {searching ? (
              <button type="button" className="plain-btn" aria-label="Clear search" onClick={() => setQuery('')}>
                <Icon name="back" size={20} />
              </button>
            ) : (
              <Icon name="search" size={20} />
            )}
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search or start a new chat"
            aria-label="Search chats"
            onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
          />
        </label>
      </div>

      {!searching && (
        <div className="chips" role="tablist" aria-label="Filter chats">
          {(['all', 'unread', 'groups'] as Filter[]).map((f) => (
            <button key={f} role="tab" aria-selected={filter === f} className={`chip${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : f === 'unread' ? 'Unread' : 'Groups'}
              {f === 'unread' && unreadChats > 0 && <span className="chip-count">{unreadChats}</span>}
            </button>
          ))}
        </div>
      )}

      <div className="chat-list" role="list">
        {!ready ? (
          <Skeleton />
        ) : searching ? (
          <SearchResults query={query} chats={chats} activeId={route.chat} />
        ) : visible.length === 0 ? (
          <div className="list-empty">
            {filter === 'unread' ? 'No unread chats' : 'No chats yet'}
            {filter !== 'unread' && <button className="link-btn" onClick={openNewChat}>Start a new chat</button>}
          </div>
        ) : (
          visible.map((c) => <ChatRow key={c.id} chat={c} active={c.id === route.chat} onOpen={() => openChat(c.id)} />)
        )}
      </div>

      <button className="fab" aria-label="New chat" onClick={openNewChat}>
        <NewChatIcon size={26} />
      </button>

      {route.newChat && <NewChat />}
      {menu && (
        <ContextMenu
          anchor={menu}
          items={menuItems}
          onClose={() => setMenu(null)}
          profile={me ? { id: me.rollNo, name: me.name } : undefined}
        />
      )}
    </aside>
  );
}
