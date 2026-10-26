import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Icon } from '../icons';
import { editMessage, getState, sendMessage, setDraft } from '../store';
import { MAX_TEXT, type ChatId } from '../types';
import { EmojiPanel } from './EmojiPanel';

export interface EditTarget {
  id: number;
  text: string;
}

interface Props {
  chatId: ChatId;
  editing: EditTarget | null;
  onCancelEdit: () => void;
  onSent: () => void;
}

const MAX_HEIGHT = 120; // about 6 lines, then the box scrolls
const isTouch = () => matchMedia('(pointer: coarse)').matches;

export function Composer({ chatId, editing, onCancelEdit, onSent }: Props) {
  const [text, setText] = useState(() => getState().drafts[chatId] ?? '');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const editingId = editing?.id;

  // entering edit mode loads the old text; leaving it brings the draft back
  useEffect(() => {
    if (editing) setText(editing.text);
    else setText(getState().drafts[chatId] ?? '');
    if (editing || !isTouch()) ref.current?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId]);

  // keep the text box as tall as its content
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  }, [text]);

  // laptop: start typing straight away. phone: don't pop the keyboard up uninvited
  useEffect(() => {
    if (!isTouch()) ref.current?.focus({ preventScroll: true });
  }, [chatId]);

  const change = (value: string) => {
    setText(value);
    if (!editing) setDraft(chatId, value);
  };

  const submit = useCallback(() => {
    const value = text.trim();
    if (!value) return;
    if (editing) {
      if (value !== editing.text.trim()) void editMessage(editing.id, value);
      onCancelEdit();
      return;
    }
    sendMessage(chatId, value);
    setText('');
    setDraft(chatId, '');
    onSent();
    ref.current?.focus({ preventScroll: true });
  }, [text, editing, chatId, onCancelEdit, onSent]);

  const insertEmoji = (emoji: string) => {
    const el = ref.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    const next = (text.slice(0, start) + emoji + text.slice(end)).slice(0, MAX_TEXT);
    change(next);
    requestAnimationFrame(() => {
      el?.focus({ preventScroll: true });
      el?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && !isTouch()) {
      e.preventDefault();
      submit();
    } else if (e.key === 'Escape') {
      if (emojiOpen) {
        e.stopPropagation();
        setEmojiOpen(false);
      } else if (editing) {
        e.stopPropagation();
        onCancelEdit();
      }
    }
  };

  const hasText = text.trim().length > 0;
  const remaining = MAX_TEXT - text.length;

  return (
    <div className="composer-wrap">
      {editing && (
        <div className="edit-banner">
          <Icon name="edit" size={20} />
          <div className="edit-banner-body">
            <strong>Edit message</strong>
            <span>{editing.text}</span>
          </div>
          <button className="icon-btn" aria-label="Cancel edit" onClick={onCancelEdit}>
            <Icon name="close" size={22} />
          </button>
        </div>
      )}

      <div className="composer">
        <div className="composer-main">
        <button
          className="icon-btn composer-icon"
          aria-label={emojiOpen ? 'Show keyboard' : 'Emoji'}
          aria-pressed={emojiOpen}
          onPointerDown={(e) => e.preventDefault() /* don't steal focus from the text box */}
          onClick={() => {
            setEmojiOpen((v) => !v);
            ref.current?.focus({ preventScroll: true });
          }}
        >
          <Icon name={emojiOpen ? 'keyboard' : 'emoji'} size={26} />
        </button>

        <div className="input-wrap">
          <textarea
            ref={ref}
            rows={1}
            value={text}
            onChange={(e) => change(e.target.value)}
            onKeyDown={onKeyDown}
            maxLength={MAX_TEXT}
            placeholder={editing ? 'Edit message' : 'Type a message'}
            aria-label="Type a message"
            enterKeyHint={isTouch() ? 'enter' : 'send'}
            inputMode={emojiOpen && isTouch() ? 'none' : 'text'}
            autoComplete="off"
          />
          {remaining <= 100 && (
            <span className={`counter${remaining <= 0 ? ' limit' : ''}`} aria-live="polite">
              {text.length}/{MAX_TEXT}
            </span>
          )}
        </div>

        <button
          className={`send-btn${hasText ? ' show' : ''}`}
          aria-label={editing ? 'Save edit' : 'Send'}
          tabIndex={hasText ? 0 : -1}
          onPointerDown={(e) => e.preventDefault() /* keep the keyboard open on phones */}
          onClick={submit}
        >
          <Icon name={editing ? 'check' : 'send'} size={22} />
        </button>
        </div>
      </div>

      {emojiOpen && <EmojiPanel onPick={insertEmoji} />}
    </div>
  );
}
