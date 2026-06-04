const { Op } = require('sequelize');
const {
  Bhp,
  Inventory,
  MaintenanceLog,
  User,
  Room,
  ProcurementItem,
  ProcurementDraft,
  ItemCategory,
  MaintenanceLogBhp,
  Role,
  sequelize
} = require('../models');

const INVENTORY_CONDITIONS = ['Baik', 'Rusak', 'Maintenance'];

async function findLabeledInventories({ room_id, year, label, category_id, q, condition } = {}) {
  const inventoryWhere = {};
  if (room_id) {
    inventoryWhere.room_id = parseInt(room_id, 10);
  }
  if (label && label.trim()) {
    inventoryWhere.label_number = { [Op.like]: `%${label.trim()}%` };
  }
  if (q && q.trim()) {
    inventoryWhere.name = { [Op.like]: `%${q.trim()}%` };
  }
  if (category_id) {
    inventoryWhere.category_id = parseInt(category_id, 10);
  }
  if (condition && condition.trim()) {
    inventoryWhere.condition = condition.trim();
  }

  const draftWhere = { status: 'Approved' };
  if (year) {
    draftWhere.year = parseInt(year, 10);
  }

  return Inventory.findAll({
    where: inventoryWhere,
    include: [
      { model: Room, as: 'room' },
      { model: ItemCategory, as: 'itemCategory' },
      {
        model: ProcurementItem,
        as: 'procurementItem',
        required: true,
        where: {
          item_type: { [Op.ne]: 'BHP' },
          status: 'Approved'
        },
        include: [
          {
            model: ProcurementDraft,
            as: 'draft',
            required: true,
            where: draftWhere
          }
        ]
      }
    ],
    order: [['label_number', 'ASC']]
  });
}

// --- MANAJEMEN BHP ---

exports.getBhps = async (req, res, next) => {
  try {
    const bhps = await Bhp.findAll({
      order: [['name', 'ASC']]
    });

    res.render('stafflab/bhps/index', {
      title: 'Stok BHP - Sistem Inventaris Laboratorium',
      bhps,
      success: req.session.success || null,
      error: req.session.error || null
    });

    req.session.success = null;
    req.session.error = null;
  } catch (error) {
    next(error);
  }
};

// --- LOG MAINTENANCE ---

exports.getMaintenanceLogs = async (req, res, next) => {
  try {
    const { q, label, room_id, staff_id, date } = req.query;

    const where = {};
    const inventoryWhere = {};

    if (date && date.trim()) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      where.date = {
        [Op.between]: [startDate, endDate]
      };
    }

    if (staff_id) {
      where.staff_lab_id = parseInt(staff_id, 10);
    }

    if (room_id) {
      inventoryWhere.room_id = parseInt(room_id, 10);
    }
    if (label && label.trim()) {
      inventoryWhere.label_number = { [Op.like]: `%${label.trim()}%` };
    }
    if (q && q.trim()) {
      inventoryWhere.name = { [Op.like]: `%${q.trim()}%` };
    }

    const isInventoryFiltered = Boolean(room_id || (label && label.trim()) || (q && q.trim()));

    const logs = await MaintenanceLog.findAll({
      where,
      include: [
        {
          model: Inventory,
          as: 'inventory',
          required: isInventoryFiltered,
          where: isInventoryFiltered ? inventoryWhere : undefined,
          include: [{ model: Room, as: 'room' }]
        },
        { model: User, as: 'staffLab' },
        { model: Bhp, as: 'bhpUsed' },
        {
          model: MaintenanceLogBhp,
          as: 'logBhps',
          include: [{ model: Bhp, as: 'bhp' }]
        }
      ],
      order: [['date', 'DESC'], ['id', 'DESC']]
    });

    const rooms = await Room.findAll({ order: [['name', 'ASC']] });
    const staffs = await User.findAll({
      include: [
        {
          model: Role,
          as: 'role',
          where: { name: 'Staf Laboratorium' }
        }
      ],
      order: [['name', 'ASC']]
    });

    res.render('stafflab/maintenance/index', {
      title: 'Log Maintenance - Sistem Inventaris Laboratorium',
      logs,
      rooms,
      staffs,
      selectedQ: q || '',
      selectedLabel: label || '',
      selectedRoomId: room_id || '',
      selectedStaffId: staff_id || '',
      selectedDate: date || '',
      success: req.session.success || null,
      error: req.session.error || null
    });

    req.session.success = null;
    req.session.error = null;
  } catch (error) {
    next(error);
  }
};

