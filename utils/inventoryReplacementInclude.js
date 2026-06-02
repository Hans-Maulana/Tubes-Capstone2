const InventoryReplacement = require('../models/InventoryReplacement');
const Inventory = require('../models/Inventory');
const Room = require('../models/Room');

function getInventoryReplacementIncludes() {
  return [
    {
      model: InventoryReplacement,
      as: 'replacementAsNew',
      required: false,
      include: [{
        model: Inventory,
        as: 'oldInventory',
        attributes: ['id', 'label_number', 'name', 'condition', 'room_id'],
        include: [{ model: Room, as: 'room', attributes: ['id', 'name'] }]
      }]
    },
    {
      model: InventoryReplacement,
      as: 'replacementAsOld',
      required: false,
      include: [{
        model: Inventory,
        as: 'newInventory',
        attributes: ['id', 'label_number', 'name', 'condition', 'room_id'],
        include: [{ model: Room, as: 'room', attributes: ['id', 'name'] }]
      }]
    }
  ];
}

module.exports = { getInventoryReplacementIncludes };
