const { Op } = require('sequelize');
const { ProcurementDraft, ProcurementItem, ProcurementReceipt, Inventory, InventoryReplacement, User, Bhp, Room } = require('../models');
const QRCode = require('qrcode');

const INVENTORY_CONDITIONS = new Set(['Baik', 'Rusak', 'Maintenance']);

async function generateQrDataUrl(req, labelNumber) {
  const scanUrl = `${req.protocol}://${req.get('host')}/inventory-label/${encodeURIComponent(labelNumber)}`;
  return QRCode.toDataURL(scanUrl, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 320
  });
}

async function findApprovedInventarisItem(itemId) {
  return ProcurementItem.findOne({
    where: {
      id: itemId,
      item_type: { [Op.ne]: 'BHP' },
      status: 'Approved'
    },
    include: [
      {
        model: ProcurementDraft,
        as: 'draft',
        where: { status: 'Approved' }
      },
      { model: Inventory, as: 'receivedInventories' },
      { model: ProcurementReceipt, as: 'receipts' }
    ]
  });
}

function getReceivedTotal(item) {
  return (item.receipts || []).reduce((sum, receipt) => sum + Number(receipt.quantity_received || 0), 0);
}

function getLatestReceivedDate(item) {
  const receipts = item.receipts || [];
  if (receipts.length === 0) return null;
  const latest = receipts.reduce((acc, r) => {
    if (!r || !r.received_date) return acc;
    const d = new Date(r.received_date);
    return !acc || d > acc ? d : acc;
  }, null);
  return latest ? latest : null;
}

async function getEligibleInventarisItems() {
  const items = await ProcurementItem.findAll({
    where: {
      item_type: { [Op.ne]: 'BHP' },
      status: 'Approved'
    },
    include: [
      {
        model: ProcurementDraft,
        as: 'draft',
        where: { status: 'Approved' }
      },
      { model: Inventory, as: 'receivedInventories' },
      { model: ProcurementReceipt, as: 'receipts' }
    ],
    order: [[{ model: ProcurementDraft, as: 'draft' }, 'year', 'DESC'], ['id', 'DESC']]
  });

  return items
    .map((item) => {
      const labeled = item.receivedInventories ? item.receivedInventories.length : 0;
      const received = getReceivedTotal(item);
      const approved = Number(item.quantity || 0);
      const remaining = Math.max(received - labeled, 0);
      return { item, labeled, received, approved, remaining };
    })
    .filter((entry) => entry.received > 0 && entry.remaining > 0);
}

function getLabelProgress(item) {
  const labeled = item.receivedInventories ? item.receivedInventories.length : 0;
  const received = getReceivedTotal(item);
  const approved = Number(item.quantity || 0);
  return {
    labeled,
    received,
    approved,
    total: received,
    remaining: Math.max(received - labeled, 0),
    nextUnit: labeled + 1
  };
}

async function findApprovedItem(itemId) {
  return ProcurementItem.findOne({
    where: {
      id: itemId,
      status: 'Approved'
    },
    include: [
      {
        model: ProcurementDraft,
        as: 'draft',
        where: { status: 'Approved' },
        include: [{ model: User, as: 'labHead' }]
      },
      { model: ProcurementReceipt, as: 'receipts' },
      { model: Inventory, as: 'receivedInventories' },
      { model: Inventory, as: 'replacementInventory' }
    ]
  });
}

