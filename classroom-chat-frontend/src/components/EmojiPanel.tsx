import { useState } from 'react';
import { EMOJI_CATEGORIES, loadRecentEmoji, pushRecentEmoji } from '../emoji';

export function EmojiPanel({ onPick }: { onPick: (emoji: string) => void }) {
  const [recent, setRecent] = useState(loadRecentEmoji);
  const [active, setActive] = useState(recent.length ? 'recent' : EMOJI_CATEGORIES[0].id);

  const tabs = [
    ...(recent.length ? [{ id: 'recent', label: 'Recent', icon: '🕘', emojis: recent }] : []),
    ...EMOJI_CATEGORIES,
  ];
  const current = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <div className="emoji-panel" onPointerDown={(e) => e.preventDefault() /* keep focus in the text box */}>
      <div className="emoji-grid" role="listbox" aria-label={current.label}>
        <div className="emoji-title">{current.label}</div>
        {current.emojis.map((e) => (
          <button
            key={e}
            className="emoji-btn"
            role="option"
            aria-selected={false}
            onClick={() => {
              setRecent(pushRecentEmoji(e));
              onPick(e);
            }}
          >
            {e}
          </button>
        ))}
      </div>
      <div className="emoji-tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={t.id === current.id}
            aria-label={t.label}
            title={t.label}
            className={`emoji-tab${t.id === current.id ? ' active' : ''}`}
            onClick={() => setActive(t.id)}
          >
            {t.icon}
          </button>
        ))}
      </div>
    </div>
  );
}
