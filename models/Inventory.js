const { DataTypes } = require('sequelize');
const sequelize = require('./db');

const Inventory = sequelize.define('Inventory', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  category: {
    type: DataTypes.STRING,
    allowNull: true
  },
  purchase_date: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  price: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  condition: {
    type: DataTypes.ENUM('Baik', 'Rusak', 'Maintenance'),
    allowNull: false,
    defaultValue: 'Baik'
  },
  room_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'rooms',
      key: 'id'
    }
  },
  procurement_item_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'procurement_items',
      key: 'id'
    }
  },
  label_number: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true
  },
  qr_image_path: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'inventories'
});

module.exports = Inventory;

// Relasi
const Room = require('./Room');

Inventory.belongsTo(Room, { foreignKey: 'room_id', as: 'room' });
Room.hasMany(Inventory, { foreignKey: 'room_id', as: 'inventories' });
