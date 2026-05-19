const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 3306,
    dialect: process.env.DB_DIALECT || 'mysql',
    logging: false,
    timezone: '+07:00',
    define: {
      timestamps: true,
      underscored: true // Gunakan snake_case untuk kolom (created_at, updated_at)
    }
  }
);

module.exports = sequelize;