exports.getMaintenanceLogDetail = async (req, res, next) => {
  try {
    const log = await MaintenanceLog.findByPk(req.params.id, {
      include: [
        {
          model: Inventory,
          as: 'inventory',
          include: [
            { model: Room, as: 'room' },
            { model: ItemCategory, as: 'itemCategory' }
          ]
        },
        { model: User, as: 'staffLab' },
        { model: Bhp, as: 'bhpUsed' },
        {
          model: MaintenanceLogBhp,
          as: 'logBhps',
          include: [{ model: Bhp, as: 'bhp' }]
        }
      ]
    });

    if (!log) {
      req.session.error = 'Log maintenance tidak ditemukan.';
      return res.redirect('/stafflab/maintenance');
    }

    res.render('stafflab/maintenance/detail', {
      title: 'Detail Log Maintenance - Sistem Inventaris Laboratorium',
      log
    });
  } catch (error) {
    next(error);
  }
};

exports.getCreateMaintenanceLog = async (req, res, next) => {
  return res.redirect('/stafflab/inventories');
};

exports.postCreateMaintenanceLog = async (req, res, next) => {
  req.session.error = 'Gunakan aksi "Selesaikan Maintenance" dari halaman Kelola Inventaris.';
  return res.redirect('/stafflab/inventories');
};

// --- KELOLA INVENTARIS (KONDISI & RUANGAN SAJA) ---

exports.getInventories = async (req, res, next) => {
  try {
    const { room_id, year, label, category_id, q, condition } = req.query;

    const inventories = await findLabeledInventories({ room_id, year, label, category_id, q, condition });

    const distinctDrafts = await ProcurementDraft.findAll({
      attributes: ['year'],
      where: { status: 'Approved' },
      group: ['year'],
      order: [['year', 'DESC']]
    });
    const years = distinctDrafts.map((d) => d.year);
    const rooms = await Room.findAll({ order: [['name', 'ASC']] });
    const categories = await ItemCategory.findAll({ order: [['name', 'ASC']] });

    res.render('stafflab/inventories/index', {
      title: 'Kelola Inventaris - Sistem Inventaris Laboratorium',
      inventories,
      rooms,
      categories,
      years,
      conditions: INVENTORY_CONDITIONS,
      selectedRoomId: room_id || '',
      selectedYear: year || '',
      selectedLabel: label || '',
      selectedCategoryId: category_id || '',
      selectedQ: q || '',
      selectedCondition: condition || '',
      success: req.session.success || null,
      error: req.session.error || null
    });

    req.session.success = null;
    req.session.error = null;
  } catch (error) {
    next(error);
  }
};

exports.getScanInventory = (req, res) => {
  res.render('stafflab/inventories/scan', {
    title: 'Scan QR Inventaris - Sistem Inventaris Laboratorium',
    error: req.session.error || null
  });
  req.session.error = null;
};

exports.getInventoryLookup = async (req, res, next) => {
  try {
    const { label } = req.query;
    if (!label || !label.trim()) {
      return res.redirect('/stafflab/inventories/scan');
    }

    const inventory = await Inventory.findOne({
      where: { label_number: label.trim() }
    });

    if (!inventory) {
      req.session.error = `Inventaris dengan nomor label "${label.trim()}" tidak ditemukan.`;
      return res.redirect(`/stafflab/inventories?label=${encodeURIComponent(label.trim())}`);
    }

    return res.redirect(`/stafflab/inventories?label=${encodeURIComponent(inventory.label_number)}`);
  } catch (error) {
    next(error);
  }
};

exports.postStartMaintenance = async (req, res, next) => {
  try {
    const inventory = await Inventory.findByPk(req.params.id);
    if (!inventory) {
      req.session.error = 'Data inventaris tidak ditemukan.';
      return res.redirect('/stafflab/inventories');
    }

    if (inventory.condition === 'Maintenance') {
      req.session.error = `"${inventory.label_number}" sudah dalam status Maintenance.`;
      return res.redirect('/stafflab/inventories');
    }

    await inventory.update({ condition: 'Maintenance' });

    req.session.success = `"${inventory.label_number}" ditandai sedang maintenance. Selesaikan maintenance setelah perbaikan selesai.`;
    return res.redirect('/stafflab/inventories');
  } catch (error) {
    next(error);
  }
};

exports.getMoveRoom = async (req, res, next) => {
  try {
    const inventory = await Inventory.findByPk(req.params.id, {
      include: [{ model: Room, as: 'room' }]
    });

    if (!inventory) {
      req.session.error = 'Data inventaris tidak ditemukan.';
      return res.redirect('/stafflab/inventories');
    }

    const rooms = await Room.findAll({ order: [['name', 'ASC']] });

    res.render('stafflab/inventories/move-room', {
      title: 'Pindah Ruangan - Sistem Inventaris Laboratorium',
      inventory,
      rooms,
      error: null
    });
  } catch (error) {
    next(error);
  }
};

