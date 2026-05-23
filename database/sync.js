const { sequelize } = require('../models');

const force = process.argv.includes('--force');
const alter = process.argv.includes('--alter') && !force;

async function syncDatabase() {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ force, alter });

    if (force) {
      console.log('Database berhasil dibuat ulang dengan Sequelize.');
    } else if (alter) {
      console.log('Database berhasil disinkronkan dengan model Sequelize.');
    } else {
      console.log('Model Sequelize sudah siap.');
    }
  } catch (error) {
    console.error('Gagal sinkronisasi database:', error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

syncDatabase();
