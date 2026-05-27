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
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const SequelizeStore = require('connect-session-sequelize')(session.Store);

const sessionStore = new SequelizeStore({
  db: sequelize,
  tableName: 'sessions'
});

// Sync session store table
sessionStore.sync();

// Configure Session Middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'tubes-capstone-secret-key-12345',
  store: sessionStore,
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

app.get('/debug-db-status', async (req, res) => {
  try {
    const models = require('./models');
    let data = {
      config: {
        DB_NAME: process.env.DB_NAME,
        DB_HOST: process.env.DB_HOST,
        DB_PORT: process.env.DB_PORT,
      },
      counts: {}
    };
    for (const modelName of Object.keys(models)) {
      if (modelName === 'sequelize') continue;
      try {
        data.counts[modelName] = await models[modelName].count();
        if (modelName === 'Room') {
          data.rooms = await models.Room.findAll();
        }
      } catch (err) {
        data.counts[modelName] = `Error: ${err.message}`;
      }
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
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
    console.log('DB Config in app.js:', {
      database: sequelize.config.database,
      username: sequelize.config.username,
      host: sequelize.config.host,
      port: sequelize.config.port
    });
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

