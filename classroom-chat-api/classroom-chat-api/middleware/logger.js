// The gentlest possible middleware: it changes nothing, it just watches.
// A middleware is a function (req, res, next). It can look at the request,
// change it, answer it directly (and stop the chain), or call next() to pass it on.
module.exports = function logger(req, res, next) {
  const start = process.hrtime.bigint();

  // 'finish' fires after the response has been sent, so we know the status code and duration
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    const who = req.user ? ` user=${req.user.rollNo}` : '';
    console.log(
      `${new Date().toISOString()}  ${req.method} ${req.originalUrl}  ->  ${res.statusCode}  (${ms.toFixed(1)} ms)${who}`
    );
  });

  next();
};
