'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('inventories', 'procurement_item_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'procurement_items',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    await queryInterface.changeColumn('inventories', 'qr_image_path', {
      type: Sequelize.TEXT,
      allowNull: true
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('inventories', 'procurement_item_id');

    await queryInterface.changeColumn('inventories', 'qr_image_path', {
      type: Sequelize.STRING,
      allowNull: true
    });
  }
};
