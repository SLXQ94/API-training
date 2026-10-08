// Rate limiting: "at most N requests per time window, per client".
//
// Algorithm: FIXED WINDOW COUNTER (the simplest one).
//   - key = who is asking (logged-in user if we know them, otherwise IP address)
//   - each key gets a counter that resets when its window expires
//   - counter > max  ->  answer 429 Too Many Requests, plus a Retry-After header
//
// Limits of this version (good discussion material):
//   - counters live in memory: restart the server and they reset; run 2 servers and each has its own count
//   - a burst at the boundary of two windows can sneak through 2x max
//   Alternatives: sliding window, token bucket, or a shared store like Redis.
const { sendError } = require('../lib/errors');

module.exports = function rateLimit({ windowMs = 10_000, max = 10 } = {}) {
  const hits = new Map(); // key -> { count, resetAt }

  // housekeeping so the Map doesn't grow forever
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) if (entry.resetAt <= now) hits.delete(key);
  }, windowMs).unref();

  return function rateLimiter(req, res, next) {
    const key = req.user ? `user:${req.user.rollNo}` : `ip:${req.ip}`;
    const now = Date.now();

    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;

    // tell well-behaved clients where they stand
    res.set({
      'X-RateLimit-Limit': String(max),
      'X-RateLimit-Remaining': String(Math.max(0, max - entry.count)),
      'X-RateLimit-Reset': String(Math.ceil(entry.resetAt / 1000)),
    });

    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      return sendError(res, 429, 'RATE_LIMITED', `Too many requests. Try again in ${retryAfter}s`);
    }

    next();
  };
};
