const { DataTypes } = require('sequelize');
const sequelize = require('./db');

const Notification = sequelize.define('Notification', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  type: {
    type: DataTypes.STRING(64),
    allowNull: false
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  link: {
    type: DataTypes.STRING(512),
    allowNull: true
  },
  icon: {
    type: DataTypes.STRING(128),
    allowNull: true
  },
  ref_key: {
    type: DataTypes.STRING(128),
    allowNull: true
  },
  read_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'notifications',
  indexes: [
    { fields: ['user_id', 'read_at'] },
    { unique: true, fields: ['user_id', 'ref_key'] }
  ]
});

module.exports = Notification;

const User = require('./User');
Notification.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(Notification, { foreignKey: 'user_id', as: 'notifications' });
