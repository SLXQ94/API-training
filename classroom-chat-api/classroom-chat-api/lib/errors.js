// One error shape for the whole API, so clients can always handle failures the same way:
// { "error": { "code": "SOME_CODE", "message": "human readable text" } }
function sendError(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

module.exports = { sendError };
