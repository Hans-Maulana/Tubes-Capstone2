const { DataTypes } = require('sequelize');
const sequelize = require('./db');

const MaintenanceLogBhp = sequelize.define('MaintenanceLogBhp', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  maintenance_log_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'maintenance_logs',
      key: 'id'
    }
  },
  bhp_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'bhps',
      key: 'id'
    }
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  }
}, {
  tableName: 'maintenance_log_bhps'
});

module.exports = MaintenanceLogBhp;