exports.postMoveRoom = async (req, res, next) => {
  const { room_id } = req.body;

  try {
    const inventory = await Inventory.findByPk(req.params.id);
    if (!inventory) {
      req.session.error = 'Data inventaris tidak ditemukan.';
      return res.redirect('/stafflab/inventories');
    }

    const parsedRoomId = parseInt(room_id, 10);
    const rooms = await Room.findAll({ order: [['name', 'ASC']] });

    if (!parsedRoomId) {
      return res.render('stafflab/inventories/move-room', {
        title: 'Pindah Ruangan - Sistem Inventaris Laboratorium',
        inventory: { ...inventory.toJSON(), room_id },
        rooms,
        error: 'Ruangan wajib dipilih.'
      });
    }

    const room = await Room.findByPk(parsedRoomId);
    if (!room) {
      return res.render('stafflab/inventories/move-room', {
        title: 'Pindah Ruangan - Sistem Inventaris Laboratorium',
        inventory: { ...inventory.toJSON(), room_id },
        rooms,
        error: 'Ruangan tidak ditemukan.'
      });
    }

    await inventory.update({ room_id: parsedRoomId });

    req.session.success = `"${inventory.label_number}" berhasil dipindah ke ruangan "${room.name}".`;
    return res.redirect('/stafflab/inventories');
  } catch (error) {
    next(error);
  }
};

