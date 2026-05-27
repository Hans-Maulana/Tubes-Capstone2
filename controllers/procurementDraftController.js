const { Op } = require('sequelize');
const ProcurementDraft = require('../models/ProcurementDraft');
const ProcurementItem = require('../models/ProcurementItem');
const Inventory = require('../models/Inventory');
const User = require('../models/User');

function isLocked(draft) {
  return draft && ['Locked', 'Approved', 'Rejected'].includes(draft.status);
}

async function findOwnedDraft(id, userId) {
  return ProcurementDraft.findOne({
    where: { id, lab_head_id: userId },
    include: [
      { model: User, as: 'labHead' },
      {
        model: ProcurementItem,
        as: 'items',
        include: [{ model: Inventory, as: 'replacementInventory' }]
      }
    ],
    order: [[{ model: ProcurementItem, as: 'items' }, 'id', 'ASC']]
  });
}

async function getDamagedInventories() {
  return Inventory.findAll({
    where: {
      condition: {
        [Op.in]: ['Rusak', 'Maintenance']
      }
    },
    order: [['name', 'ASC']]
  });
}

exports.getDrafts = async (req, res, next) => {
  try {
    const drafts = await ProcurementDraft.findAll({
      where: { lab_head_id: req.session.user.id },
      include: [
        { model: User, as: 'labHead' },
        { model: ProcurementItem, as: 'items' }
      ],
      order: [['year', 'DESC'], ['id', 'DESC']]
    });

    res.render('procurement-drafts/index', {
      title: 'Draf Pengadaan - Sistem Inventaris Laboratorium',
      drafts,
      success: req.session.success || null,
      error: req.session.error || null
    });

    req.session.success = null;
    req.session.error = null;
  } catch (error) {
    next(error);
  }
};

exports.getCreateDraft = (req, res) => {
  res.render('procurement-drafts/create', {
    title: 'Buat Draf Pengadaan - Sistem Inventaris Laboratorium',
    currentYear: new Date().getFullYear(),
    error: null,
    formData: {}
  });
};

exports.postCreateDraft = async (req, res, next) => {
  const { year } = req.body;
  const selectedYear = parseInt(year, 10);

  try {
    if (!selectedYear || selectedYear < 2000) {
      return res.render('procurement-drafts/create', {
        title: 'Buat Draf Pengadaan - Sistem Inventaris Laboratorium',
        currentYear: new Date().getFullYear(),
        error: 'Tahun pengadaan wajib diisi dengan benar.',
        formData: { year }
      });
    }

    const existingDraft = await ProcurementDraft.findOne({
      where: {
        lab_head_id: req.session.user.id,
        year: selectedYear
      }
    });

    if (existingDraft) {
      req.session.error = `Draf pengadaan tahun ${selectedYear} sudah ada.`;
      return res.redirect('/procurement-drafts');
    }

    const draft = await ProcurementDraft.create({
      lab_head_id: req.session.user.id,
      year: selectedYear,
      status: 'Draft'
    });

    req.session.success = 'Draf pengadaan berhasil dibuat. Silakan tambahkan barang yang dibutuhkan.';
    return res.redirect(`/procurement-drafts/${draft.id}`);
  } catch (error) {
    next(error);
  }
};

exports.getDraftDetail = async (req, res, next) => {
  try {
    const draft = await findOwnedDraft(req.params.id, req.session.user.id);
    if (!draft) {
      req.session.error = 'Draf pengadaan tidak ditemukan.';
      return res.redirect('/procurement-drafts');
    }

    const damagedInventories = await getDamagedInventories();

    return res.render('procurement-drafts/detail', {
      title: `Draf Pengadaan ${draft.year} - Sistem Inventaris Laboratorium`,
      draft,
      damagedInventories,
      locked: isLocked(draft),
      success: req.session.success || null,
      error: req.session.error || null,
      formData: {}
    });
  } catch (error) {
    next(error);
  } finally {
    req.session.success = null;
    req.session.error = null;
  }
};

