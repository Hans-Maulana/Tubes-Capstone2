const { Op } = require('sequelize');
const { Bhp, Inventory, MaintenanceLog, User, Room, sequelize } = require('../models');

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
        { model: Inventory, as: 'inventory' },
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

exports.getCreateMaintenanceLog = async (req, res, next) => {
  try {
    const inventories = await Inventory.findAll({
      order: [['label_number', 'ASC']]
    });

    const bhps = await Bhp.findAll({
      order: [['name', 'ASC']]
    });

    res.render('stafflab/maintenance/create', {
      title: 'Catat Log Maintenance - Sistem Inventaris Laboratorium',
      inventories,
      bhps,
      error: null,
      formData: {
        date: new Date().toISOString().substring(0, 10)
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.postCreateMaintenanceLog = async (req, res, next) => {
  const { inventory_id, description, date, condition, bhp_used_id, bhp_quantity_used } = req.body;

  try {
    const inventories = await Inventory.findAll({ order: [['label_number', 'ASC']] });
    const bhps = await Bhp.findAll({ order: [['name', 'ASC']] });

    // Validasi input wajib
    if (!inventory_id || !description || !date || !condition) {
      return res.render('stafflab/maintenance/create', {
        title: 'Catat Log Maintenance - Sistem Inventaris Laboratorium',
        inventories,
        bhps,
        error: 'Inventaris, deskripsi pemeliharaan, tanggal, dan kondisi baru wajib diisi.',
        formData: { inventory_id, description, date, condition, bhp_used_id, bhp_quantity_used }
      });
    }

    const inventory = await Inventory.findByPk(inventory_id);
    if (!inventory) {
      return res.render('stafflab/maintenance/create', {
        title: 'Catat Log Maintenance - Sistem Inventaris Laboratorium',
        inventories,
        bhps,
        error: 'Barang inventaris tidak ditemukan.',
        formData: { inventory_id, description, date, condition, bhp_used_id, bhp_quantity_used }
      });
    }

    // Validasi kondisi
    if (!['Baik', 'Rusak', 'Maintenance'].includes(condition)) {
      return res.render('stafflab/maintenance/create', {
        title: 'Catat Log Maintenance - Sistem Inventaris Laboratorium',
        inventories,
        bhps,
        error: 'Kondisi inventaris tidak valid.',
        formData: { inventory_id, description, date, condition, bhp_used_id, bhp_quantity_used }
      });
    }

    let parsedBhpUsedId = null;
    let parsedBhpQuantityUsed = null;
    let bhp = null;

    if (bhp_used_id) {
      parsedBhpUsedId = parseInt(bhp_used_id, 10);
      parsedBhpQuantityUsed = parseInt(bhp_quantity_used, 10);

      if (isNaN(parsedBhpQuantityUsed) || parsedBhpQuantityUsed <= 0) {
        return res.render('stafflab/maintenance/create', {
          title: 'Catat Log Maintenance - Sistem Inventaris Laboratorium',
          inventories,
          bhps,
          error: 'Jumlah BHP yang digunakan harus lebih besar dari 0.',
          formData: { inventory_id, description, date, condition, bhp_used_id, bhp_quantity_used }
        });
      }

      bhp = await Bhp.findByPk(parsedBhpUsedId);
      if (!bhp) {
        return res.render('stafflab/maintenance/create', {
          title: 'Catat Log Maintenance - Sistem Inventaris Laboratorium',
          inventories,
          bhps,
          error: 'BHP yang dipilih tidak ditemukan.',
          formData: { inventory_id, description, date, condition, bhp_used_id, bhp_quantity_used }
        });
      }

      if (bhp.stock < parsedBhpQuantityUsed) {
        return res.render('stafflab/maintenance/create', {
          title: 'Catat Log Maintenance - Sistem Inventaris Laboratorium',
          inventories,
          bhps,
          error: `Stok BHP "${bhp.name}" tidak mencukupi. Stok saat ini: ${bhp.stock} ${bhp.unit}.`,
          formData: { inventory_id, description, date, condition, bhp_used_id, bhp_quantity_used }
        });
      }
    }

    // Start database transaction only for write operations
    const transaction = await sequelize.transaction();
    try {
      if (bhp) {
        // Kurangi stok BHP
        await bhp.decrement('stock', { by: parsedBhpQuantityUsed, transaction });
      }

      // Update kondisi inventaris
      await inventory.update({ condition }, { transaction });

      // Buat log pemeliharaan
      await MaintenanceLog.create({
        inventory_id: inventory.id,
        staff_lab_id: req.session.user.id,
        description: description.trim(),
        date: new Date(date),
        bhp_used_id: parsedBhpUsedId,
        bhp_quantity_used: parsedBhpQuantityUsed
      }, { transaction });

      await transaction.commit();

      req.session.success = `Log maintenance untuk "${inventory.name}" (${inventory.label_number}) berhasil dicatat. Kondisi diperbarui menjadi "${condition}".`;
      return res.redirect('/stafflab/maintenance');
    } catch (writeError) {
      await transaction.rollback();
      throw writeError;
    }
  } catch (error) {
    next(error);
  }
};
