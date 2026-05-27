const path = require('path');
const fs = require('fs');
const sequelize = require('../models/db');
const { Sequelize } = require('sequelize');

const force = process.argv.includes('--force');
const undo = process.argv.includes('--undo');
const MIGRATIONS_TABLE = 'sequelize_meta';

async function ensureMigrationsTable() {
  const queryInterface = sequelize.getQueryInterface();
  const tables = await queryInterface.showAllTables();
  const tableExists = tables
    .map(table => (typeof table === 'object' ? table.tableName : table))
    .some(table => table.toLowerCase() === MIGRATIONS_TABLE);

  if (tableExists) {
    return;
  }

  await queryInterface.createTable(MIGRATIONS_TABLE, {
    name: {
      type: Sequelize.STRING,
      allowNull: false,
      primaryKey: true
    }
  });
}

async function getExecutedMigrations() {
  const [results] = await sequelize.query(`SELECT name FROM ${MIGRATIONS_TABLE} ORDER BY name ASC`);
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

      // Drop migration metadata table
      await sequelize.getQueryInterface().dropTable(MIGRATIONS_TABLE).catch(() => {});

      // Buat ulang metadata migrasi
      await ensureMigrationsTable();

      // Jalankan semua migrasi
      console.log('');
      for (const file of files) {
        const migration = require(path.join(__dirname, 'migrations', file));
        await migration.up(sequelize.getQueryInterface(), Sequelize);
        await sequelize.query(`INSERT INTO ${MIGRATIONS_TABLE} (name) VALUES (?)`, {
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
      await sequelize.query(`DELETE FROM ${MIGRATIONS_TABLE} WHERE name = ?`, {
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
      await sequelize.query(`INSERT INTO ${MIGRATIONS_TABLE} (name) VALUES (?)`, {
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
