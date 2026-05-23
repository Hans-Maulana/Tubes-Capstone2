const bcrypt = require('bcryptjs');
const { sequelize, Role, User } = require('../models');

const roles = [
  { id: 1, name: 'Administrator' },
  { id: 2, name: 'Kepala Laboratorium' },
  { id: 3, name: 'Ketua Program Studi' },
  { id: 4, name: 'Staf Administrasi' },
  { id: 5, name: 'Staf Laboratorium' }
];

const users = [
  { name: 'Super Administrator', email: 'admin@lab.com', role_id: 1 },
  { name: 'Kepala Lab', email: 'kalab@lab.com', role_id: 2 },
  { name: 'Ketua Prodi', email: 'kaprodi@lab.com', role_id: 3 },
  { name: 'Staf Administrasi', email: 'adminstaff@lab.com', role_id: 4 },
  { name: 'Staf Lapangan', email: 'staff@lab.com', role_id: 5 }
];

async function seedDatabase() {
  try {
    await sequelize.authenticate();
    await sequelize.sync();

    for (const role of roles) {
      await Role.upsert(role);
    }

    const password = await bcrypt.hash('password123', 10);

    for (const user of users) {
      await User.findOrCreate({
        where: { email: user.email },
        defaults: {
          ...user,
          password
        }
      });
    }

    console.log('Seeder Sequelize berhasil dijalankan.');
  } catch (error) {
    console.error('Gagal menjalankan seeder:', error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

seedDatabase();
