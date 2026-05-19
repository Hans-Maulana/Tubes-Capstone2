const { DataTypes } = require('sequelize');
const sequelize = require('./db');

const ProcurementReceipt = sequelize.define('ProcurementReceipt', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  procurement_item_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'procurement_items',
      key: 'id'
    }
  },
  received_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  quantity_received: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  admin_staff_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  }
}, {
  tableName: 'procurement_receipts'
});

module.exports = ProcurementReceipt;

// Relasi
const ProcurementItem = require('./ProcurementItem');
const User = require('./User');

ProcurementReceipt.belongsTo(ProcurementItem, { foreignKey: 'procurement_item_id', as: 'procurementItem' });
ProcurementReceipt.belongsTo(User, { foreignKey: 'admin_staff_id', as: 'adminStaff' });
