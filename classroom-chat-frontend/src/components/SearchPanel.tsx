import { useEffect, useMemo, useRef } from 'react';
import { formatDayLabel, formatTime, highlight } from '../format';
import { Icon } from '../icons';
import type { ChatMessage } from '../types';

interface Props {
  messages: ChatMessage[];
  query: string;
  onQuery: (q: string) => void;
  nameOf: (id: string) => string;
  onPick: (msg: ChatMessage) => void;
  onClose: () => void;
}

/** "Search messages" panel inside one conversation (right-hand side on a laptop, full screen on a phone). */
export function SearchPanel({ messages, query, onQuery, nameOf, onPick, onClose }: Props) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);

  const q = query.trim().toLowerCase();
  const hits = useMemo(
    () => (q ? messages.filter((m) => m.text.toLowerCase().includes(q)).reverse() : []),
    [messages, q],
  );

  return (
    <aside className="side-panel" aria-label="Search messages">
      <header className="side-panel-header">
        <button className="icon-btn" aria-label="Close search" onClick={onClose}>
          <Icon name="close" />
        </button>
        <h2>Search messages</h2>
      </header>
      <div className="search-wrap">
        <label className="search-box">
          <span className="search-icon">
            <Icon name="search" size={20} />
          </span>
          <input
            ref={input}
            type="search"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search…"
            aria-label="Search in this chat"
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation();
                onClose();
              }
            }}
          />
        </label>
      </div>
      <div className="side-panel-body">
        {!q ? (
          <div className="list-empty">Search for messages in this chat.</div>
        ) : hits.length === 0 ? (
          <div className="list-empty">No messages found</div>
        ) : (
          hits.map((m) => (
            <button key={m.key} className="hit" onClick={() => onPick(m)}>
              <span className="hit-top">
                <span className="hit-date">{formatDayLabel(m.createdAt)}</span>
                <span className="hit-time">{formatTime(m.createdAt)}</span>
              </span>
              <span className="hit-text">
                <span className="hit-from">{nameOf(m.from)}: </span>
                {highlight(m.text.replace(/\s*\n\s*/g, ' '), query.trim())}
              </span>
            </button>
          ))
        )}
      </div>
    </aside>
  );
}
