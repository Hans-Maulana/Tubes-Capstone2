const { DataTypes } = require('sequelize');
const sequelize = require('./db');

const ProcurementItemReplacement = sequelize.define('ProcurementItemReplacement', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  procurement_item_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'procurement_items',
      key: 'id'
    }
  },
  inventory_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'inventories',
      key: 'id'
    }
  }
}, {
  tableName: 'procurement_item_replacements'
});

module.exports = ProcurementItemReplacement;

const ProcurementItem = require('./ProcurementItem');
const Inventory = require('./Inventory');

ProcurementItemReplacement.belongsTo(ProcurementItem, { foreignKey: 'procurement_item_id', as: 'procurementItem', onDelete: 'CASCADE' });
ProcurementItemReplacement.belongsTo(Inventory, { foreignKey: 'inventory_id', as: 'inventory', onDelete: 'CASCADE' });
ProcurementItem.hasMany(ProcurementItemReplacement, { foreignKey: 'procurement_item_id', as: 'replacementTargets', onDelete: 'CASCADE' });
