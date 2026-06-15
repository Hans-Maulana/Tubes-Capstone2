const { Op } = require('sequelize');
const { Inventory, ProcurementItem, ProcurementDraft } = require('../models');

async function findStaffLabManagedInventory(id) {
  return Inventory.findOne({
    where: { id },
    include: [
      {
        model: ProcurementItem,
        as: 'procurementItem',
        required: true,
        where: {
          item_type: { [Op.ne]: 'BHP' },
          status: 'Approved'
        },
        include: [{
          model: ProcurementDraft,
          as: 'draft',
          required: true,
          where: { status: 'Approved' }
        }]
      }
    ]
  });
}

async function getDamagedInventoriesForReplacement() {
  return Inventory.findAll({
    where: { condition: 'Rusak' },
    include: [
      {
        model: ProcurementItem,
        as: 'procurementItem',
        required: true,
        where: {
          item_type: { [Op.ne]: 'BHP' },
          status: 'Approved'
        },
        include: [{
          model: ProcurementDraft,
          as: 'draft',
          required: true,
          where: { status: 'Approved' }
        }]
      }
    ],
    order: [['label_number', 'ASC']]
  });
}

module.exports = {
  findStaffLabManagedInventory,
  getDamagedInventoriesForReplacement
};