exports.postCreateItem = async (req, res, next) => {
  const { item_type, item_name, quantity, price, purchase_link, replacement_inventory_id } = req.body;

  try {
    const draft = await findOwnedDraft(req.params.id, req.session.user.id);
    if (!draft) {
      req.session.error = 'Draf pengadaan tidak ditemukan.';
      return res.redirect('/procurement-drafts');
    }

    if (isLocked(draft)) {
      req.session.error = 'Draf sudah terkunci dan tidak dapat diubah.';
      return res.redirect(`/procurement-drafts/${draft.id}`);
    }

    if (!item_type || !item_name || !quantity || !price) {
      req.session.error = 'Jenis, nama barang, jumlah, dan harga wajib diisi.';
      return res.redirect(`/procurement-drafts/${draft.id}`);
    }

    await ProcurementItem.create({
      draft_id: draft.id,
      item_type,
      item_name,
      quantity: parseInt(quantity, 10),
      price: parseInt(price, 10),
      purchase_link: purchase_link || null,
      replacement_inventory_id: replacement_inventory_id || null,
      status: 'Draft'
    });

    req.session.success = 'Item pengadaan berhasil ditambahkan.';
    return res.redirect(`/procurement-drafts/${draft.id}`);
  } catch (error) {
    next(error);
  }
};

exports.getEditItem = async (req, res, next) => {
  try {
    const draft = await findOwnedDraft(req.params.id, req.session.user.id);
    if (!draft) {
      req.session.error = 'Draf pengadaan tidak ditemukan.';
      return res.redirect('/procurement-drafts');
    }

    if (isLocked(draft)) {
      req.session.error = 'Draf sudah terkunci dan tidak dapat diubah.';
      return res.redirect(`/procurement-drafts/${draft.id}`);
    }

    const item = await ProcurementItem.findOne({
      where: {
        id: req.params.itemId,
        draft_id: draft.id
      }
    });

    if (!item) {
      req.session.error = 'Item pengadaan tidak ditemukan.';
      return res.redirect(`/procurement-drafts/${draft.id}`);
    }

    const damagedInventories = await getDamagedInventories();

    return res.render('procurement-drafts/edit-item', {
      title: 'Ubah Item Pengadaan - Sistem Inventaris Laboratorium',
      draft,
      item,
      damagedInventories,
      error: null
    });
  } catch (error) {
    next(error);
  }
};

exports.postUpdateItem = async (req, res, next) => {
  const { item_type, item_name, quantity, price, purchase_link, replacement_inventory_id } = req.body;

  try {
    const draft = await findOwnedDraft(req.params.id, req.session.user.id);
    if (!draft) {
      req.session.error = 'Draf pengadaan tidak ditemukan.';
      return res.redirect('/procurement-drafts');
    }

    if (isLocked(draft)) {
      req.session.error = 'Draf sudah terkunci dan tidak dapat diubah.';
      return res.redirect(`/procurement-drafts/${draft.id}`);
    }

    const item = await ProcurementItem.findOne({
      where: {
        id: req.params.itemId,
        draft_id: draft.id
      }
    });

    if (!item) {
      req.session.error = 'Item pengadaan tidak ditemukan.';
      return res.redirect(`/procurement-drafts/${draft.id}`);
    }

    if (!item_type || !item_name || !quantity || !price) {
      const damagedInventories = await getDamagedInventories();

      return res.render('procurement-drafts/edit-item', {
        title: 'Ubah Item Pengadaan - Sistem Inventaris Laboratorium',
        draft,
        item: {
          ...item.toJSON(),
          item_type,
          item_name,
          quantity,
          price,
          purchase_link,
          replacement_inventory_id
        },
        damagedInventories,
        error: 'Jenis, nama barang, jumlah, dan harga wajib diisi.'
      });
    }

    await item.update({
      item_type,
      item_name,
      quantity: parseInt(quantity, 10),
      price: parseInt(price, 10),
      purchase_link: purchase_link || null,
      replacement_inventory_id: replacement_inventory_id || null
    });

    req.session.success = 'Item pengadaan berhasil diubah.';
    return res.redirect(`/procurement-drafts/${draft.id}`);
  } catch (error) {
    next(error);
  }
};

