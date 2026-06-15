const { Op } = require('sequelize');
const { ProcurementDraft, ProcurementItem, ProcurementReceipt, Inventory, InventoryReplacement, User, Bhp, Room, ItemCategory, ProcurementItemReplacement, sequelize } = require('../models');
const QRCode = require('qrcode');
const { generateNextLabelNumber, generateLabelNumbers } = require('../utils/inventoryLabel');
const { getInventoryReplacementIncludes } = require('../utils/inventoryReplacementInclude');
const notificationService = require('../services/notificationService');

const INVENTORY_CONDITIONS = new Set(['Baik', 'Rusak', 'Maintenance']);

async function buildReplacementContext(item) {
  const targets = (item.replacementTargets || []).slice().sort((a, b) => a.id - b.id);
  const hasLegacy = Boolean(item.replacement_inventory_id);
  if (targets.length === 0 && !hasLegacy) {
    return {
      isReplacement: false,
      targets: [],
      pendingTargets: [],
      pendingCount: 0,
      linkedCount: 0,
      totalTargets: 0,
      suggestedRoomId: null,
      replacementReason: null
    };
  }

  const oldIds = targets.map((t) => t.inventory_id).filter(Boolean);
  if (hasLegacy && !oldIds.includes(item.replacement_inventory_id)) {
    oldIds.push(item.replacement_inventory_id);
  }

  const linkedRows = oldIds.length > 0
    ? await InventoryReplacement.findAll({
      where: { old_inventory_id: oldIds },
      attributes: ['old_inventory_id']
    })
    : [];
  const linkedSet = new Set(linkedRows.map((r) => r.old_inventory_id));

  const pendingTargets = targets.filter((t) => !linkedSet.has(t.inventory_id));
  const linkedCount = targets.filter((t) => linkedSet.has(t.inventory_id)).length
    + (hasLegacy && linkedSet.has(item.replacement_inventory_id) && !targets.some((t) => t.inventory_id === item.replacement_inventory_id) ? 1 : 0);

  const firstPending = pendingTargets[0];
  const suggestedRoomId = firstPending && firstPending.inventory
    ? firstPending.inventory.room_id
    : null;

  return {
    isReplacement: true,
    targets,
    pendingTargets,
    pendingCount: pendingTargets.length + (
      hasLegacy
      && !linkedSet.has(item.replacement_inventory_id)
      && !targets.some((t) => t.inventory_id === item.replacement_inventory_id)
        ? 1
        : 0
    ),
    linkedCount,
    totalTargets: Math.max(targets.length, hasLegacy ? 1 : 0),
    suggestedRoomId,
    replacementReason: item.replacement_reason || null
  };
}

async function loadCreateInventoryFormData(item, formData = {}) {
  const progress = getLabelProgress(item);
  const rooms = await Room.findAll({ order: [['name', 'ASC']] });
  const categories = await ItemCategory.findAll({ order: [['name', 'ASC']] });
  const draftYear = item.draft ? item.draft.year : new Date().getFullYear();
  const suggestedLabel = await generateNextLabelNumber(draftYear);
  const replacementContext = await buildReplacementContext(item);

  const resolvedFormData = { ...formData };
  if (replacementContext.suggestedRoomId && !resolvedFormData.room_id) {
    resolvedFormData.room_id = String(replacementContext.suggestedRoomId);
  }

  return {
    progress,
    rooms,
    categories,
    suggestedLabel,
    draftYear,
    replacementContext,
    formData: resolvedFormData
  };
}

