const { DataTypes } = require('sequelize');
const sequelize = require('./db');

const InventoryReplacement = sequelize.define('InventoryReplacement', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  old_inventory_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'inventories',
      key: 'id'
    }
  },
  new_inventory_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'inventories',
      key: 'id'
    }
  },
  date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'inventory_replacements'
});

module.exports = InventoryReplacement;

// Relasi
const Inventory = require('./Inventory');

InventoryReplacement.belongsTo(Inventory, { foreignKey: 'old_inventory_id', as: 'oldInventory' });
InventoryReplacement.belongsTo(Inventory, { foreignKey: 'new_inventory_id', as: 'newInventory' });
