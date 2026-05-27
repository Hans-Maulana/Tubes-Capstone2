'use strict';

const { Role } = require('../../models');

const roles = [
  { id: 1, name: 'Administrator' },
  { id: 2, name: 'Kepala Laboratorium' },
  { id: 3, name: 'Ketua Program Studi' },
  { id: 4, name: 'Staf Administrasi' },
  { id: 5, name: 'Staf Laboratorium' }
];

module.exports = {
  async up() {
    for (const role of roles) {
      await Role.upsert(role);
    }
    console.log('  ✔ Seeder: roles');
  },

  async down() {
    await Role.destroy({ where: {}, truncate: true });
    console.log('  ↓ Reverted seeder: roles');
  }
};
