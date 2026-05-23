const sequelize = require('./db');

const Role = require('./Role');
const User = require('./User');
const Room = require('./Room');
const Inventory = require('./Inventory');
const Bhp = require('./Bhp');
const ProcurementDraft = require('./ProcurementDraft');
const ProcurementItem = require('./ProcurementItem');
const ProcurementReceipt = require('./ProcurementReceipt');
const MaintenanceLog = require('./MaintenanceLog');
const InventoryReplacement = require('./InventoryReplacement');

module.exports = {
  sequelize,
  Role,
  User,
  Room,
  Inventory,
  Bhp,
  ProcurementDraft,
  ProcurementItem,
  ProcurementReceipt,
  MaintenanceLog,
  InventoryReplacement
};
