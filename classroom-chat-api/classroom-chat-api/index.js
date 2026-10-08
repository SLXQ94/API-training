// ============================================================================
// LECTURE 1: Classroom Chat API
//
//   npm install
//   npm run seed      (optional: 3 demo users + a few messages)
//   node index.js
//
// Uncomment things STEP by STEP (in your editor: select lines, Ctrl+/ or Cmd+/).
// After each change, restart the server (or use `npm run dev`, which restarts for you).
//
//   STEP 1   /health                       the smallest possible API
//   STEP 2   routes/users.js               register / list / lookup users (roll no = id)
//   STEP 3   routes/messages.js            send / read messages
//   STEP 4   routes/messages.js            edit / delete messages
//            --- now show the problems: anyone can pretend to be anyone ---
//   STEP 5   logger middleware             see every request in the terminal
//   STEP 6   auth middleware               password protection
//   STEP 7   rate limit (per IP)           stop floods and password guessing
//   STEP 8   rate limit (per user, sending)  stop spam
// ============================================================================
const os = require('os');
const express = require('express');

const { sendError } = require('./lib/errors');
const usersRouter = require('./routes/users');
const messagesRouter = require('./routes/messages');
const logger = require('./middleware/logger');
const requireAuth = require('./middleware/auth');
const rateLimit = require('./middleware/rateLimit');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================================
// MIDDLEWARE SLOTS
// ORDER MATTERS: Express runs these top to bottom, and they must come BEFORE the
// routes they are meant to protect. A middleware placed after a route never sees
// that route's requests.
// ============================================================================

// STEP 5: logger
// app.use(logger);

// STEP 7: global rate limit, 10 requests / 10 seconds per IP.
// It sits BEFORE auth on purpose: wrong-password attempts get counted too (brute-force protection).
// app.use(rateLimit({ windowMs: 10_000, max: 10 }));

// STEP 6: password protection.
// We protect specific paths. POST /users stays open, otherwise nobody could ever register.
// app.use('/messages', requireAuth);
// app.get('/users', requireAuth);
// app.get('/users/:rollNo', requireAuth);
// app.get('/me', requireAuth, (req, res) => res.json(req.user));

// STEP 8: stricter limit on SENDING, 3 messages / 10 seconds.
// It sits AFTER auth on purpose: now req.user exists, so the limit is per person, not per IP.
// app.post('/messages', rateLimit({ windowMs: 10_000, max: 3 }));

// ============================================================================
// ROUTES
// ============================================================================

// Always on: turns a JSON request body into req.body (this is itself a middleware!)
// It sits below the slots above, so unauthorized or rate-limited requests are rejected before we parse their body.
app.use(express.json());

// STEP 1: is the server alive?
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// STEP 2-4: the endpoints themselves live in these files (uncomment inside them)
app.use('/users', usersRouter);
app.use('/messages', messagesRouter);

// ============================================================================
// FALLBACKS (always on)
// ============================================================================

// nothing above matched
app.use((req, res) => {
  sendError(res, 404, 'NOT_FOUND', `No route for ${req.method} ${req.originalUrl}`);
});

// something threw (e.g. the client sent broken JSON)
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return sendError(res, 400, 'INVALID_JSON', 'Request body is not valid JSON');
  }
  console.error(err);
  sendError(res, 500, 'INTERNAL', 'Something went wrong on the server');
});

// ============================================================================
// START
// 0.0.0.0 = listen on every network interface, so classmates on the same wifi can reach you
// ============================================================================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\nClassroom Chat API running`);
  console.log(`  you:        http://localhost:${PORT}`);
  for (const addresses of Object.values(os.networkInterfaces())) {
    for (const a of addresses || []) {
      if (a.family === 'IPv4' && !a.internal) {
        console.log(`  classmates: http://${a.address}:${PORT}`);
      }
    }
  }
  console.log('');
});
