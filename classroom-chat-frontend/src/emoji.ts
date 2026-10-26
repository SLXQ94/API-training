export interface EmojiCategory {
  id: string;
  label: string;
  icon: string;
  emojis: string[];
}

const split = (s: string) => s.trim().split(/\s+/);

export const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: 'smileys',
    label: 'Smileys & people',
    icon: '😀',
    emojis: split(`😀 😃 😄 😁 😆 😅 😂 🤣 🥲 ☺️ 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😛 😝 😜 🤪 🤨 🧐 🤓 😎
      🥸 🤩 🥳 😏 😒 😞 😔 😟 😕 🙁 ☹️ 😣 😖 😫 😩 🥺 😢 😭 😤 😠 😡 🤬 🤯 😳 🥵 🥶 😱 😨 😰 😥 😓 🤗 🤔
      🫡 🤭 🤫 🤥 😶 😐 😑 😬 🙄 😯 😦 😧 😮 😲 🥱 😴 🤤 😪 😵 🤐 🥴 🤢 🤮 🤧 😷 🤒 🤕 🤑 🤠 😈 👿 👻 💀 🤖 🎃`),
  },
  {
    id: 'gestures',
    label: 'Gestures',
    icon: '👍',
    emojis: split(`👍 👎 👌 🤌 🤏 ✌️ 🤞 🫰 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ ✋ 🤚 🖐️ 🖖 👋 🤝 🙏 ✍️ 💅 🤳 💪 🦾 🙌 👏
      🫶 👐 🤲 🫱 🫲 🙋 🙋‍♂️ 🙋‍♀️ 🤦 🤦‍♂️ 🤦‍♀️ 🤷 🤷‍♂️ 🤷‍♀️ 🙇 💁 🙆 🙅 🧑‍💻 🧑‍🎓 🧑‍🏫 👨‍🎓 👩‍🎓 👨‍🏫 👩‍🏫`),
  },
  {
    id: 'hearts',
    label: 'Hearts & symbols',
    icon: '❤️',
    emojis: split(`❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 ☮️ ✨ 🌟 ⭐ 💫 ⚡ 🔥 💥 💯 ✅ ❌ ❓ ❗ ‼️
      ⚠️ 🚫 ➕ ➖ ✔️ ☑️ 🔔 🔕 💬 💭 🗯️ ♻️ 🔴 🟠 🟡 🟢 🔵 🟣 ⚫ ⚪`),
  },
  {
    id: 'fun',
    label: 'Activities & objects',
    icon: '🎉',
    emojis: split(`🎉 🎊 🎈 🎁 🏆 🥇 🥈 🥉 🎯 🎮 🎲 🎵 🎶 🎤 🎧 🎸 🎹 🎬 📚 📖 📝 ✏️ 📎 📌 📅 ⏰ ⌛ 💡 🔍 🔒 🔑
      💻 🖥️ ⌨️ 🖱️ 📱 📷 🔋 🔌 💾 📡 🧪 🔬 📐 📏 🧮 🎒 ☕ 🍕 🍔 🍟 🌮 🍜 🍰 🍩 🍫 🍿 🥤 🍎 🍌 🍉`),
  },
  {
    id: 'nature',
    label: 'Animals & nature',
    icon: '🐶',
    emojis: split(`🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🙈 🙉 🙊 🐔 🐧 🐦 🦆 🦉 🦄 🐝 🦋 🐢 🐍 🐙 🐬 🐳
      🌸 🌹 🌻 🌼 🌷 🌱 🌳 🍀 🍁 🌈 ☀️ 🌤️ ⛅ ☁️ 🌧️ ⛈️ ❄️ 🌙 🌍 🌊 🔥`),
  },
  {
    id: 'travel',
    label: 'Travel & places',
    icon: '🚀',
    emojis: split(`🚗 🚕 🚌 🚎 🏎️ 🚓 🚑 🚒 🚲 🛵 🏍️ 🚆 🚇 ✈️ 🛫 🛬 🚀 🛸 ⛵ 🚢 🏠 🏫 🏢 🏥 🏦 🏨 🏖️ 🏔️ 🗺️ 🧭 ⛽ 🚦
      🚧 🎡 🎢 🗽 🗼 🏰 ⛺ 🌆 🌃`),
  },
];

const RECENT_KEY = 'cc.recentEmoji';
export function loadRecentEmoji(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
  } catch {
    return [];
  }
}
export function pushRecentEmoji(e: string): string[] {
  const next = [e, ...loadRecentEmoji().filter((x) => x !== e)].slice(0, 24);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}
