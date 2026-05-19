const { DataTypes } = require('sequelize');
const sequelize = require('./db');

const Role = sequelize.define('Role', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  }
}, {
  tableName: 'roles'
});

module.exports = Role;

// Relasi
const User = require('./User');
Role.hasMany(User, { foreignKey: 'role_id', as: 'users' });
