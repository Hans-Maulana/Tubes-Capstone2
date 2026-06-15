const {
  Inventory,
  Bhp,
  Room,
  MaintenanceLog,
  ProcurementDraft,
  ProcurementItem,
  ProcurementReceipt,
  User,
  Role
} = require('../models');

function getReceivedTotal(item) {
  return (item.receipts || []).reduce((total, receipt) => total + Number(receipt.quantity_received || 0), 0);
}

function getLabeledTotal(item) {
  return item.receivedInventories ? item.receivedInventories.length : 0;
}

async function getDashboardStatsForUser(user) {
  if (user.role === 'Administrator') {
    return {
      totalUsers: await User.count(),
      totalRooms: await Room.count(),
      totalInventories: await Inventory.count(),
      totalBhps: await Bhp.count()
    };
  }

  if (user.role === 'Kepala Laboratorium') {
    const { Op } = require('sequelize');
    return {
      totalDrafts: await ProcurementDraft.count({
        where: { lab_head_id: user.id }
      }),
      submittedDrafts: await ProcurementDraft.count({
        where: {
          lab_head_id: user.id,
          status: { [Op.ne]: 'Draft' }
        }
      }),
      totalInventories: await Inventory.count(),
      totalBhps: await Bhp.count()
    };
  }

  if (user.role === 'Ketua Program Studi') {
    const { Op } = require('sequelize');
    return {
      pendingDrafts: await ProcurementDraft.count({
        where: { status: { [Op.in]: ['Submitted', 'Locked'] } }
      }),
      approvedDrafts: await ProcurementDraft.count({
        where: { status: 'Approved' }
      }),
      totalInventories: await Inventory.count(),
      totalBhps: await Bhp.count()
    };
  }

  if (user.role === 'Staf Laboratorium') {
    return {
      totalInventories: await Inventory.count(),
      totalBhps: await Bhp.count(),
      totalRooms: await Room.count(),
      totalLogs: await MaintenanceLog.count()
    };
  }

  if (user.role === 'Staf Administrasi') {
    const approvedDrafts = await ProcurementDraft.findAll({
      where: { status: 'Approved' },
      include: [
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
      ]
    });

    const approvedItems = approvedDrafts.flatMap(draft => draft.items || []);
    const inventarisItems = approvedItems.filter((item) => item.item_type !== 'BHP');
    const totalReceived = inventarisItems.reduce((total, item) => total + getReceivedTotal(item), 0);
    const totalLabeled = inventarisItems.reduce((total, item) => total + getLabeledTotal(item), 0);

    return {
      approvedDrafts: approvedDrafts.length,
      approvedItems: approvedItems.length,
      receivedItems: totalReceived,
      pendingLabels: Math.max(totalReceived - totalLabeled, 0)
    };
  }

  return {
    totalInventories: await Inventory.count(),
    totalBhps: await Bhp.count(),
    totalRooms: await Room.count(),
    totalLogs: await MaintenanceLog.count()
  };
}

