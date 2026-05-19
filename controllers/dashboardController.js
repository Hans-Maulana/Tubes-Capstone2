const Inventory = require('../models/Inventory');
const Bhp = require('../models/Bhp');
const Room = require('../models/Room');
const MaintenanceLog = require('../models/MaintenanceLog');

/**
 * Render the main secure dashboard with active metrics
 */
exports.getDashboard = async (req, res, next) => {
  try {
    const totalInventories = await Inventory.count();
    const totalBhps = await Bhp.count();
    const totalRooms = await Room.count();
    const totalLogs = await MaintenanceLog.count();

    // Take top 5 recent inventories with room relation
    const recentInventories = await Inventory.findAll({
      include: [{ model: Room, as: 'room' }],
      order: [['id', 'DESC']],
      limit: 5
    });

    res.render('dashboard/index', {
      title: 'Dashboard - Sistem Inventaris Laboratorium',
      stats: {
        totalInventories,
        totalBhps,
        totalRooms,
        totalLogs
      },
      recentInventories: recentInventories.map(inv => ({
        label_number: inv.label_number,
        name: inv.name,
        category: inv.category,
        room_name: inv.room ? inv.room.name : null,
        condition: inv.condition
      }))
    });
  } catch (error) {
    next(error);
  }
};
