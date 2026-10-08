// ============================================================================
// USERS API   (mounted at /users in index.js)
// The roll number IS the user id.
//
// Handlers are written below. An endpoint goes live when you uncomment its
// line in the "ROUTE TABLE" at the bottom of this file.
// ============================================================================
const express = require('express');
const { readDB, writeDB } = require('../lib/store');
const { hashPassword } = require('../lib/password');
const { sendError } = require('../lib/errors');

const router = express.Router();

const ROLL_RE = /^[A-Za-z0-9_-]{3,20}$/;

// never send the password hash back to anyone
const publicUser = ({ passwordHash, ...rest }) => rest;

// POST /users   body: { rollNo, name, password }
function registerUser(req, res) {
  const { rollNo, name, password } = req.body || {};

  if (typeof rollNo !== 'string' || !ROLL_RE.test(rollNo.trim())) {
    return sendError(res, 400, 'INVALID_ROLL_NO', 'rollNo must be 3-20 characters: letters, digits, - or _');
  }
  if (typeof name !== 'string' || !name.trim()) {
    return sendError(res, 400, 'INVALID_NAME', 'name is required');
  }
  if (typeof password !== 'string' || password.length < 4) {
    return sendError(res, 400, 'INVALID_PASSWORD', 'password must be at least 4 characters');
  }

  const id = rollNo.trim().toUpperCase();
  const db = readDB();

  if (db.users.some((u) => u.rollNo === id)) {
    return sendError(res, 409, 'ROLL_NO_TAKEN', `${id} is already registered`);
  }

  const user = {
    rollNo: id,
    name: name.trim(),
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
  };
  db.users.push(user);
  writeDB(db);

  res.status(201).location(`/users/${id}`).json(publicUser(user));
}

// GET /users
function listUsers(req, res) {
  const db = readDB();
  res.json({ count: db.users.length, users: db.users.map(publicUser) });
}

// GET /users/:rollNo
function getUser(req, res) {
  const id = req.params.rollNo.trim().toUpperCase();
  const user = readDB().users.find((u) => u.rollNo === id);
  if (!user) return sendError(res, 404, 'USER_NOT_FOUND', `No user with roll number ${id}`);
  res.json(publicUser(user));
}

// ----------------------------------------------------------------------------
// ROUTE TABLE  -  uncomment one line at a time during the lecture
// ----------------------------------------------------------------------------
// STEP 2a: register
router.post('/', registerUser);
// STEP 2b: list everybody
router.get('/', listUsers);
// STEP 2c: look up one person
router.get('/:rollNo', getUser);

module.exports = router;
