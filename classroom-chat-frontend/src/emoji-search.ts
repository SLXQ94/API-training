import categories from './emoji-data/categories-wa.json';
import keywords from './emoji-data/keywords-en.json';
import popular from './emoji-data/popular.json';
import unicode from './emoji-data/unicode-wa.json';

// This module is imported only after a picker search starts. The dictionaries
// are local build assets, so searching never calls a server or third party.
const keywordToEmoji = keywords as Record<string, string[]>;
const sortedKeywords = Object.entries(keywordToEmoji)
  .map(([keyword, emojis]) => ({ keyword: keyword.toLowerCase(), emojis }))
  .sort((a, b) => a.keyword < b.keyword ? -1 : a.keyword > b.keyword ? 1 : 0);
const canonical = new Map<string, string>();
for (const entry of unicode as Array<string | string[]>) {
  for (const emoji of Array.isArray(entry) ? entry : [entry]) {
    if (emoji) canonical.set(emoji.replaceAll('\uFE0F', ''), emoji);
  }
}

const normalize = (emoji: string) => canonical.get(emoji.replaceAll('\uFE0F', ''));
const pickerPosition = new Map<string, number>();
let position = 0;
for (const emojis of Object.values(categories) as string[][]) {
  for (const emoji of emojis) pickerPosition.set(emoji, position++);
}
const popularRank = new Map<string, number>();
popular.forEach((emoji, index) => {
  const value = normalize(emoji);
  if (value) popularRank.set(value, 50 - index);
});

function lowerBound(prefix: string): number {
  let low = 0;
  let high = sortedKeywords.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (sortedKeywords[mid].keyword < prefix) low = mid + 1;
    else high = mid;
  }
  return low;
}

const clamp = (value: number, low: number, high: number) => Math.min(Math.max(value, low), high);

/** WhatsApp's default English keyword matching and ranking, using a sorted index. */
export function searchEmoji(query: string, recent: string[]): string[] {
  const words = query.toLowerCase().split(' ').filter(Boolean);
  if (!words.length) return [];

  const matchCounts = new Map<string, number>();
  for (const word of words) {
    const wordMatches = new Set<string>();
    // A full-key prefix range gives the same matches as WhatsApp's five-code-
    // unit trie lookup followed by its longer-query startsWith filter.
    for (let index = lowerBound(word); index < sortedKeywords.length; index++) {
      const { keyword, emojis } = sortedKeywords[index];
      if (!keyword.startsWith(word)) break;
      for (const emoji of emojis) {
        const value = normalize(emoji);
        if (value) wordMatches.add(value);
      }
    }
    for (const emoji of wordMatches) matchCounts.set(emoji, (matchCounts.get(emoji) ?? 0) + 1);
  }

  const recentRank = new Map<string, number>();
  recent.forEach((emoji, index) => {
    const value = normalize(emoji);
    if (value) recentRank.set(value, 36 - index);
  });
  const score = (emoji: string, matchedWords: number) =>
    clamp(matchedWords, 0, 99) * 100_000_000 +
    clamp(recentRank.get(emoji) ?? 0, 0, 99) * 1_000_000 +
    clamp(popularRank.get(emoji) ?? 0, 0, 99) * 10_000 +
    clamp(1841 - (pickerPosition.get(emoji) ?? 1841), 1, 9999);

  return [...matchCounts].sort((a, b) => score(b[0], b[1]) - score(a[0], a[1])).map(([emoji]) => emoji);
}
