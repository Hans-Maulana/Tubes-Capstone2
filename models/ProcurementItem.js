const { DataTypes } = require('sequelize');
const sequelize = require('./db');

const ProcurementItem = sequelize.define('ProcurementItem', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  draft_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'procurement_drafts',
      key: 'id'
    }
  },
  item_type: {
    type: DataTypes.STRING,
    allowNull: true
  },
  item_name: {
    type: DataTypes.STRING,
    allowNull: true
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  price: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  purchase_link: {
    type: DataTypes.STRING,
    allowNull: true
  },
  replacement_inventory_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'inventories',
      key: 'id'
    }
  },
  status: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  tableName: 'procurement_items'
});

module.exports = ProcurementItem;

// Relasi
const ProcurementDraft = require('./ProcurementDraft');
const Inventory = require('./Inventory');
const ProcurementReceipt = require('./ProcurementReceipt');

ProcurementItem.belongsTo(ProcurementDraft, { foreignKey: 'draft_id', as: 'draft' });
ProcurementItem.belongsTo(Inventory, { foreignKey: 'replacement_inventory_id', as: 'replacementInventory' });
ProcurementItem.hasMany(ProcurementReceipt, { foreignKey: 'procurement_item_id', as: 'receipts' });
