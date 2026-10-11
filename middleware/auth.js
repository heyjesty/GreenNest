const db = require('../config/db');

/** Loads the signed-in user (if any) onto req.user / res.locals.user. */
async function loadUser(req, res, next) {
  res.locals.user = null;
  if (!req.session.userId) return next();
  try {
    const user = await db.one('SELECT id, name, email, phone, role, created_at FROM users WHERE id = ?', [req.session.userId]);
    if (!user) delete req.session.userId;
    req.user = user;
    res.locals.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

function requireLogin(req, res, next) {
  if (req.user) return next();
  req.session.returnTo = req.originalUrl;
  req.session.flash = { type: 'info', message: 'Please sign in to continue.' };
  res.redirect('/login');
}

function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') return next();
  if (!req.user) {
    req.session.returnTo = req.originalUrl;
    return res.redirect('/login');
  }
  const err = new Error('You do not have permission to view this page.');
  err.status = 403;
  next(err);
}

module.exports = { loadUser, requireLogin, requireAdmin };
