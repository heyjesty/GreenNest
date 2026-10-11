require('dotenv').config({ quiet: true });

const path = require('path');
const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const helmet = require('helmet');
const compression = require('compression');

const { dbConfig, pool } = require('./config/db');
const helpers = require('./lib/helpers');
const { loadUser } = require('./middleware/auth');
const { csrf } = require('./middleware/csrf');
const { cartCount } = require('./lib/cart');

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const isProd = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
if (isProd) app.set('trust proxy', 1);

// ---------- Security & performance ----------
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:'],
      scriptSrc: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: isProd ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use(compression());
app.use(express.static(path.join(__dirname, 'public'), { maxAge: isProd ? '7d' : 0 }));
app.use(express.urlencoded({ extended: true, limit: '200kb' }));
app.use(express.json({ limit: '200kb' }));

// ---------- Sessions (stored in MySQL) ----------
const sessionStore = new MySQLStore({
  ...dbConfig,
  createDatabaseTable: true,
  clearExpired: true,
});

app.use(session({
  name: 'greennest.sid',
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: isProd, maxAge: 1000 * 60 * 60 * 24 * 14 },
}));

// ---------- Shared template data ----------
app.use(loadUser);
app.use(csrf);
app.use((req, res, next) => {
  res.locals.h = helpers;
  res.locals.path = req.path;
  res.locals.query = req.query;
  res.locals.cartCount = cartCount(req.session);
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  res.locals.title = 'GreenNest';
  res.locals.metaDescription = 'Discover beautiful indoor plants for every corner of your home. Handpicked plants, expert support, secure packing and easy returns.';
  next();
});

// ---------- Routes ----------
app.use('/media', require('./routes/media'));
app.use('/', require('./routes/site'));
app.use('/shop', require('./routes/shop'));
app.use('/cart', require('./routes/cart'));
app.use('/blog', require('./routes/blog'));
app.use('/', require('./routes/auth'));
app.use('/account', require('./routes/account'));
app.use('/admin', require('./routes/admin'));

// ---------- Errors ----------
app.use((req, res) => {
  res.status(404).render('errors/404', { title: 'Page not found · GreenNest' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  // The error may have happened before the shared locals were set.
  res.locals = {
    h: helpers, path: req.path, query: req.query, user: null, cartCount: 0, flash: null, csrfToken: '',
    metaDescription: '', ...res.locals,
  };
  if (req.accepts(['html', 'json']) === 'json') return res.status(status).json({ ok: false, message: 'Something went wrong.' });
  res.status(status).render('errors/500', { title: 'Something went wrong · GreenNest', status, message: status === 403 ? err.message : null });
});

// Run as a normal server locally (`npm start`); on Vercel the app is exported instead.
if (require.main === module) {
  pool.query('SELECT 1')
    .then(() => {
      app.listen(PORT, () => console.log(`GreenNest running → http://localhost:${PORT}`));
    })
    .catch((err) => {
      console.error('Could not connect to MySQL:', err.message);
      console.error('Check the DB_* settings in .env, then run `npm run db:setup`.');
      process.exit(1);
    });
}

module.exports = app;
