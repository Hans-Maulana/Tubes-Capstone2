const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const session = require('express-session');
const { sequelize } = require('./models');
const routes = require('./routes/index');
const authRoutes = require('./routes/auth');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Config View Engine (Pug)
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

// Request Parsing & Static Assets Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Configure Session Middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'tubes-capstone-secret-key-12345',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 // 1 day
  }
}));

// Expose session user globally to all Pug templates
app.use((req, res, next) => {
  res.locals.user = req.session ? req.session.user : null;
  next();
});

// Router binding
app.use('/auth', authRoutes);
app.use('/', routes);

// 404 Route Handler
app.use((req, res, next) => {
  const err = new Error(`Page Not Found: ${req.originalUrl}`);
  err.status = 404;
  next(err);
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Global Error Handler] Error captured:', err.message);
  
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
      error: err.stack
    },
    projectStructure: []
  });
});

// Check Database Connection & Boot Web Server
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
    console.log(`🚀 Express Application Online: http://localhost:${PORT}`);
    console.log(`🌐 Server running in [${process.env.NODE_ENV || 'development'}] mode`);
    console.log('================================================================');
  });
}

bootServer();
