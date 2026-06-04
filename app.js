const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const session = require('express-session');
const {
  sequelize,
  ProcurementDraft,
  ProcurementItem,
  Inventory,
  MaintenanceLog,
  User
} = require('./models');
const { Op } = require('sequelize');
const routes = require('./routes/index');
const authRoutes = require('./routes/auth');

// Load environment variables
dotenv.config();

// Run pending database migrations
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

// Middleware Notifikasi Dinamis Lintas Role
app.use(async (req, res, next) => {
  res.locals.notifications = [];
  
  if (req.session && req.session.user) {
    try {
      const user = req.session.user;
      const notifications = [];

      // 1. Ketua Program Studi (Kaprodi): Draf yang perlu direview (status: 'Locked')
      if (user.role === 'Ketua Program Studi') {
        const pendingDrafts = await ProcurementDraft.findAll({
          where: { status: 'Locked' },
          include: [{ model: User, as: 'labHead' }]
        });
        for (const draft of pendingDrafts) {
          notifications.push({
            id: `draft-review-${draft.id}`,
            icon: 'ti ti-file-check text-warning',
            title: 'Review Pengadaan',
            message: `Draf pengadaan tahun ${draft.year} dari ${draft.labHead ? draft.labHead.name : 'Kalab'} perlu direview.`,
            link: '/procurement-drafts-history'
          });
        }
      }

      // 2. Kepala Laboratorium (Kalab): Barang inventaris dilaporkan rusak (condition: 'Rusak')
      if (user.role === 'Kepala Laboratorium') {
        const damagedInventories = await Inventory.findAll({
          where: { condition: 'Rusak' },
          include: [
            {
              model: ProcurementItem,
              as: 'procurementItem',
              required: true,
              where: { status: 'Approved' },
              include: [
                {
                  model: ProcurementDraft,
                  as: 'draft',
                  required: true,
                  where: { status: 'Approved' }
                }
              ]
            }
          ]
        });
        for (const inv of damagedInventories) {
          notifications.push({
            id: `inv-damaged-${inv.id}`,
            icon: 'ti ti-alert-triangle text-danger',
            title: 'Inventaris Rusak',
            message: `Barang ${inv.name} (${inv.label_number}) dilaporkan rusak dan memerlukan draf penggantian.`,
            link: '/procurement-drafts'
          });
        }
      }

      // 3. Staf Administrasi: Ada item pengadaan yang disetujui tapi belum diterima/diinput
      if (user.role === 'Staf Administrasi') {
        const pendingItems = await ProcurementItem.findAll({
          where: {
            status: 'Approved',
            item_type: { [Op.ne]: 'BHP' }
          },
          include: [
            {
              model: ProcurementDraft,
              as: 'draft',
              where: { status: 'Approved' },
              required: true
            }
          ]
        });
        
        for (const item of pendingItems) {
          const labeledCount = await Inventory.count({
            where: { procurement_item_id: item.id }
          });
          if (labeledCount < item.quantity) {
            notifications.push({
              id: `item-pending-${item.id}`,
              icon: 'ti ti-qrcode text-info',
              title: 'Input Inventaris',
              message: `Item ${item.item_name} (${item.quantity} unit) baru disetujui, belum selesai diinput ke sistem (${labeledCount}/${item.quantity} unit).`,
              link: '/administration/inventories'
            });
          }
        }
      }

      // 4. Semua Role: Riwayat pemeliharaan terbaru yang baru diselesaikan (3 hari terakhir)
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const recentLogs = await MaintenanceLog.findAll({
        where: {
          date: { [Op.gte]: threeDaysAgo }
        },
        include: [
          { model: Inventory, as: 'inventory' },
          { model: User, as: 'staffLab' }
        ],
        limit: 5,
        order: [['date', 'DESC']]
      });

      for (const log of recentLogs) {
        notifications.push({
          id: `maintenance-${log.id}`,
          icon: 'ti ti-tool text-success',
          title: 'Maintenance Selesai',
          message: `Pemeliharaan ${log.inventory ? log.inventory.name : 'inventaris'} selesai dikerjakan oleh ${log.staffLab ? log.staffLab.name : 'Staf Lab'}.`,
          link: `/stafflab/maintenance/${log.id}`
        });
      }

      res.locals.notifications = notifications;
    } catch (err) {
      console.error('[Notification Middleware Error]:', err);
    }
  }
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
      } catch (err) {
        data.counts[modelName] = `Error: ${err.message}`;
      }
    }
    try {
      const [drafts] = await sequelize.query('SELECT * FROM procurement_drafts');
      data.drafts = drafts;
    } catch (err) {
      data.draftsError = err.message;
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
    await sequelize.sync();
    console.log('✅ Database tables synced.');
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

