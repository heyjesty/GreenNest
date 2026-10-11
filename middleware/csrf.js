const crypto = require('crypto');

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Session-based CSRF protection.
 * Forms send `_csrf` in the body; fetch() sends the `x-csrf-token` header;
 * multipart (file upload) forms put it in the query string because the body
 * is only parsed later by multer.
 */
function csrf(req, res, next) {
  if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(24).toString('hex');
  res.locals.csrfToken = req.session.csrfToken;

  if (SAFE.has(req.method)) return next();

  const sent = (req.body && req.body._csrf) || req.get('x-csrf-token') || req.query._csrf;
  const expected = req.session.csrfToken;
  const ok = typeof sent === 'string' && sent.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(sent), Buffer.from(expected));

  if (ok) return next();
  const err = new Error('Your session expired. Please go back, refresh the page and try again.');
  err.status = 403;
  next(err);
}

module.exports = { csrf };
