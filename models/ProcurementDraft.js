const { DataTypes } = require('sequelize');
const sequelize = require('./db');

const ProcurementDraft = sequelize.define('ProcurementDraft', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  lab_head_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  year: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('Draft', 'Submitted', 'Approved', 'Rejected', 'Locked'),
    allowNull: false,
    defaultValue: 'Draft'
  }
}, {
  tableName: 'procurement_drafts'
});

module.exports = ProcurementDraft;

// Relasi
const User = require('./User');
const ProcurementItem = require('./ProcurementItem');

ProcurementDraft.belongsTo(User, { foreignKey: 'lab_head_id', as: 'labHead' });
ProcurementDraft.hasMany(ProcurementItem, { foreignKey: 'draft_id', as: 'items' });
