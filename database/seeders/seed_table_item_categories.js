'use strict';

const { ItemCategory } = require('../../models');

module.exports = {
  async up() {
    const categories = [
      { name: 'Elektronik', description: 'Perangkat elektronik dan komponen pendukung' },
      { name: 'Furniture', description: 'Meja, kursi, lemari, dan perlengkapan ruangan' },
      { name: 'Peralatan Lab', description: 'Alat praktikum dan peralatan laboratorium' },
      { name: 'Komputer', description: 'PC, laptop, monitor, dan aksesoris komputer' },
      { name: 'Jaringan', description: 'Router, switch, kabel, dan perangkat jaringan' }
    ];

    for (const data of categories) {
      await ItemCategory.findOrCreate({
        where: { name: data.name },
        defaults: data
      });
    }

    console.log('  ✓ Seeder: item_categories');
  },

  async down() {
    await ItemCategory.destroy({
      where: {
        name: ['Elektronik', 'Furniture', 'Peralatan Lab', 'Komputer', 'Jaringan']
      }
    });
    console.log('  ✓ Reverted seeder: item_categories');
  }
};
