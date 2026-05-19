const { DataTypes } = require('sequelize');
const sequelize = require('./db');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  role_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'roles',
      key: 'id'
    }
  }
}, {
  tableName: 'users'
});

module.exports = User;

// Relasi
const Role = require('./Role');
const ProcurementDraft = require('./ProcurementDraft');

User.belongsTo(Role, { foreignKey: 'role_id', as: 'role' });
User.hasMany(ProcurementDraft, { foreignKey: 'lab_head_id', as: 'procurementDrafts' });