exports.getDashboardStats = async (req, res, next) => {
  try {
    const stats = await getDashboardStatsForUser(req.session.user);
    res.json({
      ok: true,
      role: req.session.user.role,
      stats,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Render the main secure dashboard with active metrics
 */
exports.getDashboard = async (req, res, next) => {
  try {
    const success = req.session.success || null;
    const error = req.session.error || null;
    req.session.success = null;
    req.session.error = null;

    if (req.session.user.role === 'Administrator') {
      const totalUsers = await User.count();
      const totalRooms = await Room.count();
      const totalInventories = await Inventory.count();
      const totalBhps = await Bhp.count();

      const recentUsers = await User.findAll({
        include: [{ model: Role, as: 'role' }],
        order: [['id', 'DESC']],
        limit: 5
      });

      return res.render('dashboard/index', {
        title: 'Dashboard Administrator - Sistem Inventaris Laboratorium',
        superAdminDashboard: true,
        stats: {
          totalUsers,
          totalRooms,
          totalInventories,
          totalBhps
        },
        recentUsers,
        success,
        error
      });
    }

    if (req.session.user.role === 'Kepala Laboratorium') {
      const totalDrafts = await ProcurementDraft.count({
        where: { lab_head_id: req.session.user.id }
      });

      const { Op } = require('sequelize');
      const submittedDrafts = await ProcurementDraft.count({
        where: {
          lab_head_id: req.session.user.id,
          status: { [Op.ne]: 'Draft' }
        }
      });
      const totalInventories = await Inventory.count();
      const totalBhps = await Bhp.count();

      const myDrafts = await ProcurementDraft.findAll({
        where: { lab_head_id: req.session.user.id },
        include: [{ model: ProcurementItem, as: 'items' }],
        order: [['year', 'DESC'], ['id', 'DESC']],
        limit: 5
      });

      const distinctYears = await ProcurementDraft.findAll({
        attributes: ['year'],
        where: { lab_head_id: req.session.user.id },
        group: ['year'],
        order: [['year', 'DESC']]
      });
      const availableYears = distinctYears.map(d => d.year);

      return res.render('dashboard/index', {
        title: 'Dashboard Kepala Laboratorium - Sistem Inventaris Laboratorium',
        labHeadDashboard: true,
        stats: {
          totalDrafts,
          submittedDrafts,
          totalInventories,
          totalBhps
        },
        myDrafts,
        availableYears,
        success,
        error
      });
    }

    if (req.session.user.role === 'Ketua Program Studi') {
      const { Op } = require('sequelize');
      const pendingDraftsCount = await ProcurementDraft.count({
        where: { status: { [Op.in]: ['Submitted', 'Locked'] } }
      });
      const approvedDraftsCount = await ProcurementDraft.count({
        where: { status: 'Approved' }
      });
      const totalInventories = await Inventory.count();
      const totalBhps = await Bhp.count();

      const recentSubmittedDrafts = await ProcurementDraft.findAll({
        where: {
          status: { [Op.in]: ['Submitted', 'Locked', 'Approved', 'Rejected'] }
        },
        include: [
          { model: User, as: 'labHead' }
        ],
        order: [['year', 'DESC'], ['id', 'DESC']],
        limit: 5
      });

      const distinctYears = await ProcurementDraft.findAll({
        attributes: ['year'],
        where: { status: { [Op.in]: ['Submitted', 'Locked', 'Approved', 'Rejected'] } },
        group: ['year'],
        order: [['year', 'DESC']]
      });
      const availableYears = distinctYears.map(d => d.year);

      return res.render('dashboard/index', {
        title: 'Dashboard Ketua Program Studi - Sistem Inventaris Laboratorium',
        kaprodiDashboard: true,
        stats: {
          pendingDrafts: pendingDraftsCount,
          approvedDrafts: approvedDraftsCount,
          totalInventories,
          totalBhps
        },
        recentSubmittedDrafts,
        availableYears,
        success,
        error
      });
    }

    if (req.session.user.role === 'Staf Laboratorium') {
      const totalInventories = await Inventory.count();
      const totalBhps = await Bhp.count();
      const totalRooms = await Room.count();
      const totalLogs = await MaintenanceLog.count();

      const { Op } = require('sequelize');
      const lowStockBhps = await Bhp.findAll({
        where: {
          stock: { [Op.lt]: 5 }
        },
        order: [['stock', 'ASC']]
      });

      const recentLogs = await MaintenanceLog.findAll({
        include: [
          { model: Inventory, as: 'inventory' },
          { model: Bhp, as: 'bhpUsed' }
        ],
        order: [['id', 'DESC']],
        limit: 5
      });

      return res.render('dashboard/index', {
        title: 'Dashboard Staf Laboratorium - Sistem Inventaris Laboratorium',
        staffLabDashboard: true,
        stats: {
          totalInventories,
          totalBhps,
          totalRooms,
          totalLogs
        },
        recentLogs,
        lowStockBhps,
        success,
        error
      });
    }

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
      const inventarisItems = approvedItems.filter((item) => item.item_type !== 'BHP');
      const totalApprovedItems = approvedItems.length;
      const totalRequested = approvedItems.reduce((total, item) => total + Number(item.quantity || 0), 0);
      const totalReceived = approvedItems.reduce((total, item) => total + getReceivedTotal(item), 0);
      const totalLabeled = inventarisItems.reduce((total, item) => total + getLabeledTotal(item), 0);
      const inventarisReceived = inventarisItems.reduce((total, item) => total + getReceivedTotal(item), 0);

      const distinctYears = await ProcurementDraft.findAll({
        attributes: ['year'],
        where: { status: 'Approved' },
        group: ['year'],
        order: [['year', 'DESC']]
      });
      const availableYears = distinctYears.map(d => d.year);

      return res.render('dashboard/index', {
        title: 'Dashboard Staf Administrasi - Sistem Inventaris Laboratorium',
        adminDashboard: true,
        adminStats: {
          approvedDrafts: approvedDrafts.length,
          approvedItems: totalApprovedItems,
          receivedItems: totalReceived,
          pendingLabels: Math.max(inventarisReceived - totalLabeled, 0)
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
        totalRequested,
        availableYears,
        success,
        error
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
      })),
      success,
      error
    });
  } catch (error) {
    next(error);
  }
};
