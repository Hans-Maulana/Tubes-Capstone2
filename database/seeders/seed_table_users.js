'use strict';

const bcrypt = require('bcryptjs');
const { User } = require('../../models');

const users = [
  { name: 'Super Administrator', email: 'admin@lab.com', role_id: 1 },
  { name: 'Kepala Lab', email: 'kalab@lab.com', role_id: 2 },
  { name: 'Ketua Prodi', email: 'kaprodi@lab.com', role_id: 3 },
  { name: 'Staf Administrasi', email: 'adminstaff@lab.com', role_id: 4 },
  { name: 'Staf Lapangan', email: 'staff@lab.com', role_id: 5 }
];

module.exports = {
  async up() {
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
    console.log('  ✔ Seeder: users');
  },

  async down() {
    await User.destroy({ where: {}, truncate: true });
    console.log('  ↓ Reverted seeder: users');
  }
};
