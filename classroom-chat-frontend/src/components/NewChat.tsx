import { useEffect, useMemo, useRef, useState } from 'react';
import { highlight } from '../format';
import { Avatar, Icon } from '../icons';
import { goBack, openChat } from '../router';
import { refreshUsers, useStore } from '../store';
import { CLASS_ID } from '../types';

/** The "New chat" picker: slides over the chat list. */
export function NewChat() {
  const me = useStore((s) => s.me)!;
  const users = useStore((s) => s.users);
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const q = query.trim().toLowerCase();

  useEffect(() => {
    void refreshUsers().catch(() => undefined); // always show a fresh class list
  }, []);

  // laptop: ready to type straight away. phone/tablet: never pop the keyboard up uninvited
  useEffect(() => {
    if (!matchMedia('(pointer: coarse)').matches) searchRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && goBack('/');
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const groups = useMemo(() => {
    const people = users.filter((u) => u.rollNo !== me.rollNo && (!q || u.name.toLowerCase().includes(q) || u.rollNo.toLowerCase().includes(q)));
    const map = new Map<string, typeof people>();
    for (const u of people) {
      const letter = (u.name.trim()[0] ?? '#').toUpperCase();
      const key = /[A-Z]/.test(letter) ? letter : '#';
      map.set(key, [...(map.get(key) ?? []), u]);
    }
    return [...map.entries()].sort(([a], [b]) => (a === '#' ? 1 : b === '#' ? -1 : a.localeCompare(b)));
  }, [users, me.rollNo, q]);

  const showClass = !q || 'class everyone group'.includes(q);

  return (
    <div className="newchat" role="dialog" aria-label="New chat">
      <header className="newchat-header">
        <button className="icon-btn" aria-label="Back" onClick={() => goBack('/')}>
          <Icon name="back" />
        </button>
        <h2>New chat</h2>
      </header>

      <div className="search-wrap">
        <label className="search-box">
          <span className="search-icon">
            <Icon name="search" size={20} />
          </span>
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or roll number"
            aria-label="Search people"
          />
        </label>
      </div>

      <div className="newchat-list">
        {showClass && (
          <button className="chat-row" onClick={() => openChat(CLASS_ID)}>
            <Avatar group />
            <span className="chat-row-body">
              <span className="chat-row-top">
                <span className="chat-row-name">Class</span>
              </span>
              <span className="chat-row-bottom">
                <span className="chat-row-preview">Group chat with everyone</span>
              </span>
            </span>
          </button>
        )}

        {groups.length > 0 && <h3 className="section-title">People in your class</h3>}
        {groups.map(([letter, list]) => (
          <section key={letter}>
            <div className="letter">{letter}</div>
            {list.map((u) => (
              <button className="chat-row" key={u.rollNo} onClick={() => openChat(u.rollNo)}>
                <Avatar id={u.rollNo} name={u.name} />
                <span className="chat-row-body">
                  <span className="chat-row-top">
                    <span className="chat-row-name">{highlight(u.name, q)}</span>
                  </span>
                  <span className="chat-row-bottom">
                    <span className="chat-row-preview">{highlight(u.rollNo, q)}</span>
                  </span>
                </span>
              </button>
            ))}
          </section>
        ))}

        {!groups.length && !showClass && <div className="list-empty">No one found for “{query.trim()}”</div>}
        {!groups.length && showClass && !q && users.length <= 1 && (
          <div className="list-empty">No one else has joined yet. Ask your classmates to register!</div>
        )}
      </div>
    </div>
  );
}
