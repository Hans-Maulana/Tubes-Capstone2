const crypto = require('crypto');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function ensureCsrfToken(req, res, next) {
  if (!req.session) {
    res.locals.csrfToken = '';
    return next();
  }
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  res.locals.csrfToken = req.session.csrfToken;
  next();
}

function csrfProtection(req, res, next) {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  const token = req.body._csrf
    || req.headers['x-csrf-token']
    || req.headers['x-csrf-token'.toLowerCase()];

  if (!req.session || !req.session.csrfToken || !token || token !== req.session.csrfToken) {
    const err = new Error('Token CSRF tidak valid atau kedaluwarsa. Muat ulang halaman dan coba lagi.');
    err.status = 403;
    return next(err);
  }

  return next();
}

module.exports = {
  ensureCsrfToken,
  csrfProtection
};
