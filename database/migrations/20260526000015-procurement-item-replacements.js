'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('procurement_items', 'replacement_reason', {
      type: Sequelize.TEXT,
      allowNull: true
    });

    await queryInterface.createTable('procurement_item_replacements', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      procurement_item_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'procurement_items',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      inventory_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'inventories',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('procurement_item_replacements', ['procurement_item_id', 'inventory_id'], {
      unique: true,
      name: 'procurement_item_replacements_unique'
    });

    const [items] = await queryInterface.sequelize.query(
      'SELECT id, replacement_inventory_id FROM procurement_items WHERE replacement_inventory_id IS NOT NULL'
    );

    for (const row of items) {
      await queryInterface.bulkInsert('procurement_item_replacements', [{
        procurement_item_id: row.id,
        inventory_id: row.replacement_inventory_id,
        created_at: new Date(),
        updated_at: new Date()
      }]);
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('procurement_item_replacements');
    await queryInterface.removeColumn('procurement_items', 'replacement_reason');
  }
};
