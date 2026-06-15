const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const session = require('express-session');
const { sequelize } = require('./models');
const routes = require('./routes/index');
const authRoutes = require('./routes/auth');
const { ensureCsrfToken, csrfProtection } = require('./middlewares/csrf');
const { notificationMiddleware } = require('./middlewares/notificationSync');

dotenv.config();

if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET wajib di-set di environment production.');
}

const { execSync } = require('child_process');
try {
  console.log('[Startup] Menjalankan migrasi database pending...');
  const output = execSync('node database/migrate.js', { encoding: 'utf-8' });
  console.log('[Startup] Hasil migrasi:', output);
} catch (error) {
  console.error('[Startup] Gagal menjalankan migrasi:', error.message);
}

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const SequelizeStore = require('connect-session-sequelize')(session.Store);
const sessionStore = new SequelizeStore({
  db: sequelize,
  tableName: 'sessions'
});
sessionStore.sync();

app.use(session({
  secret: process.env.SESSION_SECRET || 'tubes-capstone-dev-secret-change-me',
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24,
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction
  }
}));

app.use(ensureCsrfToken);

app.use((req, res, next) => {
  res.locals.user = req.session ? req.session.user : null;
  next();
});

app.use(notificationMiddleware);
app.use(csrfProtection);

app.use('/auth', authRoutes);
app.use('/', routes);

app.use((req, res, next) => {
  const err = new Error(`Page Not Found: ${req.originalUrl}`);
  err.status = 404;
  next(err);
});

app.use((err, req, res, next) => {
  console.error('[Global Error Handler] Error captured:', err.message);

  if (req.get('X-Requested-With') === 'XMLHttpRequest') {
    return res.status(err.status || 500).json({
      ok: false,
      error: err.message || 'Terjadi kesalahan pada server.'
    });
  }

  if (err.status === 403 || err.status === 401) {
    return res.status(err.status).render('auth/unauthorized', {
      title: `${err.status} Access Denied - Tubes Capstone II`,
      message: err.message
    });
  }

  res.status(err.status || 500).render('index', {
    title: `Error ${err.status || 500} - Tubes Capstone II`,
    dbStatus: {
      connected: false,
      message: `System Error: ${err.message}`,
      error: isProduction ? null : err.stack
    },
    projectStructure: []
  });
});

async function bootServer() {
  try {
    console.log('🔄 Checking database connection using Sequelize...');
    await sequelize.authenticate();
    console.log('✅ Database connection successfully established!');
  } catch (error) {
    console.error('❌ Database connection failed on startup:');
    console.error(`   -> ${error.message}`);
    console.log('⚠️ Notice: Starting Express server without active database connection. Verify MySQL state or config inside .env');
  }

  app.listen(PORT, () => {
    console.log('================================================================');
    console.log(`Server berjalan di : http://localhost:${PORT}`);
    console.log('================================================================');
  });
}

bootServer();
