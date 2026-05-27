'use strict';

const { ProcurementDraft, ProcurementItem, User, Role } = require('../../models');

module.exports = {
  async up() {
    const labHeadRole = await Role.findOne({ where: { name: 'Kepala Laboratorium' } });
    const labHeadUser = await User.findOne({
      where: { role_id: labHeadRole ? labHeadRole.id : 2, email: 'kalab@lab.com' }
    });

    if (!labHeadUser) {
      console.warn('  ? Seeder: procurement_items dilewati karena user Kepala Lab tidak ditemukan');
      return;
    }

    const [draft] = await ProcurementDraft.findOrCreate({
      where: { lab_head_id: labHeadUser.id, year: 2026 },
      defaults: {
        lab_head_id: labHeadUser.id,
        year: 2026,
        status: 'Approved'
      }
    });

    const items = [
      {
        item_type: 'Inventaris',
        item_name: 'Kursi',
        quantity: 12,
        price: 250000,
        status: 'Approved'
      },
      {
        item_type: 'BHP',
        item_name: 'Thermal Paste',
        quantity: 24,
        price: 120000,
        status: 'Approved'
      }
    ];

    for (const data of items) {
      await ProcurementItem.findOrCreate({
        where: {
          draft_id: draft.id,
          item_type: data.item_type,
          item_name: data.item_name
        },
        defaults: {
          ...data,
          draft_id: draft.id
        }
      });
    }

    console.log('  ? Seeder: procurement_items (Approved items for draft 2026)');
  },

  async down() {
    await ProcurementItem.destroy({ where: { item_name: ['Kursi', 'Thermal Paste'] } });
    console.log('  ? Reverted seeder: procurement_items');
  }
};
