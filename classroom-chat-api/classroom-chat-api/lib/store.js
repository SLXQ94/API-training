// The "database": one JSON file on disk (data/db.json).
//
// Shape:
// { "users": [...], "messages": [...], "nextMessageId": 1 }
//
// Reads and writes are SYNCHRONOUS on purpose. Node runs our handlers one at a
// time, so "read -> change -> write" can never be interleaved by another request
// inside this one process. Remember this: it is exactly the guarantee we lose when
// we run two server processes, or when the file gets big. That's the pain that
// motivates a real database later.
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'dbcs1.json');
const EMPTY = { users: [], messages: [], nextMessageId: 1 };

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify(EMPTY, null, 2));
}

function readDB() {
  ensureFile();
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function writeDB(db) {
  ensureFile();
  // write to a temp file, then rename: a crash mid-write can't leave a half-written db.json
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

module.exports = { readDB, writeDB, DB_FILE, EMPTY };
