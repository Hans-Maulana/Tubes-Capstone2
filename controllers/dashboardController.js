const {
  Inventory,
  Bhp,
  Room,
  MaintenanceLog,
  ProcurementDraft,
  ProcurementItem,
  ProcurementReceipt,
  User
} = require('../models');

function getReceivedTotal(item) {
  return (item.receipts || []).reduce((total, receipt) => total + Number(receipt.quantity_received || 0), 0);
}

function getLabeledTotal(item) {
  return item.receivedInventories ? item.receivedInventories.length : 0;
}

/**
 * Render the main secure dashboard with active metrics
 */
exports.getDashboard = async (req, res, next) => {
  try {
    if (req.session.user.role === 'Staf Administrasi') {
      const approvedDrafts = await ProcurementDraft.findAll({
        where: { status: 'Approved' },
        include: [
          { model: User, as: 'labHead' },
          {
            model: ProcurementItem,
            as: 'items',
            where: { status: 'Approved' },
            required: false,
            include: [
              { model: ProcurementReceipt, as: 'receipts' },
              { model: Inventory, as: 'receivedInventories' }
            ]
          }
        ],
        order: [['year', 'DESC'], ['id', 'DESC']]
      });

      const approvedItems = approvedDrafts.flatMap(draft => draft.items || []);
      const totalApprovedItems = approvedItems.length;
      const totalRequested = approvedItems.reduce((total, item) => total + Number(item.quantity || 0), 0);
      const totalReceived = approvedItems.reduce((total, item) => total + getReceivedTotal(item), 0);
      const totalLabeled = approvedItems.reduce((total, item) => total + getLabeledTotal(item), 0);

      return res.render('dashboard/index', {
        title: 'Dashboard Staf Administrasi - Sistem Inventaris Laboratorium',
        adminDashboard: true,
        adminStats: {
          approvedDrafts: approvedDrafts.length,
          approvedItems: totalApprovedItems,
          receivedItems: totalReceived,
          pendingLabels: Math.max(totalReceived - totalLabeled, 0)
        },
        adminDrafts: approvedDrafts.slice(0, 5).map(draft => {
          const items = draft.items || [];
          const requested = items.reduce((total, item) => total + Number(item.quantity || 0), 0);
          const received = items.reduce((total, item) => total + getReceivedTotal(item), 0);
          const labeled = items.reduce((total, item) => total + getLabeledTotal(item), 0);

          return {
            id: draft.id,
            year: draft.year,
            labHead: draft.labHead ? draft.labHead.name : '-',
            approvedItems: items.length,
            requested,
            received,
            labeled
          };
        }),
        totalRequested
      });
    }

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
