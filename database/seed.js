const path = require('path');
const fs = require('fs');
const { sequelize } = require('../models');

async function seedDatabase() {
  try {
    await sequelize.authenticate();
    await sequelize.sync();

    const seedersDir = path.join(__dirname, 'seeders');
    const files = fs.readdirSync(seedersDir)
      .filter(f => f.startsWith('seed_table_') && f.endsWith('.js'))
      .sort();

    console.log(`Menjalankan ${files.length} seeder...\n`);

    for (const file of files) {
      const seeder = require(path.join(seedersDir, file));
      await seeder.up();
    }

    console.log('\nSemua seeder berhasil dijalankan.');
  } catch (error) {
    console.error('Gagal menjalankan seeder:', error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

seedDatabase();
