'use strict';

const { ProcurementDraft, User, Role } = require('../../models');

module.exports = {
  async up() {
    const labHeadRole = await Role.findOne({ where: { name: 'Kepala Laboratorium' } });
    const labHeadUser = await User.findOne({
      where: { role_id: labHeadRole ? labHeadRole.id : 2, email: 'kalab@lab.com' }
    });

    if (!labHeadUser) {
      console.warn('  ? Seeder: procurement_drafts dilewati karena user Kepala Lab tidak ditemukan');
      return;
    }

    await ProcurementDraft.findOrCreate({
      where: { lab_head_id: labHeadUser.id, year: 2026 },
      defaults: {
        lab_head_id: labHeadUser.id,
        year: 2026,
        status: 'Approved'
      }
    });

    console.log('  ? Seeder: procurement_drafts (Approved draft 2026)');
  },

  async down() {
    await ProcurementDraft.destroy({ where: { year: 2026 } });
    console.log('  ? Reverted seeder: procurement_drafts');
  }
};
