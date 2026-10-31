import type { ReactNode } from 'react';
import unicode from './emoji-data/unicode-wa.json';

type EmojiSize = 'small' | 'large';

const BUCKET_SIZE = 25;
const ordered = unicode as Array<string | string[]>;
const spriteIndex = new Map<string, number>();
let glyphCount = 0;
for (const entry of ordered) {
  if (!entry) continue;
  for (const emoji of Array.isArray(entry) ? entry : [entry]) {
    spriteIndex.set(emoji.replaceAll('\uFE0F', ''), glyphCount);
  }
  glyphCount++;
}
const lastBucket = Math.ceil(glyphCount / BUCKET_SIZE) - 1;
const lastBucketCount = glyphCount - lastBucket * BUCKET_SIZE;
const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
const MAY_CONTAIN_EMOJI = /[\p{Extended_Pictographic}\p{Regional_Indicator}\u20E3]/u;
const EMOJI_CANDIDATES = /[\p{Extended_Pictographic}\p{Regional_Indicator}\u20E3]/gu;

export function getEmojiSpriteIndex(emoji: string): number | undefined {
  return spriteIndex.get(emoji.replaceAll('\uFE0F', ''));
}

export function EmojiSprite({ emoji, size = 'small', decorative = false }: {
  emoji: string;
  size?: EmojiSize;
  decorative?: boolean;
}) {
  const index = getEmojiSpriteIndex(emoji);
  if (index === undefined) return <span aria-hidden={decorative || undefined}>{emoji}</span>;

  const bucket = Math.floor(index / BUCKET_SIZE);
  const offset = index % BUCKET_SIZE;
  const columns = bucket === lastBucket ? Math.floor(Math.sqrt(lastBucketCount)) : 5;
  const rows = bucket === lastBucket ? Math.ceil(lastBucketCount / columns) : 5;
  const displaySize = size === 'large' ? 32 : 20;
  const path = `${import.meta.env.BASE_URL}emoji/wa/64/${bucket}.webp`;

  return (
    <span
      className={`wa-emoji${size === 'large' ? ' wa-emoji-large' : ''}`}
      data-emoji={emoji}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : emoji}
      aria-hidden={decorative || undefined}
      style={{
        backgroundImage: `url("${path}")`,
        backgroundPosition: `-${(offset % columns) * displaySize}px -${Math.floor(offset / columns) * displaySize}px`,
        backgroundSize: `${columns * displaySize}px ${rows * displaySize}px`,
      }}
    >
      <span className="wa-emoji-raw">{emoji}</span>
    </span>
  );
}

function forEachEmojiPart(text: string, onText: (part: string) => void, onEmoji: (emoji: string) => void): void {
  if (!segmenter || !MAY_CONTAIN_EMOJI.test(text)) {
    onText(text);
    return;
  }
  const segments = segmenter.segment(text);
  let from = 0;
  for (const match of text.matchAll(EMOJI_CANDIDATES)) {
    const found = segments.containing(match.index);
    if (!found || found.index < from) continue;
    if (found.index > from) onText(text.slice(from, found.index));
    if (getEmojiSpriteIndex(found.segment) === undefined) onText(found.segment);
    else onEmoji(found.segment);
    from = found.index + found.segment.length;
  }
  if (from < text.length) onText(text.slice(from));
}

/** Replace supported grapheme clusters with local WhatsApp sprite cells. */
export function renderEmojiText(text: string, size: EmojiSize = 'small', keyPrefix = 'emoji'): ReactNode[] {
  const output: ReactNode[] = [];
  let index = 0;
  forEachEmojiPart(text, (part) => output.push(part), (emoji) => {
    output.push(<EmojiSprite key={`${keyPrefix}-${index++}`} emoji={emoji} size={size} />);
  });
  return output;
}

/** The composer mirror keeps each emoji's native text width for caret alignment. */
export function renderComposerEmojiText(text: string): ReactNode[] {
  const output: ReactNode[] = [];
  let index = 0;
  forEachEmojiPart(text, (part) => output.push(part), (emoji) => {
    output.push(
      <span className="composer-emoji-token" key={`composer-emoji-${index++}`}>
        <span className="composer-emoji-measure">{emoji}</span>
        <span className="composer-emoji-art"><EmojiSprite emoji={emoji} decorative /></span>
      </span>,
    );
  });
  return output;
}
