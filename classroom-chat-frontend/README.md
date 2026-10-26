# Classroom Chat: web frontend

A WhatsApp-style chat UI for the Classroom Chat API. React 19 + Vite + TypeScript, installable as a PWA.
It is a separate app from the API: it is a static site you host anywhere (Netlify, Vercel, Render static, GitHub Pages...).

## Run

```bash
npm install
npm run dev        # http://localhost:5173  (API expected at http://localhost:3000, see .env.development)
```

Start the API in another terminal first (`node index.js` in `classroom-chat-api/classroom-chat-api`).

## Build and deploy

```bash
# point the build at your API (no trailing slash)
echo "VITE_API_URL=https://your-api.onrender.com" > .env.production
npm run build      # output in dist/
```

Upload `dist/` to any static host. Routing uses the URL hash (`#/chat/CS101`), so no rewrite rules are needed.

On the API side, set `CORS_ORIGIN` to your frontend's URL (for example `https://my-chat.netlify.app`).
If it is unset the API answers any origin.

## What it does

- Log in / create account (roll number + password), session kept on the device
- Chat list with unread badges, search (chats, people, message text), All / Unread / Groups filters, drafts
- Class group chat and one-to-one chats, new-chat picker
- Send, edit, delete (own messages), copy; failed sends can be retried; 429s are waited out automatically
- Date separators, "N unread messages" divider, jump-to-latest button, in-chat message search, emoji picker with local name search
- Light and dark theme (follows the system, switch in the menu)
- Phones: single-pane navigation with the Android back button, press and hold a bubble for the message menu

## Limits that come from the API

- Messages arrive by polling (every 3 s while the tab is visible, every 15 s when hidden); there is no push.
- Only the newest 100 messages per conversation can be loaded.
- No read receipts, typing indicator, avatars or "last seen": the API has no data for them. A single tick means "the server has it".
- The password is stored on the device (the API uses HTTP Basic auth); use https in production.

## Layout

```
src/store.ts        state, polling loop, send/edit/delete actions
src/api.ts          fetch wrapper for the endpoints
src/router.ts       hash router (back button support)
src/chats.ts        chat list / conversation derived from the store
src/components/     Sidebar, ChatView, Composer, MessageRow, ...
src/styles/         index.css (design tokens, light + dark), app.css (layout and components)
```

The emoji picker uses the full WhatsApp Business Web category and English keyword tables stored in `src/emoji-data/`. Its search module loads when first used, and the picker renders only visible emoji rows. Picker, message, and composer emoji use the same 64 px WhatsApp Web sprite sheets bundled in `public/emoji/wa/64/`; unsupported emoji fall back to the device font. The composer keeps its native textarea for editing and places a synchronized sprite display behind its transparent text, preserving the caret and input behavior. On the first visit to a production build, the service worker downloads all 152 sheets (4.46 MB) in the background and stores them with the app's other assets. There is no time-based cache expiration; changed files are refreshed when a new service worker installs. Browser storage eviction or cleared site data can still remove the cache. The source sheets can be refreshed with `python scripts/download-whatsapp-emoji.py --refresh` when updating the Unicode table.
