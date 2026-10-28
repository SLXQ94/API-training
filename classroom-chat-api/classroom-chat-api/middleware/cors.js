// CORS: lets a web page served from ANOTHER address (another "origin") call this API.
//
// Browsers block that by default. Before a page may send a request with an Authorization header,
// the browser first sends a "preflight": OPTIONS /messages, asking "am I allowed?".
// We answer it right here (204) so it never reaches the rate limiter or the password check
// (a preflight carries no password, so auth would answer 401 and the real request would never be sent).
//
// "*" = any website may call us. Fine for a class demo. For a real app, put your UI's address here.
module.exports = function cors(allowedOrigin = '*') {
  return function corsMiddleware(req, res, next) {
    res.set({
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      // by default JavaScript may NOT read these response headers cross-origin; the UI needs Retry-After
      'Access-Control-Expose-Headers': 'Retry-After, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Location',
      'Access-Control-Max-Age': '600', // the browser may remember this answer for 10 minutes
    });
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  };
};
