'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('notifications', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      type: {
        type: Sequelize.STRING(64),
        allowNull: false
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      message: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      link: {
        type: Sequelize.STRING(512),
        allowNull: true
      },
      icon: {
        type: Sequelize.STRING(128),
        allowNull: true
      },
      ref_key: {
        type: Sequelize.STRING(128),
        allowNull: true
      },
      read_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('notifications', ['user_id', 'read_at'], {
      name: 'notifications_user_read_idx'
    });

    await queryInterface.addIndex('notifications', ['user_id', 'ref_key'], {
      name: 'notifications_user_ref_key_unique',
      unique: true
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('notifications');
  }
};
