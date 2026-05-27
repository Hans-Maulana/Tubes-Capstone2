const path = require('path');
const fs = require('fs');
const sequelize = require('../models/db');
const { Sequelize } = require('sequelize');

const force = process.argv.includes('--force');
const undo = process.argv.includes('--undo');

async function ensureMigrationsTable() {
  await sequelize.getQueryInterface().createTable('SequelizeMeta', {
    name: {
      type: Sequelize.STRING,
      allowNull: false,
      primaryKey: true
    }
  }).catch(() => {});
}

async function getExecutedMigrations() {
  const [results] = await sequelize.query('SELECT name FROM SequelizeMeta ORDER BY name ASC');
  return results.map(r => r.name);
}

async function getMigrationFiles() {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.js'))
    .sort();
  return files;
}

async function runMigrations() {
  try {
    await sequelize.authenticate();
    console.log('Koneksi database berhasil.\n');

    if (force) {
      // Drop semua table dan jalankan ulang semua migrasi
      console.log('Mode --force: Drop semua table dan migrasi ulang...\n');

      const files = await getMigrationFiles();

      // Undo semua migrasi (urutan terbalik)
      for (const file of [...files].reverse()) {
        const migration = require(path.join(__dirname, 'migrations', file));
        try {
          await migration.down(sequelize.getQueryInterface(), Sequelize);
          console.log(`  ↓ Reverted: ${file}`);
        } catch (err) {
          // Table mungkin belum ada, skip
        }
      }

      // Drop SequelizeMeta
      await sequelize.getQueryInterface().dropTable('SequelizeMeta').catch(() => {});

      // Buat ulang SequelizeMeta
      await ensureMigrationsTable();

      // Jalankan semua migrasi
      console.log('');
      for (const file of files) {
        const migration = require(path.join(__dirname, 'migrations', file));
        await migration.up(sequelize.getQueryInterface(), Sequelize);
        await sequelize.query('INSERT INTO SequelizeMeta (name) VALUES (?)', {
          replacements: [file]
        });
        console.log(`  ↑ Migrated: ${file}`);
      }

      console.log('\nDatabase berhasil dibuat ulang dengan migrasi.');
      return;
    }

    if (undo) {
      // Undo migrasi terakhir
      await ensureMigrationsTable();
      const executed = await getExecutedMigrations();

      if (executed.length === 0) {
        console.log('Tidak ada migrasi untuk di-undo.');
        return;
      }

      const lastMigration = executed[executed.length - 1];
      const migration = require(path.join(__dirname, 'migrations', lastMigration));
      await migration.down(sequelize.getQueryInterface(), Sequelize);
      await sequelize.query('DELETE FROM SequelizeMeta WHERE name = ?', {
        replacements: [lastMigration]
      });
      console.log(`  ↓ Reverted: ${lastMigration}`);
      return;
    }

    // Default: jalankan migrasi pending
    await ensureMigrationsTable();
    const executed = await getExecutedMigrations();
    const files = await getMigrationFiles();
    const pending = files.filter(f => !executed.includes(f));

    if (pending.length === 0) {
      console.log('Tidak ada migrasi pending. Database sudah up-to-date.');
      return;
    }

    console.log(`Menjalankan ${pending.length} migrasi...\n`);

    for (const file of pending) {
      const migration = require(path.join(__dirname, 'migrations', file));
      await migration.up(sequelize.getQueryInterface(), Sequelize);
      await sequelize.query('INSERT INTO SequelizeMeta (name) VALUES (?)', {
        replacements: [file]
      });
      console.log(`  ↑ Migrated: ${file}`);
    }

    console.log('\nSemua migrasi berhasil dijalankan.');
  } catch (error) {
    console.error('Gagal menjalankan migrasi:', error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

runMigrations();
