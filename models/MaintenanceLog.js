const { DataTypes } = require('sequelize');
const sequelize = require('./db');

const MaintenanceLog = sequelize.define('MaintenanceLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  inventory_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'inventories',
      key: 'id'
    }
  },
  staff_lab_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  bhp_used_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'bhps',
      key: 'id'
    }
  },
  bhp_quantity_used: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: 'maintenance_logs'
});

module.exports = MaintenanceLog;

// Relasi
const Inventory = require('./Inventory');
const User = require('./User');
const Bhp = require('./Bhp');

MaintenanceLog.belongsTo(Inventory, { foreignKey: 'inventory_id', as: 'inventory' });
Inventory.hasMany(MaintenanceLog, { foreignKey: 'inventory_id', as: 'maintenanceLogs' });

MaintenanceLog.belongsTo(User, { foreignKey: 'staff_lab_id', as: 'staffLab' });

MaintenanceLog.belongsTo(Bhp, { foreignKey: 'bhp_used_id', as: 'bhpUsed' });
Bhp.hasMany(MaintenanceLog, { foreignKey: 'bhp_used_id', as: 'maintenanceLogs' });