exports.postDeleteItem = async (req, res, next) => {
  try {
    const draft = await findOwnedDraft(req.params.id, req.session.user.id);
    if (!draft) {
      req.session.error = 'Draf pengadaan tidak ditemukan.';
      return res.redirect('/procurement-drafts');
    }

    if (isLocked(draft)) {
      req.session.error = 'Draf sudah terkunci dan tidak dapat diubah.';
      return res.redirect(`/procurement-drafts/${draft.id}`);
    }

    const item = await ProcurementItem.findOne({
      where: {
        id: req.params.itemId,
        draft_id: draft.id
      }
    });

    if (!item) {
      req.session.error = 'Item pengadaan tidak ditemukan.';
      return res.redirect(`/procurement-drafts/${draft.id}`);
    }

    await item.destroy();
    req.session.success = 'Item pengadaan berhasil dihapus.';
    return res.redirect(`/procurement-drafts/${draft.id}`);
  } catch (error) {
    next(error);
  }
};

exports.postSubmitDraft = async (req, res, next) => {
  try {
    const draft = await findOwnedDraft(req.params.id, req.session.user.id);
    if (!draft) {
      req.session.error = 'Draf pengadaan tidak ditemukan.';
      return res.redirect('/procurement-drafts');
    }

    if (isLocked(draft)) {
      req.session.error = 'Draf sudah terkunci.';
      return res.redirect(`/procurement-drafts/${draft.id}`);
    }

    if (!draft.items || draft.items.length === 0) {
      req.session.error = 'Tambahkan minimal satu item sebelum mengajukan draf.';
      return res.redirect(`/procurement-drafts/${draft.id}`);
    }

    await draft.update({ status: 'Submitted' });
    req.session.success = 'Draf pengadaan berhasil diajukan.';
    return res.redirect(`/procurement-drafts/${draft.id}`);
  } catch (error) {
    next(error);
  }
};

exports.postLockDraft = async (req, res, next) => {
  try {
    const draft = await findOwnedDraft(req.params.id, req.session.user.id);
    if (!draft) {
      req.session.error = 'Draf pengadaan tidak ditemukan.';
      return res.redirect('/procurement-drafts');
    }

    if (!draft.items || draft.items.length === 0) {
      req.session.error = 'Tambahkan minimal satu item sebelum mengajukan finalisasi draf.';
      return res.redirect(`/procurement-drafts/${draft.id}`);
    }

    await draft.update({ status: 'Locked' });
    req.session.success = 'Pengajuan finalisasi draf pengadaan berhasil dikirim.';
    return res.redirect(`/procurement-drafts/${draft.id}`);
  } catch (error) {
    next(error);
  }
};

exports.getReviewDrafts = async (req, res, next) => {
  try {
    const drafts = await ProcurementDraft.findAll({
      where: {
        status: {
          [Op.in]: ['Submitted', 'Locked', 'Approved', 'Rejected']
        }
      },
      include: [
        { model: User, as: 'labHead' },
        { model: ProcurementItem, as: 'items' }
      ],
      order: [['year', 'DESC'], ['id', 'DESC']]
    });

    res.render('procurement-drafts/review-index', {
      title: 'Review Pengadaan - Sistem Inventaris Laboratorium',
      drafts,
      success: req.session.success || null,
      error: req.session.error || null
    });

    req.session.success = null;
    req.session.error = null;
  } catch (error) {
    next(error);
  }
};

exports.getReviewDraftDetail = async (req, res, next) => {
  try {
    const draft = await ProcurementDraft.findOne({
      where: {
        id: req.params.id,
        status: {
          [Op.in]: ['Submitted', 'Locked', 'Approved', 'Rejected']
        }
      },
      include: [
        { model: User, as: 'labHead' },
        {
          model: ProcurementItem,
          as: 'items',
          include: [{ model: Inventory, as: 'replacementInventory' }]
        }
      ],
      order: [[{ model: ProcurementItem, as: 'items' }, 'id', 'ASC']]
    });

    if (!draft) {
      req.session.error = 'Draf pengadaan tidak ditemukan atau belum diajukan.';
      return res.redirect('/procurement-drafts-history');
    }

    return res.render('procurement-drafts/review-detail', {
      title: `Review Draf Pengadaan ${draft.year} - Sistem Inventaris Laboratorium`,
      draft,
      success: req.session.success || null,
      error: req.session.error || null
    });
  } catch (error) {
    next(error);
  } finally {
    req.session.success = null;
    req.session.error = null;
  }
};

