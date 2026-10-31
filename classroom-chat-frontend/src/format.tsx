import type { ReactNode } from 'react';
import { renderEmojiText } from './emoji-render';

const timeFmt = new Intl.DateTimeFormat([], { hour: 'numeric', minute: '2-digit' });
export const formatTime = (iso: string) => timeFmt.format(new Date(iso));

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
/** whole calendar days from b to a */
export const dayDiff = (a: Date, b: Date) => Math.round((startOfDay(a) - startOfDay(b)) / 86_400_000);
export const sameDay = (a: string, b: string) => dayDiff(new Date(a), new Date(b)) === 0;

/** the little timestamp on a chat-list row */
export function formatListTime(iso: string) {
  const d = new Date(iso);
  const diff = dayDiff(new Date(), d);
  if (diff <= 0) return formatTime(iso);
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return d.toLocaleDateString([], { weekday: 'long' });
  return d.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** the pill between days inside a conversation */
export function formatDayLabel(iso: string) {
  const d = new Date(iso);
  const diff = dayDiff(new Date(), d);
  if (diff <= 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return d.toLocaleDateString([], { weekday: 'long' });
  return d.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' });
}

// http(s):// and www. links; the last char class stops trailing punctuation from being swallowed
const URL_RE = /((?:https?:\/\/|www\.)[^\s<]*[^\s<.,;:!?)"'\]])/gi;

export function renderText(text: string, query = '', emojiSize: 'small' | 'large' = 'small'): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let k = 0;
  const plain = (s: string) => (query ? highlight(s, query, `h${k++}`) : renderEmojiText(s, emojiSize, `e${k++}`));
  for (const m of text.matchAll(URL_RE)) {
    const at = m.index ?? 0;
    if (at > last) out.push(...plain(text.slice(last, at)));
    const url = m[0];
    out.push(
      <a key={`u${k++}`} href={url.startsWith('www.') ? `https://${url}` : url} target="_blank" rel="noopener noreferrer">
        {url}
      </a>,
    );
    last = at + url.length;
  }
  if (last < text.length) out.push(...plain(text.slice(last)));
  return out;
}

export function highlight(text: string, query: string, keyPrefix = 'h'): ReactNode[] {
  const q = query.trim();
  if (!q) return renderEmojiText(text, 'small', keyPrefix);
  const out: ReactNode[] = [];
  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  let from = 0;
  let k = 0;
  for (;;) {
    const at = lower.indexOf(needle, from);
    if (at === -1) break;
    if (at > from) out.push(...renderEmojiText(text.slice(from, at), 'small', `${keyPrefix}-pre${k}`));
    out.push(<mark key={`${keyPrefix}-${k}`}>{renderEmojiText(text.slice(at, at + needle.length), 'small', `${keyPrefix}-hit${k}`)}</mark>);
    k++;
    from = at + needle.length;
  }
  if (from < text.length) out.push(...renderEmojiText(text.slice(from), 'small', `${keyPrefix}-tail`));
  return out;
}

// 1 to 3 emoji and nothing else: WhatsApp shows these big
const EMOJI_ONLY = /^(?:(?:\p{Extended_Pictographic}|\p{Regional_Indicator}{2})(?:️|‍\p{Extended_Pictographic}|\p{Emoji_Modifier})*\s*){1,3}$/u;
export const isEmojiOnly = (text: string) => EMOJI_ONLY.test(text.trim());

/** a stable hue per person so their name keeps its colour in group chats */
export function hueOf(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return Math.round(((h % 997) * 137.508) % 360); // golden-angle spread so neighbours get clearly different colours
}
