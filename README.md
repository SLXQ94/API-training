# Classroom Chat API (Lecture 1)

A chat backend built API by API. Roll number = user id. Data lives in `data/db.json`.

## Run

```bash
npm install
npm run seed     # optional: demo users CS101/pass101, CS102/pass102, CS103/pass103 + 3 messages
node index.js    # or: npm run dev  (auto-restarts when you save a file)
```

The terminal prints a `http://<your-ip>:3000` address. Classmates on the same wifi use that
address instead of `localhost` (allow Node through your firewall if they can't connect).
`npm run reset` wipes all data.

## The lecture is a sequence of uncomments

| Step | File | Uncomment | Concept |
|---|---|---|---|
| 1 | `index.js` | `GET /health` | smallest API, request/response, JSON |
| 2a-c | `routes/users.js` | register, list, lookup | resources, POST vs GET, 201/400/404/409, path params |
| 3a-c | `routes/messages.js` | send, list (filters), get one | query params (`with`, `after`, `limit`), `after` = polling preview |
| 4a-b | `routes/messages.js` | edit, delete | PATCH vs PUT, DELETE, 204, 403 |
| | | **pause: break it** | anyone can send as anyone, read anyone's inbox (see `commands.md`) |
| 5 | `index.js` | logger | what a middleware is: `(req, res, next)` |
| 6 | `index.js` | password protection | 401, `Authorization` header, `req.user`; the spoofing now fails |
| 7 | `index.js` | global rate limit (per IP) | 429, `Retry-After`, brute-force protection |
| 8 | `index.js` | send limit (per user) | order of middleware decides what the limiter can see |

## Things worth saying out loud

- **Middleware order is behavior.** Rate limit is above auth so wrong-password guesses are counted;
  the send limit is below auth so it is per person. Move them and the behavior changes.
- **`resolveMe()` in `routes/messages.js`** is the whole auth story: before step 6 it believes the client,
  after step 6 it uses `req.user`. The route handlers did not change at all.
- **`lib/store.js` is safe only because it is synchronous and single-process.** Two server processes, or a
  huge file, break it. That is the pain that motivates the database lecture.
- **Registration is still open**: anyone can register an unused roll number first. Real fix: teacher-created
  accounts or invite codes. Good "what would you do?" question.
- **Basic auth over http is readable on the wifi** (base64 is not encryption). Render gives https for free.
- **Rate limit counters are in memory**: restart resets them, two servers don't share them.
- Not in this lecture, on purpose (next ones): CORS and a UI, tokens instead of sending the password
  every time, real-time delivery instead of polling, persistence on Render.
