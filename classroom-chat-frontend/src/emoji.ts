import categoryData from './emoji-data/categories-wa.json';

export interface EmojiCategory {
  id: string;
  label: string;
  icon: string;
  emojis: string[];
}

const CATEGORY_INFO: Record<string, { label: string; icon: string }> = {
  SMILEYS_PEOPLE: { label: 'Smileys & people', icon: '😀' },
  ANIMALS_NATURE: { label: 'Animals & nature', icon: '🐶' },
  FOOD_DRINK: { label: 'Food & drink', icon: '🍔' },
  ACTIVITY: { label: 'Activity', icon: '⚽' },
  TRAVEL_PLACES: { label: 'Travel & places', icon: '🚗' },
  OBJECTS: { label: 'Objects', icon: '💡' },
  SYMBOLS: { label: 'Symbols', icon: '❤️' },
  FLAGS: { label: 'Flags', icon: '🏳️' },
};

// The full picker order comes from the saved WhatsApp Business Web bundle.
export const EMOJI_CATEGORIES: EmojiCategory[] = Object.entries(categoryData).map(([id, emojis]) => ({
  id,
  label: CATEGORY_INFO[id]?.label ?? id,
  icon: CATEGORY_INFO[id]?.icon ?? '😀',
  emojis,
}));

const RECENT_KEY = 'cc.recentEmoji';
export function loadRecentEmoji(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(value) ? value.filter((emoji): emoji is string => typeof emoji === 'string').slice(0, 24) : [];
  } catch {
    return [];
  }
}

export function pushRecentEmoji(emoji: string): string[] {
  const next = [emoji, ...loadRecentEmoji().filter((item) => item !== emoji)].slice(0, 24);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Recent emoji are optional when storage is unavailable.
  }
  return next;
}