exports.postApproveItem = async (req, res, next) => {
  try {
    const draft = await ProcurementDraft.findOne({
      where: {
        id: req.params.id,
        status: {
          [Op.in]: ['Submitted', 'Locked']
        }
      }
    });

    if (!draft) {
      req.session.error = 'Draf tidak ditemukan, sudah difinalisasi, atau belum siap untuk direview.';
      return res.redirect(`/procurement-drafts-history/${req.params.id}`);
    }

    const item = await ProcurementItem.findOne({
      where: {
        id: req.params.itemId,
        draft_id: draft.id
      }
    });

    if (!item) {
      req.session.error = 'Item pengadaan tidak ditemukan.';
      return res.redirect(`/procurement-drafts-history/${draft.id}`);
    }

    await item.update({ status: 'Approved' });
    req.session.success = `Item "${item.item_name}" disetujui.`;
    return res.redirect(`/procurement-drafts-history/${draft.id}`);
  } catch (error) {
    next(error);
  }
};

exports.postRejectItem = async (req, res, next) => {
  try {
    const draft = await ProcurementDraft.findOne({
      where: {
        id: req.params.id,
        status: {
          [Op.in]: ['Submitted', 'Locked']
        }
      }
    });

    if (!draft) {
      req.session.error = 'Draf tidak ditemukan, sudah difinalisasi, atau belum siap untuk direview.';
      return res.redirect(`/procurement-drafts-history/${req.params.id}`);
    }

    const item = await ProcurementItem.findOne({
      where: {
        id: req.params.itemId,
        draft_id: draft.id
      }
    });

    if (!item) {
      req.session.error = 'Item pengadaan tidak ditemukan.';
      return res.redirect(`/procurement-drafts-history/${draft.id}`);
    }

    await item.update({ status: 'Rejected' });
    req.session.success = `Item "${item.item_name}" ditolak.`;
    return res.redirect(`/procurement-drafts-history/${draft.id}`);
  } catch (error) {
    next(error);
  }
};

exports.postFinalizeDraft = async (req, res, next) => {
  const { decision } = req.body;
  try {
    const draft = await ProcurementDraft.findOne({
      where: {
        id: req.params.id,
        status: 'Locked'
      },
      include: [{ model: ProcurementItem, as: 'items' }]
    });

    if (!draft) {
      req.session.error = 'Draf tidak ditemukan, sudah difinalisasi, atau belum diajukan finalisasi.';
      return res.redirect('/procurement-drafts-history');
    }

    if (!decision || !['Approved', 'Rejected'].includes(decision)) {
      req.session.error = 'Keputusan finalisasi tidak valid.';
      return res.redirect(`/procurement-drafts-history/${draft.id}`);
    }

    // Check if there are items that haven't been reviewed yet (status is still 'Draft' or null/Pending)
    const pendingItems = draft.items.filter(item => item.status === 'Draft' || !item.status || item.status === 'Pending');
    if (pendingItems.length > 0) {
      req.session.error = 'Harap setujui atau tolak semua item terlebih dahulu sebelum melakukan finalisasi.';
      return res.redirect(`/procurement-drafts-history/${draft.id}`);
    }

    await draft.update({ status: decision });
    req.session.success = `Draf pengadaan tahun ${draft.year} telah berhasil difinalisasi dengan status: ${decision === 'Approved' ? 'Disetujui' : 'Ditolak'}.`;
    return res.redirect(`/procurement-drafts-history/${draft.id}`);
  } catch (error) {
    next(error);
  }
};