exports.getApprovedDrafts = async (req, res, next) => {
  try {
    const drafts = await ProcurementDraft.findAll({
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

    res.render('administration/procurements/index', {
      title: 'Administrasi Pengadaan - Sistem Inventaris Laboratorium',
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

exports.getProcurementItems = async (req, res, next) => {
  try {
    const items = await ProcurementItem.findAll({
      where: { status: 'Approved' },
      include: [
        {
          model: ProcurementDraft,
          as: 'draft',
          where: { status: 'Approved' },
          include: [{ model: User, as: 'labHead' }]
        },
        { model: ProcurementReceipt, as: 'receipts' },
        { model: Inventory, as: 'receivedInventories' }
      ],
      order: [[{ model: ProcurementDraft, as: 'draft' }, 'year', 'DESC'], ['id', 'DESC']]
    });

    res.render('administration/procurement-items/index', {
      title: 'Item Pengadaan - Sistem Inventaris Laboratorium',
      items,
      success: req.session.success || null,
      error: req.session.error || null
    });

    req.session.success = null;
    req.session.error = null;
  } catch (error) {
    next(error);
  }
};

exports.getEditProcurementItem = async (req, res, next) => {
  try {
    const item = await findApprovedItem(req.params.itemId);
    if (!item) {
      req.session.error = 'Item pengadaan tidak ditemukan atau belum disetujui.';
      return res.redirect('/administration/procurement-items');
    }

    return res.render('administration/procurement-items/edit', {
      title: 'Ubah Item Pengadaan - Sistem Inventaris Laboratorium',
      item,
      error: null
    });
  } catch (error) {
    next(error);
  }
};

exports.postUpdateProcurementItem = async (req, res, next) => {
  const { item_type, item_name, quantity, price, purchase_link } = req.body;

  try {
    const item = await findApprovedItem(req.params.itemId);
    if (!item) {
      req.session.error = 'Item pengadaan tidak ditemukan atau belum disetujui.';
      return res.redirect('/administration/procurement-items');
    }

    if (!item_type || !item_name || !quantity || !price) {
      return res.render('administration/procurement-items/edit', {
        title: 'Ubah Item Pengadaan - Sistem Inventaris Laboratorium',
        item: {
          ...item.toJSON(),
          item_type,
          item_name,
          quantity,
          price,
          purchase_link
        },
        error: 'Jenis, nama barang, jumlah, dan harga wajib diisi.'
      });
    }

    const receivedTotal = (item.receipts || []).reduce((total, receipt) => total + Number(receipt.quantity_received || 0), 0);
    const labeledTotal = item.receivedInventories ? item.receivedInventories.length : 0;
    const newQuantity = parseInt(quantity, 10);

    if (newQuantity < receivedTotal || newQuantity < labeledTotal) {
      return res.render('administration/procurement-items/edit', {
        title: 'Ubah Item Pengadaan - Sistem Inventaris Laboratorium',
        item: {
          ...item.toJSON(),
          item_type,
          item_name,
          quantity,
          price,
          purchase_link
        },
        error: `Jumlah tidak boleh lebih kecil dari barang yang sudah diterima (${receivedTotal}) atau berlabel (${labeledTotal}).`
      });
    }

    await item.update({
      item_type,
      item_name,
      quantity: newQuantity,
      price: parseInt(price, 10),
      purchase_link: purchase_link || null
    });

    req.session.success = 'Item pengadaan berhasil diperbarui.';
    return res.redirect('/administration/procurement-items');
  } catch (error) {
    next(error);
  }
};

exports.postDeleteProcurementItem = async (req, res, next) => {
  try {
    const item = await findApprovedItem(req.params.itemId);
    if (!item) {
      req.session.error = 'Item pengadaan tidak ditemukan atau belum disetujui.';
      return res.redirect('/administration/procurement-items');
    }

    if ((item.receipts || []).length > 0 || (item.receivedInventories || []).length > 0) {
      req.session.error = 'Item tidak bisa dihapus karena sudah memiliki penerimaan atau inventaris berlabel.';
      return res.redirect('/administration/procurement-items');
    }

    await item.destroy();
    req.session.success = 'Item pengadaan berhasil dihapus.';
    return res.redirect('/administration/procurement-items');
  } catch (error) {
    next(error);
  }
};

exports.getApprovedDraftDetail = async (req, res, next) => {
  try {
    const draft = await ProcurementDraft.findOne({
      where: {
        id: req.params.id,
        status: 'Approved'
      },
      include: [
        { model: User, as: 'labHead' },
        {
          model: ProcurementItem,
          as: 'items',
          where: { status: 'Approved' },
          required: false,
          include: [
            { model: Inventory, as: 'replacementInventory' },
            {
              model: ProcurementReceipt,
              as: 'receipts',
              include: [{ model: User, as: 'adminStaff' }]
            }
          ]
        }
      ],
      order: [
        [{ model: ProcurementItem, as: 'items' }, 'id', 'ASC'],
        [{ model: ProcurementItem, as: 'items' }, { model: ProcurementReceipt, as: 'receipts' }, 'received_date', 'DESC']
      ]
    });

    if (!draft) {
      req.session.error = 'Draf pengadaan yang disetujui tidak ditemukan.';
      return res.redirect('/administration/procurements');
    }

    return res.render('administration/procurements/detail', {
      title: `Administrasi Pengadaan ${draft.year} - Sistem Inventaris Laboratorium`,
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

exports.postCreateReceipt = async (req, res, next) => {
  const { received_date, quantity_received } = req.body;
  const quantity = parseInt(quantity_received, 10);

  try {
    const item = await findApprovedItem(req.params.itemId);
    if (!item || Number(item.draft_id) !== Number(req.params.id)) {
      req.session.error = 'Item pengadaan tidak ditemukan atau belum disetujui.';
      return res.redirect(`/administration/procurements/${req.params.id}`);
    }

    if (!received_date || !quantity || quantity < 1) {
      req.session.error = 'Tanggal penerimaan dan jumlah diterima wajib diisi dengan benar.';
      return res.redirect(`/administration/procurements/${req.params.id}`);
    }

    const receivedTotal = (item.receipts || []).reduce((total, receipt) => total + Number(receipt.quantity_received || 0), 0);
    const remaining = Number(item.quantity || 0) - receivedTotal;

    if (quantity > remaining) {
      req.session.error = `Jumlah diterima melebihi sisa barang. Sisa saat ini: ${remaining}.`;
      return res.redirect(`/administration/procurements/${req.params.id}`);
    }

    await ProcurementReceipt.create({
      procurement_item_id: item.id,
      received_date,
      quantity_received: quantity,
      admin_staff_id: req.session.user.id
    });

    // Untuk BHP: tidak buat inventories/QR, cukup update stok di tabel bhps.
    if (item.item_type === 'BHP') {
      const [bhp] = await Bhp.findOrCreate({
        where: { name: item.item_name },
        defaults: { unit: 'pcs', stock: 0 }
      });
      await bhp.increment('stock', { by: quantity });
    }

    req.session.success = `Penerimaan ${item.item_name} berhasil dicatat.`;
    return res.redirect(`/administration/procurements/${req.params.id}`);
  } catch (error) {
    next(error);
  }
};

exports.getInventories = async (req, res, next) => {
  try {
    const pendingItems = await getEligibleInventarisItems();

    const approvedInventarisItems = await ProcurementItem.findAll({
      where: {
        item_type: { [Op.ne]: 'BHP' },
        status: 'Approved'
      },
      include: [
        { model: ProcurementDraft, as: 'draft', where: { status: 'Approved' } },
        { model: ProcurementReceipt, as: 'receipts' }
      ]
    });
    const hasAnyReceipt = approvedInventarisItems.some((item) => getReceivedTotal(item) > 0);

    const inventories = await Inventory.findAll({
      include: [
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
              where: { status: 'Approved' }
            }
          ]
        }
      ],
      order: [['id', 'DESC']]
    });

    res.render('administration/inventories/index', {
      title: 'Input Inventaris - Sistem Inventaris Laboratorium',
      pendingItems,
      hasAnyReceipt,
      inventories,
      success: req.session.success || null,
      error: req.session.error || null
    });

    req.session.success = null;
    req.session.error = null;
  } catch (error) {
    next(error);
  }
};

exports.getCreateInventory = async (req, res, next) => {
  try {
    const itemId = req.query.item;

    if (!itemId) {
      req.session.error = 'Pilih item pengadaan terlebih dahulu dari daftar Input Inventaris.';
      return res.redirect('/administration/inventories');
    }

    const item = await findApprovedInventarisItem(itemId);
    if (!item) {
      req.session.error = 'Item pengadaan inventaris tidak ditemukan atau belum disetujui.';
      return res.redirect('/administration/inventories');
    }

    const progress = getLabelProgress(item);
    if (progress.received <= 0) {
      req.session.error = `Barang "${item.item_name}" belum dicatat penerimaannya. Lakukan penerimaan barang terlebih dahulu.`;
      return res.redirect('/administration/inventories');
    }
    if (progress.remaining <= 0) {
      req.session.error = `Semua unit "${item.item_name}" yang sudah diterima sudah memiliki label.`;
      return res.redirect('/administration/inventories');
    }

    const rooms = await Room.findAll({ order: [['name', 'ASC']] });

    return res.render('administration/inventories/create', {
      title: 'Input Label Inventaris - Sistem Inventaris Laboratorium',
      selectedItem: item,
      progress,
      rooms,
      error: null,
      formData: {}
    });
  } catch (error) {
    next(error);
  }
};

exports.postCreateInventory = async (req, res, next) => {
  const { procurement_item_id, label_number, condition, room_id } = req.body;

  try {
    const item = await findApprovedInventarisItem(procurement_item_id);
    if (!item) {
      req.session.error = 'Item pengadaan inventaris tidak ditemukan atau belum disetujui.';
      return res.redirect('/administration/inventories');
    }

    const normalizedCondition = condition || 'Baik';
    const parsedRoomId = room_id ? parseInt(room_id, 10) : null;

    if (!label_number) {
      const progress = getLabelProgress(item);
      const rooms = await Room.findAll({ order: [['name', 'ASC']] });

      return res.render('administration/inventories/create', {
        title: 'Input Label Inventaris - Sistem Inventaris Laboratorium',
        selectedItem: item,
        progress,
        rooms,
        error: 'Nomor label inventaris wajib diisi.',
        formData: { label_number, condition: normalizedCondition, room_id: room_id || '' }
      });
    }

    if (!INVENTORY_CONDITIONS.has(normalizedCondition)) {
      const progress = getLabelProgress(item);
      const rooms = await Room.findAll({ order: [['name', 'ASC']] });
      return res.render('administration/inventories/create', {
        title: 'Input Label Inventaris - Sistem Inventaris Laboratorium',
        selectedItem: item,
        progress,
        rooms,
        error: 'Kondisi inventaris tidak valid.',
        formData: { label_number, condition: normalizedCondition, room_id: room_id || '' }
      });
    }

    if (!parsedRoomId) {
      const progress = getLabelProgress(item);
      const rooms = await Room.findAll({ order: [['name', 'ASC']] });
      return res.render('administration/inventories/create', {
        title: 'Input Label Inventaris - Sistem Inventaris Laboratorium',
        selectedItem: item,
        progress,
        rooms,
        error: 'Ruangan wajib dipilih.',
        formData: { label_number, condition: normalizedCondition, room_id: room_id || '' }
      });
    }

    const room = await Room.findByPk(parsedRoomId);
    if (!room) {
      const progress = getLabelProgress(item);
      const rooms = await Room.findAll({ order: [['name', 'ASC']] });
      return res.render('administration/inventories/create', {
        title: 'Input Label Inventaris - Sistem Inventaris Laboratorium',
        selectedItem: item,
        progress,
        rooms,
        error: 'Ruangan tidak ditemukan.',
        formData: { label_number, condition: normalizedCondition, room_id: room_id || '' }
      });
    }

    const inventoryTotal = (item.receivedInventories || []).length;
    const receivedTotal = getReceivedTotal(item);

    if (receivedTotal <= 0) {
      req.session.error = 'Barang belum dicatat penerimaannya. Lakukan penerimaan barang terlebih dahulu.';
      return res.redirect('/administration/inventories');
    }

    if (inventoryTotal >= receivedTotal) {
      req.session.error = 'Jumlah label sudah sama dengan jumlah barang yang diterima.';
      return res.redirect(`/administration/inventories/create?item=${item.id}`);
    }

    const existingInventory = await Inventory.findOne({ where: { label_number } });
    if (existingInventory) {
      const progress = getLabelProgress(item);

      return res.render('administration/inventories/create', {
        title: 'Input Label Inventaris - Sistem Inventaris Laboratorium',
        selectedItem: item,
        progress,
        error: 'Nomor label sudah digunakan pada inventaris lain.',
        formData: { label_number }
      });
    }

    const qrImagePath = await generateQrDataUrl(req, label_number);
    const latestReceivedDate = getLatestReceivedDate(item);

    const inventory = await Inventory.create({
      name: item.item_name,
      category: item.item_type,
      purchase_date: latestReceivedDate ? latestReceivedDate : new Date(),
      price: item.price,
      condition: normalizedCondition,
      room_id: parsedRoomId,
      procurement_item_id: item.id,
      label_number,
      qr_image_path: qrImagePath
    });

    if (item.replacement_inventory_id) {
      await InventoryReplacement.create({
        old_inventory_id: item.replacement_inventory_id,
        new_inventory_id: inventory.id,
        date: new Date(),
        reason: `Penggantian dari pengadaan tahun ${item.draft ? item.draft.year : '-'}`
      });
    }

    const unitNumber = inventoryTotal + 1;
    const remainingAfter = receivedTotal - unitNumber;

    if (remainingAfter > 0) {
      req.session.success = `Label ${label_number} untuk unit ke-${unitNumber} berhasil disimpan. Sisa ${remainingAfter} unit lagi untuk "${item.item_name}".`;
      return res.redirect(`/administration/inventories/create?item=${item.id}`);
    }

    req.session.success = `Label ${label_number} berhasil disimpan. Semua unit "${item.item_name}" sudah berlabel.`;
    return res.redirect('/administration/inventories');
  } catch (error) {
    next(error);
  }
};

exports.getEditInventory = async (req, res, next) => {
  try {
    const inventory = await Inventory.findByPk(req.params.id, {
      include: [
        {
          model: ProcurementItem,
          as: 'procurementItem',
          where: { item_type: { [Op.ne]: 'BHP' } },
          include: [{ model: ProcurementDraft, as: 'draft' }]
        }
      ]
    });

    if (!inventory || !inventory.procurementItem) {
      req.session.error = 'Data inventaris tidak ditemukan.';
      return res.redirect('/administration/inventories');
    }

    const rooms = await Room.findAll({ order: [['name', 'ASC']] });

    return res.render('administration/inventories/edit', {
      title: 'Ubah Inventaris - Sistem Inventaris Laboratorium',
      inventory,
      rooms,
      error: null
    });
  } catch (error) {
    next(error);
  }
};

exports.postUpdateInventory = async (req, res, next) => {
  const { label_number, condition, room_id } = req.body;

  try {
    const inventory = await Inventory.findByPk(req.params.id, {
      include: [
        {
          model: ProcurementItem,
          as: 'procurementItem',
          where: { item_type: { [Op.ne]: 'BHP' } }
        }
      ]
    });

    if (!inventory || !inventory.procurementItem) {
      req.session.error = 'Data inventaris tidak ditemukan.';
      return res.redirect('/administration/inventories');
    }

    const normalizedCondition = condition || inventory.condition || 'Baik';
    const parsedRoomId = room_id ? parseInt(room_id, 10) : null;
    const rooms = await Room.findAll({ order: [['name', 'ASC']] });

    if (!label_number) {
      return res.render('administration/inventories/edit', {
        title: 'Ubah Inventaris - Sistem Inventaris Laboratorium',
        inventory: { ...inventory.toJSON(), label_number, condition: normalizedCondition, room_id: room_id || '' },
        rooms,
        error: 'Nomor label wajib diisi.'
      });
    }

    if (!INVENTORY_CONDITIONS.has(normalizedCondition)) {
      return res.render('administration/inventories/edit', {
        title: 'Ubah Inventaris - Sistem Inventaris Laboratorium',
        inventory: { ...inventory.toJSON(), label_number, condition: normalizedCondition, room_id: room_id || '' },
        rooms,
        error: 'Kondisi inventaris tidak valid.'
      });
    }

    if (!parsedRoomId) {
      return res.render('administration/inventories/edit', {
        title: 'Ubah Inventaris - Sistem Inventaris Laboratorium',
        inventory: { ...inventory.toJSON(), label_number, condition: normalizedCondition, room_id: room_id || '' },
        rooms,
        error: 'Ruangan wajib dipilih.'
      });
    }

    const room = await Room.findByPk(parsedRoomId);
    if (!room) {
      return res.render('administration/inventories/edit', {
        title: 'Ubah Inventaris - Sistem Inventaris Laboratorium',
        inventory: { ...inventory.toJSON(), label_number, condition: normalizedCondition, room_id: room_id || '' },
        rooms,
        error: 'Ruangan tidak ditemukan.'
      });
    }

    if (label_number !== inventory.label_number) {
      const existingInventory = await Inventory.findOne({ where: { label_number } });
      if (existingInventory) {
        return res.render('administration/inventories/edit', {
          title: 'Ubah Inventaris - Sistem Inventaris Laboratorium',
          inventory: { ...inventory.toJSON(), label_number, condition: normalizedCondition, room_id: room_id || '' },
          rooms,
          error: 'Nomor label sudah digunakan pada inventaris lain.'
        });
      }
    }

    const qrImagePath = await generateQrDataUrl(req, label_number);

    await inventory.update({
      label_number,
      qr_image_path: qrImagePath,
      condition: normalizedCondition,
      room_id: parsedRoomId
    });

    req.session.success = 'Nomor label dan QR code berhasil diperbarui.';
    return res.redirect('/administration/inventories');
  } catch (error) {
    next(error);
  }
};

exports.postDeleteInventory = async (req, res, next) => {
  try {
    const inventory = await Inventory.findByPk(req.params.id, {
      include: [
        {
          model: ProcurementItem,
          as: 'procurementItem',
          where: { item_type: { [Op.ne]: 'BHP' } }
        }
      ]
    });

    if (!inventory || !inventory.procurementItem) {
      req.session.error = 'Data inventaris tidak ditemukan.';
      return res.redirect('/administration/inventories');
    }

    await inventory.destroy();
    req.session.success = 'Data inventaris berhasil dihapus.';
    return res.redirect('/administration/inventories');
  } catch (error) {
    next(error);
  }
};

exports.getInventoryByLabel = async (req, res, next) => {
  try {
    const inventory = await Inventory.findOne({
      where: { label_number: req.params.label },
      include: [
        {
          model: ProcurementItem,
          as: 'procurementItem',
          include: [
            {
              model: ProcurementDraft,
              as: 'draft',
              include: [{ model: User, as: 'labHead' }]
            }
          ]
        }
      ]
    });

    if (!inventory) {
      return res.status(404).render('inventories/label-detail', {
        title: 'Inventaris Tidak Ditemukan',
        inventory: null
      });
    }

    return res.render('inventories/label-detail', {
      title: `${inventory.label_number} - Detail Inventaris`,
      inventory
    });
  } catch (error) {
    next(error);
  }
};
