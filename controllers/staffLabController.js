const { Op } = require('sequelize');
const { Bhp, Inventory, MaintenanceLog, User, Room, ProcurementItem, ProcurementDraft, ItemCategory, sequelize } = require('../models');

const INVENTORY_CONDITIONS = ['Baik', 'Rusak', 'Maintenance'];

async function findLabeledInventories({ room_id, year, label, category_id, q } = {}) {
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
      title: 'Kelola Stok BHP - Sistem Inventaris Laboratorium',
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

exports.getCreateBhp = async (req, res, next) => {
  res.render('stafflab/bhps/create', {
    title: 'Tambah BHP - Sistem Inventaris Laboratorium',
    error: null,
    formData: {}
  });
};

exports.postCreateBhp = async (req, res, next) => {
  const { name, unit, stock } = req.body;
  const parsedStock = parseInt(stock, 10);

  try {
    if (!name || !unit || isNaN(parsedStock) || parsedStock < 0) {
      return res.render('stafflab/bhps/create', {
        title: 'Tambah BHP - Sistem Inventaris Laboratorium',
        error: 'Semua bidang wajib diisi dengan benar. Stok tidak boleh kurang dari 0.',
        formData: { name, unit, stock }
      });
    }

    // Check duplicate name
    const existing = await Bhp.findOne({
      where: {
        name: { [Op.like]: name.trim() }
      }
    });

    if (existing) {
      return res.render('stafflab/bhps/create', {
        title: 'Tambah BHP - Sistem Inventaris Laboratorium',
        error: 'Bahan Habis Pakai (BHP) dengan nama tersebut sudah terdaftar.',
        formData: { name, unit, stock }
      });
    }

    await Bhp.create({
      name: name.trim(),
      unit: unit.trim(),
      stock: parsedStock
    });

    req.session.success = `BHP "${name}" berhasil ditambahkan dengan stok ${parsedStock}.`;
    return res.redirect('/stafflab/bhps');
  } catch (error) {
    next(error);
  }
};

exports.getEditBhp = async (req, res, next) => {
  try {
    const bhp = await Bhp.findByPk(req.params.id);
    if (!bhp) {
      req.session.error = 'Data BHP tidak ditemukan.';
      return res.redirect('/stafflab/bhps');
    }

    res.render('stafflab/bhps/edit', {
      title: 'Ubah BHP - Sistem Inventaris Laboratorium',
      bhp,
      error: null
    });
  } catch (error) {
    next(error);
  }
};

exports.postUpdateBhp = async (req, res, next) => {
  const { name, unit, stock } = req.body;
  const parsedStock = parseInt(stock, 10);

  try {
    const bhp = await Bhp.findByPk(req.params.id);
    if (!bhp) {
      req.session.error = 'Data BHP tidak ditemukan.';
      return res.redirect('/stafflab/bhps');
    }

    if (!name || !unit || isNaN(parsedStock) || parsedStock < 0) {
      return res.render('stafflab/bhps/edit', {
        title: 'Ubah BHP - Sistem Inventaris Laboratorium',
        bhp: { id: bhp.id, name, unit, stock },
        error: 'Semua bidang wajib diisi dengan benar. Stok tidak boleh kurang dari 0.'
      });
    }

    // Check duplicate name for other BHPs
    const existing = await Bhp.findOne({
      where: {
        name: { [Op.like]: name.trim() },
        id: { [Op.ne]: bhp.id }
      }
    });

    if (existing) {
      return res.render('stafflab/bhps/edit', {
        title: 'Ubah BHP - Sistem Inventaris Laboratorium',
        bhp: { id: bhp.id, name, unit, stock },
        error: 'Bahan Habis Pakai (BHP) dengan nama tersebut sudah terdaftar.'
      });
    }

    await bhp.update({
      name: name.trim(),
      unit: unit.trim(),
      stock: parsedStock
    });

    req.session.success = `BHP "${name}" berhasil diperbarui.`;
    return res.redirect('/stafflab/bhps');
  } catch (error) {
    next(error);
  }
};

exports.postDeleteBhp = async (req, res, next) => {
  try {
    const bhp = await Bhp.findByPk(req.params.id);
    if (!bhp) {
      req.session.error = 'Data BHP tidak ditemukan.';
      return res.redirect('/stafflab/bhps');
    }

    // Check if used in maintenance logs
    const usageCount = await MaintenanceLog.count({
      where: { bhp_used_id: bhp.id }
    });

    if (usageCount > 0) {
      req.session.error = `BHP "${bhp.name}" tidak dapat dihapus karena telah digunakan pada ${usageCount} log maintenance.`;
      return res.redirect('/stafflab/bhps');
    }

    await bhp.destroy();
    req.session.success = `BHP "${bhp.name}" berhasil dihapus.`;
    return res.redirect('/stafflab/bhps');
  } catch (error) {
    next(error);
  }
};

// --- LOG MAINTENANCE ---

exports.getMaintenanceLogs = async (req, res, next) => {
  try {
    const logs = await MaintenanceLog.findAll({
      include: [
        {
          model: Inventory,
          as: 'inventory',
          include: [{ model: Room, as: 'room' }]
        },
        { model: User, as: 'staffLab' },
        { model: Bhp, as: 'bhpUsed' }
      ],
      order: [['date', 'DESC'], ['id', 'DESC']]
    });

    res.render('stafflab/maintenance/index', {
      title: 'Log Maintenance - Sistem Inventaris Laboratorium',
      logs,
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
        { model: Bhp, as: 'bhpUsed' }
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
    const { room_id, year, label, category_id, q } = req.query;

    const inventories = await findLabeledInventories({ room_id, year, label, category_id, q });

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
      selectedRoomId: room_id || '',
      selectedYear: year || '',
      selectedLabel: label || '',
      selectedCategoryId: category_id || '',
      selectedQ: q || '',
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
  const { description, date, condition, bhp_used_id, bhp_quantity_used } = req.body;

  try {
    const inventory = await Inventory.findByPk(req.params.id);
    if (!inventory) {
      req.session.error = 'Data inventaris tidak ditemukan.';
      return res.redirect('/stafflab/inventories');
    }

    const bhps = await Bhp.findAll({ order: [['name', 'ASC']] });
    const allowedConditions = INVENTORY_CONDITIONS.filter((c) => c !== 'Maintenance');

    const renderForm = (error, formData = {}) => res.render('stafflab/inventories/complete-maintenance', {
      title: 'Selesaikan Maintenance - Sistem Inventaris Laboratorium',
      inventory,
      bhps,
      conditions: allowedConditions,
      error,
      formData: {
        date: formData.date || new Date().toISOString().substring(0, 10),
        condition: formData.condition || 'Baik',
        description: formData.description || '',
        bhp_used_id: formData.bhp_used_id || '',
        bhp_quantity_used: formData.bhp_quantity_used || ''
      }
    });

    if (inventory.condition !== 'Maintenance') {
      req.session.error = `"${inventory.label_number}" tidak dalam status Maintenance.`;
      return res.redirect('/stafflab/inventories');
    }

    if (!description || !date || !condition) {
      return renderForm('Deskripsi, tanggal selesai, dan kondisi akhir wajib diisi.', {
        description, date, condition, bhp_used_id, bhp_quantity_used
      });
    }

    if (!allowedConditions.includes(condition)) {
      return renderForm('Kondisi akhir tidak valid. Pilih Baik atau Rusak.', {
        description, date, condition, bhp_used_id, bhp_quantity_used
      });
    }

    let parsedBhpUsedId = null;
    let parsedBhpQuantityUsed = null;
    let bhp = null;

    if (bhp_used_id) {
      parsedBhpUsedId = parseInt(bhp_used_id, 10);
      parsedBhpQuantityUsed = parseInt(bhp_quantity_used, 10);

      if (isNaN(parsedBhpQuantityUsed) || parsedBhpQuantityUsed <= 0) {
        return renderForm('Jumlah BHP yang digunakan harus lebih besar dari 0.', {
          description, date, condition, bhp_used_id, bhp_quantity_used
        });
      }

      bhp = await Bhp.findByPk(parsedBhpUsedId);
      if (!bhp) {
        return renderForm('BHP yang dipilih tidak ditemukan.', {
          description, date, condition, bhp_used_id, bhp_quantity_used
        });
      }

      if (bhp.stock < parsedBhpQuantityUsed) {
        return renderForm(`Stok BHP "${bhp.name}" tidak mencukupi. Stok saat ini: ${bhp.stock} ${bhp.unit}.`, {
          description, date, condition, bhp_used_id, bhp_quantity_used
        });
      }
    }

    const transaction = await sequelize.transaction();
    try {
      if (bhp) {
        await bhp.decrement('stock', { by: parsedBhpQuantityUsed, transaction });
      }

      await inventory.update({ condition }, { transaction });

      await MaintenanceLog.create({
        inventory_id: inventory.id,
        staff_lab_id: req.session.user.id,
        description: description.trim(),
        date: new Date(date),
        bhp_used_id: parsedBhpUsedId,
        bhp_quantity_used: parsedBhpQuantityUsed,
        condition_after: condition
      }, { transaction });

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
  req.session.error = 'Gunakan aksi Pindah Ruangan atau Selesaikan Maintenance.';
  return res.redirect('/stafflab/inventories');
};
