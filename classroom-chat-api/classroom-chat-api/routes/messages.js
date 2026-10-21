// ============================================================================
// MESSAGES API   (mounted at /messages in index.js)
//
// A message:  { id, from, to, text, createdAt, editedAt? }
//   to = a roll number  -> direct message
//   to = "class"        -> visible to everyone (the class group chat)
//
// WHO AM I?  resolveMe() answers that question. Right now (no auth) we simply
// BELIEVE the client:  ?user=CS101  or  body.from = "CS101".
// Anybody can claim to be anybody. Once the auth middleware is switched on
// (STEP 6) req.user is set by the server and the client's claim is ignored.
// ============================================================================
const express = require('express');
const { readDB, writeDB } = require('../lib/store');
const { sendError } = require('../lib/errors');

const router = express.Router();

const CLASS_ROOM = 'class';
const MAX_TEXT = 500;

function normalizeTarget(value) {
  const v = String(value).trim();
  return v.toLowerCase() === CLASS_ROOM ? CLASS_ROOM : v.toUpperCase();
}

function resolveMe(req, db) {
  const raw = req.user
    ? req.user.rollNo // set by the auth middleware: trustworthy
    : req.query.user || (req.body && (req.body.from || req.body.user)); // client's word: NOT trustworthy
  if (!raw) return null;
  const id = String(raw).trim().toUpperCase();
  return db.users.some((u) => u.rollNo === id) ? id : null;
}

function whoAreYou(res) {
  return sendError(
    res,
    400,
    'WHO_ARE_YOU',
    'Say who you are: add ?user=<rollNo> to the URL, or "from" in the JSON body (registered users only)'
  );
}

function parseId(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    sendError(res, 400, 'INVALID_ID', 'message id must be a positive integer');
    return null;
  }
  return id;
}

const canSee = (m, me) => m.to === CLASS_ROOM || m.from === me || m.to === me;

// POST /messages   body: { to, text, from? }
function sendMessage(req, res) {
  const db = readDB();
  const me = resolveMe(req, db);
  if (!me) return whoAreYou(res);

  const { to, text } = req.body || {};
  if (typeof to !== 'string' || !to.trim()) {
    return sendError(res, 400, 'INVALID_TO', '"to" must be a roll number or "class"');
  }
  if (typeof text !== 'string' || !text.trim()) {
    return sendError(res, 400, 'INVALID_TEXT', '"text" is required');
  }
  if (text.length > MAX_TEXT) {
    return sendError(res, 400, 'TEXT_TOO_LONG', `text can be at most ${MAX_TEXT} characters`);
  }

  const target = normalizeTarget(to);
  if (target !== CLASS_ROOM && !db.users.some((u) => u.rollNo === target)) {
    return sendError(res, 404, 'RECIPIENT_NOT_FOUND', `No user with roll number ${target}`);
  }
  if (target === me) {
    return sendError(res, 400, 'CANNOT_MESSAGE_SELF', 'You cannot send a message to yourself');
  }

  const msg = {
    id: db.nextMessageId++,
    from: me,
    to: target,
    text: text.trim(),
    createdAt: new Date().toISOString(),
  };
  db.messages.push(msg);
  writeDB(db);

  res.status(201).location(`/messages/${msg.id}`).json(msg);
}

// GET /messages?user=CS101
//   &with=CS102   only the conversation between me and CS102  (with=class -> group chat)
//   &after=12     only messages with id > 12   (this is "polling": "what's new since 12?")
//   &limit=20     at most 20 messages, the most recent ones (default 50, max 100)
function listMessages(req, res) {
  const db = readDB();
  const me = resolveMe(req, db);
  if (!me) return whoAreYou(res);

  // everything I'm allowed to see: group chat + messages I sent or received
  let list = db.messages.filter((m) => canSee(m, me));

  if (req.query.with) {
    const other = normalizeTarget(req.query.with);
    list =
      other === CLASS_ROOM
        ? list.filter((m) => m.to === CLASS_ROOM)
        : list.filter((m) => (m.from === me && m.to === other) || (m.from === other && m.to === me));
  }

  if (req.query.after !== undefined) {
    const after = Number(req.query.after);
    if (!Number.isInteger(after) || after < 0) {
      return sendError(res, 400, 'INVALID_AFTER', '"after" must be a non-negative integer');
    }
    list = list.filter((m) => m.id > after);
  }

  const limit = req.query.limit === undefined ? 50 : Number(req.query.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return sendError(res, 400, 'INVALID_LIMIT', '"limit" must be an integer between 1 and 100');
  }

  const total = list.length;
  list = list.slice(-limit);
  res.json({ count: list.length, total, messages: list });
}

// GET /messages/:id
function getMessage(req, res) {
  const id = parseId(req, res);
  if (id === null) return;

  const db = readDB();
  const me = resolveMe(req, db);
  if (!me) return whoAreYou(res);

  const msg = db.messages.find((m) => m.id === id);
  if (!msg) return sendError(res, 404, 'MESSAGE_NOT_FOUND', `No message with id ${id}`);
  if (!canSee(msg, me)) return sendError(res, 403, 'FORBIDDEN', 'This message is not yours to read');

  res.json(msg);
}

// PATCH /messages/:id   body: { text, from? }     (only the sender may edit)
function editMessage(req, res) {
  const id = parseId(req, res);
  if (id === null) return;

  const db = readDB();
  const me = resolveMe(req, db);
  if (!me) return whoAreYou(res);

  const { text } = req.body || {};
  if (typeof text !== 'string' || !text.trim() || text.length > MAX_TEXT) {
    return sendError(res, 400, 'INVALID_TEXT', `"text" is required (max ${MAX_TEXT} characters)`);
  }

  const msg = db.messages.find((m) => m.id === id);
  if (!msg) return sendError(res, 404, 'MESSAGE_NOT_FOUND', `No message with id ${id}`);
  if (msg.from !== me) return sendError(res, 403, 'FORBIDDEN', 'You can only edit your own messages');

  msg.text = text.trim();
  msg.editedAt = new Date().toISOString();
  writeDB(db);

  res.json(msg);
}

// DELETE /messages/:id?user=CS101     (only the sender may delete)
function deleteMessage(req, res) {
  const id = parseId(req, res);
  if (id === null) return;

  const db = readDB();
  const me = resolveMe(req, db);
  if (!me) return whoAreYou(res);

  const index = db.messages.findIndex((m) => m.id === id);
  if (index === -1) return sendError(res, 404, 'MESSAGE_NOT_FOUND', `No message with id ${id}`);
  if (db.messages[index].from !== me) {
    return sendError(res, 403, 'FORBIDDEN', 'You can only delete your own messages');
  }

  db.messages.splice(index, 1);
  writeDB(db);

  res.status(204).end(); // 204 = success, nothing to send back
}

// ----------------------------------------------------------------------------
// ROUTE TABLE  -  uncomment one line at a time during the lecture
// ----------------------------------------------------------------------------
// STEP 3a: send a message
router.post('/', sendMessage);
// STEP 3b: read messages (filters: with, after, limit)
router.get('/', listMessages);
// STEP 3c: read one message
router.get('/:id', getMessage);
// STEP 4a: edit my message
router.patch('/:id', editMessage);
// STEP 4b: delete my message
router.delete('/:id', deleteMessage);

module.exports = router;