async function generateQrDataUrl(_req, labelNumber) {
  const payload = String(labelNumber || '').trim();
  return QRCode.toDataURL(payload, {
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
      { model: ProcurementReceipt, as: 'receipts' },
      {
        model: ProcurementItemReplacement,
        as: 'replacementTargets',
        include: [{
          model: Inventory,
          as: 'inventory',
          include: [{ model: Room, as: 'room' }]
        }]
      }
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
      { model: ProcurementReceipt, as: 'receipts' },
      { model: ProcurementItemReplacement, as: 'replacementTargets', required: false }
    ],
    order: [[{ model: ProcurementDraft, as: 'draft' }, 'year', 'DESC'], ['id', 'DESC']]
  });

  const entries = items
    .map((item) => {
      const labeled = item.receivedInventories ? item.receivedInventories.length : 0;
      const received = getReceivedTotal(item);
      const approved = Number(item.quantity || 0);
      const remaining = Math.max(received - labeled, 0);
      const replacementTargetCount = (item.replacementTargets || []).length;
      const isReplacement = replacementTargetCount > 0
        || Boolean(item.replacement_reason)
        || Boolean(item.replacement_inventory_id);
      return { item, labeled, received, approved, remaining, isReplacement, replacementTargetCount };
    })
    .filter((entry) => entry.received > 0 && entry.remaining > 0);

  const replacementItemIds = entries
    .filter((e) => e.isReplacement)
    .map((e) => e.item.id);
  if (replacementItemIds.length === 0) return entries;

  const allTargets = entries
    .filter((e) => e.isReplacement)
    .flatMap((e) => (e.item.replacementTargets || []).map((t) => t.inventory_id));

  const linkedRows = allTargets.length > 0
    ? await InventoryReplacement.findAll({
      where: { old_inventory_id: allTargets },
      attributes: ['old_inventory_id']
    })
    : [];
  const linkedSet = new Set(linkedRows.map((r) => r.old_inventory_id));

  return entries.map((entry) => {
    if (!entry.isReplacement) return entry;
    const pendingReplacementCount = (entry.item.replacementTargets || [])
      .filter((t) => !linkedSet.has(t.inventory_id)).length;
    return { ...entry, pendingReplacementCount };
  });
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

    // Hapus data replacement targets terkait terlebih dahulu untuk menghindari error foreign key constraint
    await ProcurementItemReplacement.destroy({
      where: { procurement_item_id: item.id }
    });

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
      today: new Date().toISOString().substring(0, 10),
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

  const transaction = await sequelize.transaction();
  try {
    const item = await ProcurementItem.findOne({
      where: {
        id: req.params.itemId,
        status: 'Approved'
      },
      include: [
        {
          model: ProcurementDraft,
          as: 'draft',
          where: { status: 'Approved' },
          include: [{ model: User, as: 'labHead' }]
        },
        { model: ProcurementReceipt, as: 'receipts' }
      ],
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!item || Number(item.draft_id) !== Number(req.params.id)) {
      await transaction.rollback();
      req.session.error = 'Item pengadaan tidak ditemukan atau belum disetujui.';
      return res.redirect(`/administration/procurements/${req.params.id}`);
    }

    if (!received_date || !quantity || quantity < 1) {
      await transaction.rollback();
      req.session.error = 'Tanggal penerimaan dan jumlah diterima wajib diisi dengan benar.';
      return res.redirect(`/administration/procurements/${req.params.id}`);
    }

    const receivedTotal = (item.receipts || []).reduce(
      (total, receipt) => total + Number(receipt.quantity_received || 0),
      0
    );
    const remaining = Number(item.quantity || 0) - receivedTotal;

    if (quantity > remaining) {
      await transaction.rollback();
      req.session.error = `Jumlah diterima melebihi sisa barang. Sisa saat ini: ${remaining}.`;
      return res.redirect(`/administration/procurements/${req.params.id}`);
    }

    await ProcurementReceipt.create({
      procurement_item_id: item.id,
      received_date,
      quantity_received: quantity,
      admin_staff_id: req.session.user.id
    }, { transaction });

    if (item.item_type === 'BHP') {
      const bhpUnit = item.unit || 'pcs';
      const [bhp] = await Bhp.findOrCreate({
        where: { name: item.item_name },
        defaults: { unit: bhpUnit, stock: 0 },
        transaction
      });
      await bhp.increment('stock', { by: quantity }, { transaction });
    }

    await transaction.commit();

    const receivedAfter = receivedTotal + quantity;
    await notificationService.notifyGoodsReceived(item, quantity, item.draft, receivedAfter);

    req.session.success = `Penerimaan ${item.item_name} berhasil dicatat.`;
    return res.redirect(`/administration/procurements/${req.params.id}`);
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

exports.getInventories = async (req, res, next) => {
  try {
    const { room_id, year, category_id, label, q } = req.query;

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

    const inventoryWhere = {};
    if (room_id) {
      inventoryWhere.room_id = parseInt(room_id, 10);
    }
    if (category_id) {
      inventoryWhere.category_id = parseInt(category_id, 10);
    }
    if (label && label.trim()) {
      inventoryWhere.label_number = { [Op.like]: `%${label.trim()}%` };
    }
    if (q && q.trim()) {
      inventoryWhere.name = { [Op.like]: `%${q.trim()}%` };
    }

    const draftWhere = { status: 'Approved' };
    if (year) {
      draftWhere.year = parseInt(year, 10);
    }

    const inventories = await Inventory.findAll({
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
      order: [['id', 'DESC']]
    });

    const distinctDrafts = await ProcurementDraft.findAll({
      attributes: ['year'],
      where: { status: 'Approved' },
      group: ['year'],
      order: [['year', 'DESC']]
    });
    const years = distinctDrafts.map(d => d.year);
    const rooms = await Room.findAll({ order: [['name', 'ASC']] });
    const categories = await ItemCategory.findAll({ order: [['name', 'ASC']] });

    res.render('administration/inventories/index', {
      title: 'Input Inventaris - Sistem Inventaris Laboratorium',
      pendingItems,
      hasAnyReceipt,
      inventories,
      rooms,
      categories,
      years,
      selectedRoomId: room_id || '',
      selectedYear: year || '',
      selectedCategoryId: category_id || '',
      selectedLabel: label || '',
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

    const formContext = await loadCreateInventoryFormData(item);

    return res.render('administration/inventories/create', {
      title: 'Input Label Inventaris - Sistem Inventaris Laboratorium',
      selectedItem: item,
      ...formContext,
      error: null,
      roomMismatchWarning: null
    });
  } catch (error) {
    next(error);
  }
};

exports.postCreateInventory = async (req, res, next) => {
  const { procurement_item_id, condition, room_id, category_id, quantity } = req.body;

  try {
    const item = await findApprovedInventarisItem(procurement_item_id);
    if (!item) {
      req.session.error = 'Item pengadaan inventaris tidak ditemukan atau belum disetujui.';
      return res.redirect('/administration/inventories');
    }

    const normalizedCondition = condition || 'Baik';
    const parsedRoomId = room_id ? parseInt(room_id, 10) : null;
    const parsedCategoryId = category_id ? parseInt(category_id, 10) : null;
    const parsedQuantity = parseInt(quantity, 10) || 1;

    const renderCreateForm = async (error, formData = {}, roomMismatchWarning = null) => {
      const formContext = await loadCreateInventoryFormData(item, formData);
      return res.render('administration/inventories/create', {
        title: 'Input Label Inventaris - Sistem Inventaris Laboratorium',
        selectedItem: item,
        ...formContext,
        error,
        roomMismatchWarning
      });
    };

    const baseFormData = {
      condition: normalizedCondition,
      room_id: room_id || '',
      category_id: category_id || '',
      quantity: parsedQuantity
    };

    if (!parsedCategoryId) {
      return renderCreateForm('Kategori barang wajib dipilih.', baseFormData);
    }

    if (!INVENTORY_CONDITIONS.has(normalizedCondition)) {
      return renderCreateForm('Kondisi inventaris tidak valid.', baseFormData);
    }

    if (!parsedRoomId) {
      return renderCreateForm('Ruangan wajib dipilih.', baseFormData);
    }

    const room = await Room.findByPk(parsedRoomId);
    if (!room) {
      return renderCreateForm('Ruangan tidak ditemukan.', baseFormData);
    }

    const itemCategory = await ItemCategory.findByPk(parsedCategoryId);
    if (!itemCategory) {
      return renderCreateForm('Kategori barang tidak ditemukan.', baseFormData);
    }

    const inventoryTotal = (item.receivedInventories || []).length;
    const receivedTotal = getReceivedTotal(item);
    const remaining = receivedTotal - inventoryTotal;

    if (receivedTotal <= 0) {
      req.session.error = 'Barang belum dicatat penerimaannya. Lakukan penerimaan barang terlebih dahulu.';
      return res.redirect('/administration/inventories');
    }

    if (remaining <= 0) {
      req.session.error = 'Jumlah label sudah sama dengan jumlah barang yang diterima.';
      return res.redirect(`/administration/inventories/create?item=${item.id}`);
    }

    if (parsedQuantity < 1) {
      return renderCreateForm('Jumlah unit minimal 1.', baseFormData);
    }

    if (parsedQuantity > remaining) {
      return renderCreateForm(`Jumlah unit melebihi sisa yang belum berlabel. Sisa saat ini: ${remaining} unit.`, baseFormData);
    }

    const replacementContext = await buildReplacementContext(item);
    let roomMismatchWarning = null;
    if (replacementContext.isReplacement && replacementContext.pendingTargets.length > 0) {
      const mismatched = replacementContext.pendingTargets
        .slice(0, parsedQuantity)
        .filter((t) => t.inventory && t.inventory.room_id && t.inventory.room_id !== parsedRoomId);
      if (mismatched.length > 0) {
        const examples = mismatched
          .map((t) => `${t.inventory.label_number || '-'} (${t.inventory.room ? t.inventory.room.name : 'tanpa ruang'})`)
          .join(', ');
        roomMismatchWarning = `Ruangan berbeda dari inventaris lama: ${examples}. Pastikan penempatan sudah benar.`;
      }
    }

    const draftYear = item.draft ? item.draft.year : new Date().getFullYear();
    const latestReceivedDate = getLatestReceivedDate(item);
    const createdLabels = [];
    let linkedInBatch = 0;

    const transaction = await sequelize.transaction();
    try {
      const lockedItem = await ProcurementItem.findOne({
        where: {
          id: item.id,
          status: 'Approved',
          item_type: { [Op.ne]: 'BHP' }
        },
        include: [
          { model: ProcurementDraft, as: 'draft', where: { status: 'Approved' } },
          { model: Inventory, as: 'receivedInventories' },
          { model: ProcurementReceipt, as: 'receipts' },
          { model: ProcurementItemReplacement, as: 'replacementTargets', required: false }
        ],
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!lockedItem) {
        await transaction.rollback();
        req.session.error = 'Item pengadaan inventaris tidak ditemukan atau belum disetujui.';
        return res.redirect('/administration/inventories');
      }

      const inventoryTotal = (lockedItem.receivedInventories || []).length;
      const receivedTotalLocked = getReceivedTotal(lockedItem);
      const remainingLocked = receivedTotalLocked - inventoryTotal;

      if (receivedTotalLocked <= 0) {
        await transaction.rollback();
        req.session.error = 'Barang belum dicatat penerimaannya. Lakukan penerimaan barang terlebih dahulu.';
        return res.redirect('/administration/inventories');
      }

      if (remainingLocked <= 0 || parsedQuantity > remainingLocked) {
        await transaction.rollback();
        req.session.error = parsedQuantity > remainingLocked
          ? `Jumlah unit melebihi sisa yang belum berlabel. Sisa saat ini: ${remainingLocked} unit.`
          : 'Jumlah label sudah sama dengan jumlah barang yang diterima.';
        return res.redirect(`/administration/inventories/create?item=${lockedItem.id}`);
      }

      const labelNumbers = await generateLabelNumbers(draftYear, parsedQuantity, transaction);
      const replacementTargets = (lockedItem.replacementTargets || []).sort((a, b) => a.id - b.id);
      const linkedReplacements = await InventoryReplacement.findAll({
        where: { old_inventory_id: replacementTargets.map((t) => t.inventory_id) },
        attributes: ['old_inventory_id'],
        transaction
      });
      const linkedOldIds = new Set(linkedReplacements.map((r) => r.old_inventory_id));
      const pendingReplacements = replacementTargets.filter((t) => !linkedOldIds.has(t.inventory_id));
      const replacementReason = lockedItem.replacement_reason
        || `Penggantian dari pengadaan tahun ${lockedItem.draft ? lockedItem.draft.year : '-'}`;
      let legacyPending = Boolean(
        lockedItem.replacement_inventory_id
        && !linkedOldIds.has(lockedItem.replacement_inventory_id)
      );

      for (let i = 0; i < labelNumbers.length; i++) {
        const label_number = labelNumbers[i];
        const qrImagePath = await generateQrDataUrl(req, label_number);

        const inventory = await Inventory.create({
          name: lockedItem.item_name,
          category: itemCategory.name,
          category_id: itemCategory.id,
          purchase_date: latestReceivedDate ? latestReceivedDate : new Date(),
          price: lockedItem.price,
          condition: normalizedCondition,
          room_id: parsedRoomId,
          procurement_item_id: lockedItem.id,
          label_number,
          qr_image_path: qrImagePath
        }, { transaction });

        const pendingReplacement = pendingReplacements[i];
        if (pendingReplacement) {
          await InventoryReplacement.create({
            old_inventory_id: pendingReplacement.inventory_id,
            new_inventory_id: inventory.id,
            date: new Date(),
            reason: replacementReason
          }, { transaction });
          linkedOldIds.add(pendingReplacement.inventory_id);
          linkedInBatch += 1;
        } else if (legacyPending) {
          await InventoryReplacement.create({
            old_inventory_id: lockedItem.replacement_inventory_id,
            new_inventory_id: inventory.id,
            date: new Date(),
            reason: replacementReason
          }, { transaction });
          linkedOldIds.add(lockedItem.replacement_inventory_id);
          legacyPending = false;
          linkedInBatch += 1;
        }

        createdLabels.push(label_number);
      }

      await transaction.commit();
    } catch (writeError) {
      await transaction.rollback();
      throw writeError;
    }

    const remainingAfter = remaining - parsedQuantity;
    const labelRange = parsedQuantity === 1
      ? createdLabels[0]
      : `${createdLabels[0]} s/d ${createdLabels[createdLabels.length - 1]}`;

    const replacementNote = linkedInBatch > 0
      ? ` ${linkedInBatch} unit terhubung sebagai penggantian inventaris.`
      : '';

    if (remainingAfter > 0) {
      req.session.success = `${parsedQuantity} label (${labelRange}) berhasil dibuat di ruangan "${room.name}".${replacementNote} Sisa ${remainingAfter} unit lagi untuk "${item.item_name}".`;
      if (roomMismatchWarning) {
        req.session.error = roomMismatchWarning;
      }
      return res.redirect(`/administration/inventories/create?item=${item.id}`);
    }

    req.session.success = `${parsedQuantity} label (${labelRange}) berhasil dibuat di ruangan "${room.name}".${replacementNote} Semua unit "${item.item_name}" sudah berlabel.`;
    if (roomMismatchWarning) {
      req.session.error = roomMismatchWarning;
    }
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
    const categories = await ItemCategory.findAll({ order: [['name', 'ASC']] });

    return res.render('administration/inventories/edit', {
      title: 'Ubah Inventaris - Sistem Inventaris Laboratorium',
      inventory,
      rooms,
      categories,
      error: null
    });
  } catch (error) {
    next(error);
  }
};

exports.postUpdateInventory = async (req, res, next) => {
  const { label_number, condition, room_id, category_id, action } = req.body;

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

    const normalizedCondition = condition || inventory.condition || 'Baik';
    const parsedRoomId = room_id ? parseInt(room_id, 10) : null;
    const parsedCategoryId = category_id ? parseInt(category_id, 10) : null;
    const rooms = await Room.findAll({ order: [['name', 'ASC']] });
    const categories = await ItemCategory.findAll({ order: [['name', 'ASC']] });

    const renderEditForm = (error) => res.render('administration/inventories/edit', {
      title: 'Ubah Inventaris - Sistem Inventaris Laboratorium',
      inventory: {
        ...inventory.toJSON(),
        label_number,
        condition: normalizedCondition,
        room_id: room_id || '',
        category_id: category_id || ''
      },
      rooms,
      categories,
      error
    });

    if (!parsedCategoryId) {
      return renderEditForm('Kategori barang wajib dipilih.');
    }

    if (!INVENTORY_CONDITIONS.has(normalizedCondition)) {
      return renderEditForm('Kondisi inventaris tidak valid.');
    }

    if (!parsedRoomId) {
      return renderEditForm('Ruangan wajib dipilih.');
    }

    const room = await Room.findByPk(parsedRoomId);
    if (!room) {
      return renderEditForm('Ruangan tidak ditemukan.');
    }

    const itemCategory = await ItemCategory.findByPk(parsedCategoryId);
    if (!itemCategory) {
      return renderEditForm('Kategori barang tidak ditemukan.');
    }

    let finalLabelNumber = label_number;
    let qrImagePath = inventory.qr_image_path;

    if (action === 'regenerate') {
      const draftYear = inventory.procurementItem?.draft?.year || new Date().getFullYear();
      finalLabelNumber = await generateNextLabelNumber(draftYear);
      qrImagePath = await generateQrDataUrl(req, finalLabelNumber);
    } else {
      if (!finalLabelNumber) {
        return renderEditForm('Nomor label wajib diisi.');
      }
      if (finalLabelNumber !== inventory.label_number) {
        const existingInventory = await Inventory.findOne({ where: { label_number: finalLabelNumber } });
        if (existingInventory) {
          return renderEditForm('Nomor label sudah digunakan pada inventaris lain.');
        }
        qrImagePath = await generateQrDataUrl(req, finalLabelNumber);
      }
    }

    await inventory.update({
      label_number: finalLabelNumber,
      qr_image_path: qrImagePath,
      condition: normalizedCondition,
      room_id: parsedRoomId,
      category_id: itemCategory.id,
      category: itemCategory.name
    });

    if (action === 'regenerate') {
      req.session.success = `Nomor label berhasil di-regenerate menjadi "${finalLabelNumber}" dan QR code diperbarui.`;
    } else {
      req.session.success = 'Data inventaris berhasil diperbarui.';
    }
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

    await InventoryReplacement.destroy({
      where: {
        [Op.or]: [
          { old_inventory_id: inventory.id },
          { new_inventory_id: inventory.id }
        ]
      }
    });

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
        { model: Room, as: 'room' },
        { model: ItemCategory, as: 'itemCategory' },
        ...getInventoryReplacementIncludes(),
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
