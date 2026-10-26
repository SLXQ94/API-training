import { memo, useRef } from 'react';
import { formatTime, hueOf, isEmojiOnly, renderText } from '../format';
import { BubbleTail, Icon, MessageStatus } from '../icons';
import type { ChatMessage } from '../types';
import type { MenuAnchor } from './ContextMenu';

interface Props {
  msg: ChatMessage;
  mine: boolean;
  first: boolean; // first bubble of a run from the same person: gets the tail (and the name in groups)
  senderName?: string; // set only for incoming messages in the class group
  flash: boolean;
  onMenu: (msg: ChatMessage, anchor: MenuAnchor) => void;
  onRetry: (key: string) => void;
}

const LONG_PRESS_MS = 420;

export const MessageRow = memo(function MessageRow({ msg, mine, first, senderName, flash, onMenu, onRetry }: Props) {
  const press = useRef<{ timer: number; x: number; y: number } | null>(null);

  const cancelPress = () => {
    if (press.current) clearTimeout(press.current.timer);
    press.current = null;
  };

  // phones: press and hold a bubble to get the same menu a right-click gives on a laptop
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') return;
    const { clientX: x, clientY: y } = e;
    press.current = {
      x,
      y,
      timer: window.setTimeout(() => {
        press.current = null;
        navigator.vibrate?.(10);
        onMenu(msg, { x, y });
      }, LONG_PRESS_MS),
    };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const p = press.current;
    if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 10) cancelPress();
  };

  const emojiOnly = !msg.editedAt && isEmojiOnly(msg.text);
  const cls = ['row', mine ? 'out' : 'in', first ? 'first' : '', msg.status === 'failed' ? 'failed' : ''].join(' ');

  return (
    <div className={cls} id={`msg-${msg.key}`}>
      {msg.status === 'failed' && (
        <button className="fail-btn" onClick={() => onRetry(msg.key)} aria-label="Message not sent. Tap to retry" title="Not sent. Click to retry">
          <Icon name="error" size={22} />
        </button>
      )}
      <div
        className={`bubble${flash ? ' flash' : ''}${emojiOnly ? ' emoji-only' : ''}`}
        onContextMenu={(e) => {
          e.preventDefault();
          if (e.nativeEvent instanceof PointerEvent && e.nativeEvent.pointerType !== 'mouse') return; // long-press handles touch
          onMenu(msg, { x: e.clientX, y: e.clientY });
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={cancelPress}
        onPointerCancel={cancelPress}
        onPointerLeave={cancelPress}
      >
        {first && <BubbleTail />}
        {senderName && first && (
          <div className="sender" style={{ color: `hsl(${hueOf(msg.from)} var(--av-fg-s) var(--av-fg-l))` }}>
            {senderName}
          </div>
        )}
        <span className="text">{renderText(msg.text, '', emojiOnly ? 'large' : 'small')}</span>
        <span className={`meta-space${mine ? ' mine' : ''}${msg.editedAt ? ' edited' : ''}`} aria-hidden="true" />
        <span className="meta">
          {msg.editedAt && <span className="edited-label">Edited</span>}
          <span className="time">{formatTime(msg.createdAt)}</span>
          {mine && <MessageStatus status={msg.status} />}
        </span>
        <button
          className="bubble-menu-btn"
          aria-label="Message options"
          tabIndex={-1}
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            onMenu(msg, { x: r.right, y: r.bottom + 2, alignRight: true });
          }}
        >
          <Icon name="chevronDown" size={20} />
        </button>
      </div>
    </div>
  );
});
