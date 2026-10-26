import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { EMOJI_CATEGORIES, loadRecentEmoji, pushRecentEmoji } from '../emoji';
import { EmojiSprite } from '../emoji-render';
import type { searchEmoji } from '../emoji-search';

const CELL_HEIGHT = 42;
const OVERSCAN_ROWS = 2;

function EmojiGrid({ emojis, label, onPick }: { emojis: string[]; label: string; onPick: (emoji: string) => void }) {
  const scroller = useRef<HTMLDivElement>(null);
  const pendingFrame = useRef<number | null>(null);
  const [size, setSize] = useState({ width: 320, height: 220 });
  const [scrollTop, setScrollTop] = useState(0);

  useLayoutEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const measure = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => {
      observer.disconnect();
      if (pendingFrame.current !== null) cancelAnimationFrame(pendingFrame.current);
    };
  }, []);

  const columns = Math.max(1, Math.floor((size.width - 24) / CELL_HEIGHT));
  const rowCount = Math.ceil(emojis.length / columns);
  const firstRow = Math.max(0, Math.floor(scrollTop / CELL_HEIGHT) - OVERSCAN_ROWS);
  const lastRow = Math.min(rowCount, firstRow + Math.ceil(size.height / CELL_HEIGHT) + OVERSCAN_ROWS * 2 + 1);
  const rows = [];
  for (let row = firstRow; row < lastRow; row++) {
    const start = row * columns;
    rows.push(
      <div className="emoji-virtual-row" style={{ top: row * CELL_HEIGHT, gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }} key={row}>
        {emojis.slice(start, start + columns).map((emoji, index) => (
          <button
            key={`${start + index}-${emoji}`}
            className="emoji-btn"
            type="button"
            role="option"
            aria-selected={false}
            aria-label={emoji}
            title={emoji}
            onClick={() => onPick(emoji)}
          >
            <EmojiSprite emoji={emoji} size="large" decorative />
          </button>
        ))}
      </div>,
    );
  }

  return (
    <div
      className="emoji-grid"
      ref={scroller}
      role="listbox"
      aria-label={label}
      onScroll={(event) => {
        const next = event.currentTarget.scrollTop;
        if (pendingFrame.current !== null) cancelAnimationFrame(pendingFrame.current);
        pendingFrame.current = requestAnimationFrame(() => {
          setScrollTop(next);
          pendingFrame.current = null;
        });
      }}
    >
      <div className="emoji-grid-spacer" style={{ height: rowCount * CELL_HEIGHT }}>{rows}</div>
    </div>
  );
}

export function EmojiPanel({ onPick }: { onPick: (emoji: string) => void }) {
  const [recent, setRecent] = useState(loadRecentEmoji);
  const [active, setActive] = useState(recent.length ? 'recent' : EMOJI_CATEGORIES[0].id);
  const [query, setQuery] = useState('');
  const [searcher, setSearcher] = useState<typeof searchEmoji | null>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const trimmedQuery = query.trim();

  useEffect(() => {
    if (!trimmedQuery || searcher) return;
    let cancelled = false;
    import('../emoji-search').then((module) => {
      if (!cancelled) setSearcher(() => module.searchEmoji);
    });
    return () => { cancelled = true; };
  }, [trimmedQuery, searcher]);

  const results = useMemo(
    () => (trimmedQuery && searcher ? searcher(trimmedQuery, recent) : []),
    [trimmedQuery, searcher, recent],
  );
  const tabs = [
    ...(recent.length ? [{ id: 'recent', label: 'Recent', icon: '🕘', emojis: recent }] : []),
    ...EMOJI_CATEGORIES,
  ];
  const selected = tabs.find((tab) => tab.id === active) ?? tabs[0];
  const searching = trimmedQuery.length > 0;
  const emojis = searching ? results : selected.emojis;
  const label = searching ? 'Search results' : selected.label;

  const pick = (emoji: string) => {
    setRecent(pushRecentEmoji(emoji));
    onPick(emoji);
  };

  return (
    <div
      className="emoji-panel"
      onPointerDown={(event) => {
        if (event.target instanceof Element && event.target.closest('button')) event.preventDefault();
      }}
    >
      <div className="emoji-search-wrap">
        <input
          ref={searchInput}
          className="emoji-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && results.length) {
              event.preventDefault();
              pick(results[0]);
            } else if (event.key === 'Escape' && query) {
              event.stopPropagation();
              setQuery('');
            }
          }}
          placeholder="Search emoji"
          aria-label="Search emoji by name"
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      <div className="emoji-title" aria-live="polite">
        {label}{searching && searcher ? ` · ${results.length}` : ''}
      </div>
      {searching && !searcher ? (
        <div className="emoji-empty" role="status">Loading emoji search…</div>
      ) : emojis.length ? (
        <EmojiGrid key={searching ? `search:${query}` : active} emojis={emojis} label={label} onPick={pick} />
      ) : (
        <div className="emoji-empty" role="status">No emoji found</div>
      )}
      <div className="emoji-tabs" role="tablist" aria-label="Emoji categories">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={!searching && tab.id === selected.id}
            aria-label={tab.label}
            title={tab.label}
            className={`emoji-tab${!searching && tab.id === selected.id ? ' active' : ''}`}
            onClick={() => { setActive(tab.id); setQuery(''); }}
          >
            <EmojiSprite emoji={tab.icon} decorative />
          </button>
        ))}
      </div>
    </div>
  );
}