exports.getCompleteMaintenance = async (req, res, next) => {
  try {
    const inventory = await Inventory.findByPk(req.params.id, {
      include: [{ model: Room, as: 'room' }]
    });

    if (!inventory) {
      req.session.error = 'Data inventaris tidak ditemukan.';
      return res.redirect('/stafflab/inventories');
    }

    if (inventory.condition !== 'Maintenance') {
      req.session.error = `"${inventory.label_number}" tidak dalam status Maintenance. Mulai maintenance terlebih dahulu.`;
      return res.redirect('/stafflab/inventories');
    }

    const bhps = await Bhp.findAll({ order: [['name', 'ASC']] });

    res.render('stafflab/inventories/complete-maintenance', {
      title: 'Selesaikan Maintenance - Sistem Inventaris Laboratorium',
      inventory,
      bhps,
      conditions: INVENTORY_CONDITIONS.filter((c) => c !== 'Maintenance'),
      error: null,
      formData: {
        date: new Date().toISOString().substring(0, 10),
        condition: 'Baik'
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.postCompleteMaintenance = async (req, res, next) => {
  const { description, date, condition } = req.body;

  try {
    const inventory = await Inventory.findByPk(req.params.id);
    if (!inventory) {
      req.session.error = 'Data inventaris tidak ditemukan.';
      return res.redirect('/stafflab/inventories');
    }

    const bhps = await Bhp.findAll({ order: [['name', 'ASC']] });
    const allowedConditions = INVENTORY_CONDITIONS.filter((c) => c !== 'Maintenance');

    let bhpInputs = [];
    const rawBhpIds = req.body.bhp_ids;
    const rawBhpQuantities = req.body.bhp_quantities;

    if (rawBhpIds) {
      const ids = Array.isArray(rawBhpIds) ? rawBhpIds : [rawBhpIds];
      const quantities = Array.isArray(rawBhpQuantities) ? rawBhpQuantities : [rawBhpQuantities];
      
      for (let i = 0; i < ids.length; i++) {
        const bhpId = ids[i];
        const qtyStr = quantities[i];
        if (bhpId) {
          const qty = parseInt(qtyStr, 10);
          bhpInputs.push({
            bhp_id: parseInt(bhpId, 10),
            quantity: qty
          });
        }
      }
    }

    const renderForm = (error) => res.render('stafflab/inventories/complete-maintenance', {
      title: 'Selesaikan Maintenance - Sistem Inventaris Laboratorium',
      inventory,
      bhps,
      conditions: allowedConditions,
      error,
      formData: {
        date: date || new Date().toISOString().substring(0, 10),
        condition: condition || 'Baik',
        description: description || '',
        bhpsUsed: bhpInputs.map(input => {
          const match = bhps.find(b => b.id === input.bhp_id);
          return {
            bhp_id: input.bhp_id,
            quantity: input.quantity,
            maxStock: match ? match.stock : null
          };
        })
      }
    });

    if (inventory.condition !== 'Maintenance') {
      req.session.error = `"${inventory.label_number}" tidak dalam status Maintenance.`;
      return res.redirect('/stafflab/inventories');
    }

    if (!description || !date || !condition) {
      return renderForm('Deskripsi, tanggal selesai, dan kondisi akhir wajib diisi.');
    }

    if (!allowedConditions.includes(condition)) {
      return renderForm('Kondisi akhir tidak valid. Pilih Baik atau Rusak.');
    }

    // Consolidate duplicates
    const consolidated = {};
    for (const input of bhpInputs) {
      if (isNaN(input.quantity) || input.quantity <= 0) {
        return renderForm('Jumlah BHP yang digunakan harus lebih besar dari 0.');
      }
      if (consolidated[input.bhp_id]) {
        consolidated[input.bhp_id].quantity += input.quantity;
      } else {
        consolidated[input.bhp_id] = { ...input };
      }
    }

    const finalBhpInputs = Object.values(consolidated);

    // Pre-validate stock availability
    for (const item of finalBhpInputs) {
      const bhpObj = await Bhp.findByPk(item.bhp_id);
      if (!bhpObj) {
        return renderForm('BHP yang dipilih tidak ditemukan.');
      }
      if (bhpObj.stock < item.quantity) {
        return renderForm(`Stok BHP "${bhpObj.name}" tidak mencukupi. Stok saat ini: ${bhpObj.stock} ${bhpObj.unit}.`);
      }
    }

    const transaction = await sequelize.transaction();
    try {
      // 1. Decrement stock for all used BHPs
      for (const item of finalBhpInputs) {
        const bhpObj = await Bhp.findByPk(item.bhp_id, { transaction });
        await bhpObj.decrement('stock', { by: item.quantity, transaction });
      }

      // 2. Update inventory condition
      await inventory.update({ condition }, { transaction });

      // 3. Create MaintenanceLog (fallback first BHP to legacy columns)
      const firstBhp = finalBhpInputs[0];
      const log = await MaintenanceLog.create({
        inventory_id: inventory.id,
        staff_lab_id: req.session.user.id,
        description: description.trim(),
        date: new Date(date),
        bhp_used_id: firstBhp ? firstBhp.bhp_id : null,
        bhp_quantity_used: firstBhp ? firstBhp.quantity : null,
        condition_after: condition
      }, { transaction });

      // 4. Create MaintenanceLogBhp entries
      for (const item of finalBhpInputs) {
        await MaintenanceLogBhp.create({
          maintenance_log_id: log.id,
          bhp_id: item.bhp_id,
          quantity: item.quantity
        }, { transaction });
      }

      await transaction.commit();

      req.session.success = `Maintenance "${inventory.label_number}" selesai. Kondisi akhir: ${condition}. Log tersimpan di riwayat maintenance.`;
      return res.redirect('/stafflab/maintenance');
    } catch (writeError) {
      await transaction.rollback();
      throw writeError;
    }
  } catch (error) {
    next(error);
  }
};

exports.getEditInventory = async (req, res, next) => {
  return res.redirect('/stafflab/inventories');
};

exports.postUpdateInventory = async (req, res, next) => {
  req.session.error = 'Gunakan aksi Pindah Ruangan, Ubah Status, atau Selesaikan Maintenance.';
  return res.redirect('/stafflab/inventories');
};

exports.getChangeStatus = async (req, res, next) => {
  try {
    const inventory = await Inventory.findByPk(req.params.id, {
      include: [{ model: Room, as: 'room' }]
    });

    if (!inventory) {
      req.session.error = 'Data inventaris tidak ditemukan.';
      return res.redirect('/stafflab/inventories');
    }

    res.render('stafflab/inventories/change-status', {
      title: 'Ubah Status Inventaris - Sistem Inventaris Laboratorium',
      inventory,
      conditions: INVENTORY_CONDITIONS,
      error: null
    });
  } catch (error) {
    next(error);
  }
};

exports.postChangeStatus = async (req, res, next) => {
  const { condition } = req.body;

  try {
    const inventory = await Inventory.findByPk(req.params.id);
    if (!inventory) {
      req.session.error = 'Data inventaris tidak ditemukan.';
      return res.redirect('/stafflab/inventories');
    }

    if (!condition || !INVENTORY_CONDITIONS.includes(condition)) {
      return res.render('stafflab/inventories/change-status', {
        title: 'Ubah Status Inventaris - Sistem Inventaris Laboratorium',
        inventory: { ...inventory.toJSON(), condition },
        conditions: INVENTORY_CONDITIONS,
        error: 'Kondisi inventaris tidak valid.'
      });
    }

    await inventory.update({ condition });

    req.session.success = `Status "${inventory.label_number}" diperbarui menjadi "${condition}".`;
    return res.redirect('/stafflab/inventories');
  } catch (error) {
    next(error);
  }
};
