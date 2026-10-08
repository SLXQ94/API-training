// Password protection using HTTP Basic auth.
//
// The client sends a header:   Authorization: Basic base64("CS101:mypassword")
// (curl does this for you with:  curl -u CS101:mypassword ...)
//
// If the credentials are right  -> we set req.user and call next()
// If not                        -> we answer 401 right here; the route handler never runs
//
// NOTE for class: base64 is an ENCODING, not encryption. Over plain http anyone on
// the wifi can read it. That's why real services use https (we get it free on Render).
const { readDB } = require('../lib/store');
const { verifyPassword } = require('../lib/password');
const { sendError } = require('../lib/errors');

function unauthorized(res, message) {
  res.set('WWW-Authenticate', 'Basic realm="classroom-chat"'); // makes browsers show a login popup
  return sendError(res, 401, 'UNAUTHORIZED', message);
}

module.exports = function requireAuth(req, res, next) {
  const [scheme, encoded] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Basic' || !encoded) {
    return unauthorized(res, 'Credentials required: use HTTP Basic auth with rollNo:password');
  }

  const decoded = Buffer.from(encoded, 'base64').toString('utf8');
  const colon = decoded.indexOf(':');
  if (colon === -1) return unauthorized(res, 'Malformed credentials');

  const rollNo = decoded.slice(0, colon).trim().toUpperCase();
  const password = decoded.slice(colon + 1);

  const user = readDB().users.find((u) => u.rollNo === rollNo);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    // same message for "no such user" and "wrong password" on purpose: don't reveal which roll numbers exist
    return unauthorized(res, 'Wrong roll number or password');
  }

  req.user = { rollNo: user.rollNo, name: user.name };
  next();
};
