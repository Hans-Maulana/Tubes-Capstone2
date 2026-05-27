'use strict';

const { Room } = require('../../models');

const rooms = [
  {
    name: 'Storage',
    code: 'STR',
    location: 'Gedung Teknik Informatika Lantai 2',
    description: 'Gudang penyimpanan inventaris dan alat laboratorium'
  },
  {
    name: 'Laboratorium Pemrograman',
    code: 'PROG1',
    location: 'Gedung Teknik Informatika Lantai 2',
    description: 'Ruangan praktek pemrograman dan rekayasa perangkat lunak'
  },
  {
    name: 'Laboratorium Pemrograman 2',
    code: 'PROG2',
    location: 'Gedung Teknik Informatika Lantai 2',
    description: 'Ruangan praktek pemrograman dan rekayasa perangkat lunak'
  },
  {
    name: 'Laboratorium Jaringan & Keamanan Komputer',
    code: 'NET',
    location: 'Gedung Teknik Informatika Lantai 2',
    description: 'Ruangan praktek jaringan komputer dan keamanan siber'
  },
  {
    name: 'Laboratorium Multimedia',
    code: 'MMD',
    location: 'Gedung Teknik Informatika Lantai 2',
    description: 'Ruangan praktek Internet of Things (IoT) dan Robotika'
  }
];

module.exports = {
  async up() {
    for (const room of rooms) {
      await Room.findOrCreate({
        where: { name: room.name },
        defaults: room
      });
    }
    console.log('  ✔ Seeder: rooms');
  },

  async down() {
    await Room.destroy({ where: {}, truncate: true });
    console.log('  ↓ Reverted seeder: rooms');
  }
};
