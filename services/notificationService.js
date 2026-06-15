const { Op } = require('sequelize');
const { getDamagedInventoriesForReplacement } = require('../utils/inventoryAccess');
const {
  Notification,
  User,
  Role,
  ProcurementDraft,
  ProcurementItem,
  ProcurementReceipt,
  ProcurementItemReplacement,
  Inventory,
  InventoryReplacement,
  Bhp
} = require('../models');

const LOW_STOCK_THRESHOLD = 5;
const NOTIFICATION_LIMIT = 30;
const QUEUE_PREFIX = 'queue:';

function getReceivedTotal(item) {
  return (item.receipts || []).reduce(
    (total, receipt) => total + Number(receipt.quantity_received || 0),
    0
  );
}

function isItemPendingReview(item) {
  const status = item.status;
  return !status || status === 'Draft' || status === 'Pending';
}

async function getUserIdsByRole(roleName) {
  const role = await Role.findOne({ where: { name: roleName } });
  if (!role) return [];
  const users = await User.findAll({
    where: { role_id: role.id },
    attributes: ['id']
  });
  return users.map((user) => user.id);
}

async function upsertNotification({ userId, type, title, message, link, icon, refKey }) {
  if (refKey) {
    const existing = await Notification.findOne({
      where: { user_id: userId, ref_key: refKey }
    });
    if (existing) {
      await existing.update({
        type,
        title,
        message,
        link,
        icon,
        read_at: null
      });
      return existing;
    }
  }

  return Notification.create({
    user_id: userId,
    type,
    title,
    message,
    link,
    icon: icon || null,
    ref_key: refKey || null
  });
}

async function createNotification(payload) {
  return upsertNotification(payload);
}

async function notifyUser(userId, payload) {
  if (!userId) return null;
  return upsertNotification({ userId, ...payload });
}

async function notifyRole(roleName, payload) {
  const userIds = await getUserIdsByRole(roleName);
  const results = [];
  for (const userId of userIds) {
    results.push(await upsertNotification({ userId, ...payload }));
  }
  return results;
}

async function notifyUsers(userIds, payload) {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  const results = [];
  for (const userId of uniqueIds) {
    results.push(await upsertNotification({ userId, ...payload }));
  }
  return results;
}

async function clearQueueByRefKey(refKey, roleName = null) {
  const where = { ref_key: refKey };
  if (roleName) {
    const userIds = await getUserIdsByRole(roleName);
    if (userIds.length === 0) return;
    where.user_id = { [Op.in]: userIds };
  }
  await Notification.destroy({ where });
}

async function removeStaleQueueNotifications(userId, activeRefKeys) {
  const where = {
    user_id: userId,
    ref_key: { [Op.like]: `${QUEUE_PREFIX}%` }
  };
  if (activeRefKeys.size > 0) {
    where.ref_key = {
      [Op.and]: [
        { [Op.like]: `${QUEUE_PREFIX}%` },
        { [Op.notIn]: Array.from(activeRefKeys) }
      ]
    };
  }
  await Notification.destroy({ where });
}

async function syncKaprodiQueues(userId) {
  const activeRefKeys = new Set();

  const drafts = await ProcurementDraft.findAll({
    where: { status: { [Op.in]: ['Submitted', 'Locked'] } },
    include: [
      { model: User, as: 'labHead' },
      { model: ProcurementItem, as: 'items' }
    ]
  });

  for (const draft of drafts) {
    const pendingItems = (draft.items || []).filter(isItemPendingReview);
    if (pendingItems.length > 0) {
      const refKey = `${QUEUE_PREFIX}draft-review:${draft.id}`;
      activeRefKeys.add(refKey);
      await upsertNotification({
        userId,
        type: 'draft_review',
        title: draft.status === 'Locked' ? 'Finalisasi Draf' : 'Review Pengadaan',
        message: `Draf ${draft.year} (${draft.labHead ? draft.labHead.name : 'Kalab'}): ${pendingItems.length} item belum direview.`,
        link: `/procurement-drafts-history/${draft.id}`,
        icon: 'ti ti-file-check text-warning',
        refKey
      });
    }

    if (draft.status === 'Locked') {
      const allReviewed = (draft.items || []).length > 0
        && (draft.items || []).every((item) => !isItemPendingReview(item));
      if (allReviewed) {
        const refKey = `${QUEUE_PREFIX}draft-finalize:${draft.id}`;
        activeRefKeys.add(refKey);
        await upsertNotification({
          userId,
          type: 'draft_finalize',
          title: 'Siap Finalisasi',
          message: `Semua item draf ${draft.year} sudah direview. Lakukan finalisasi draf.`,
          link: `/procurement-drafts-history/${draft.id}`,
          icon: 'ti ti-lock-check text-info',
          refKey
        });
      }
    }
  }

  await removeStaleQueueNotifications(userId, activeRefKeys);
}

async function syncAdminQueues(userId) {
  const activeRefKeys = new Set();

  const approvedItems = await ProcurementItem.findAll({
    where: { status: 'Approved' },
    include: [
      {
        model: ProcurementDraft,
        as: 'draft',
        where: { status: 'Approved' }
      },
      { model: ProcurementReceipt, as: 'receipts' },
      { model: Inventory, as: 'receivedInventories' },
      { model: ProcurementItemReplacement, as: 'replacementTargets', required: false }
    ]
  });

  const allReplacementTargetIds = approvedItems.flatMap(
    (item) => (item.replacementTargets || []).map((t) => t.inventory_id)
  );
  const linkedRows = allReplacementTargetIds.length > 0
    ? await InventoryReplacement.findAll({
      where: { old_inventory_id: allReplacementTargetIds },
      attributes: ['old_inventory_id']
    })
    : [];
  const globalLinkedSet = new Set(linkedRows.map((row) => row.old_inventory_id));

  for (const item of approvedItems) {
    const received = getReceivedTotal(item);
    const approved = Number(item.quantity || 0);
    const labeled = item.receivedInventories ? item.receivedInventories.length : 0;
    const draftId = item.draft_id;

    if (received < approved) {
      const refKey = `${QUEUE_PREFIX}receipt:item:${item.id}`;
      activeRefKeys.add(refKey);
      await upsertNotification({
        userId,
        type: 'receipt_needed',
        title: 'Input Penerimaan',
        message: `"${item.item_name}": ${received}/${approved} unit sudah diterima. Sisa ${approved - received} unit.`,
        link: `/administration/procurements/${draftId}`,
        icon: 'ti ti-truck-delivery text-primary',
        refKey
      });
    }

    if (item.item_type !== 'BHP' && received > labeled) {
      const refKey = `${QUEUE_PREFIX}label:item:${item.id}`;
      activeRefKeys.add(refKey);
      await upsertNotification({
        userId,
        type: 'label_needed',
        title: 'Input Label & QR',
        message: `"${item.item_name}": ${labeled}/${received} unit sudah berlabel.`,
        link: `/administration/inventories/create?item=${item.id}`,
        icon: 'ti ti-qrcode text-info',
        refKey
      });
    }

    const replacementTargets = item.replacementTargets || [];
    const isReplacement = replacementTargets.length > 0
      || Boolean(item.replacement_reason)
      || Boolean(item.replacement_inventory_id);

    if (isReplacement && labeled > 0) {
      const pendingCount = replacementTargets.filter((t) => !globalLinkedSet.has(t.inventory_id)).length;
      const legacyPending = Boolean(
        item.replacement_inventory_id
        && !globalLinkedSet.has(item.replacement_inventory_id)
      );
      const totalPending = pendingCount + (legacyPending ? 1 : 0);

      if (totalPending > 0) {
        const refKey = `${QUEUE_PREFIX}replacement:item:${item.id}`;
        activeRefKeys.add(refKey);
        await upsertNotification({
          userId,
          type: 'replacement_pending',
          title: 'Link Penggantian',
          message: `"${item.item_name}": ${totalPending} inventaris lama belum di-link saat input label.`,
          link: `/administration/inventories/create?item=${item.id}`,
          icon: 'ti ti-replace text-warning',
          refKey
        });
      }
    }
  }

  await removeStaleQueueNotifications(userId, activeRefKeys);
}

async function syncLabHeadQueues(userId) {
  const activeRefKeys = new Set();

  const damagedInventories = await getDamagedInventoriesForReplacement();

  if (damagedInventories.length > 0) {
    const damagedIds = damagedInventories.map((inv) => inv.id);
    const pendingReplacementTargets = await ProcurementItemReplacement.findAll({
      where: { inventory_id: damagedIds },
      include: [{
        model: ProcurementItem,
        as: 'procurementItem',
        required: true,
        include: [{
          model: ProcurementDraft,
          as: 'draft',
          required: true,
          where: { status: { [Op.in]: ['Draft', 'Submitted', 'Locked'] } }
        }]
      }]
    });
    const coveredIds = new Set(pendingReplacementTargets.map((t) => t.inventory_id));

    for (const inv of damagedInventories) {
      if (coveredIds.has(inv.id)) continue;

      const refKey = `${QUEUE_PREFIX}damaged:inv:${inv.id}`;
      activeRefKeys.add(refKey);
      await upsertNotification({
        userId,
        type: 'inventory_damaged',
        title: 'Inventaris Rusak',
        message: `${inv.name} (${inv.label_number}) perlu draf penggantian.`,
        link: `/procurement-drafts/create?replace=${inv.id}`,
        icon: 'ti ti-alert-triangle text-danger',
        refKey
      });
    }
  }

  const lowStockBhps = await Bhp.findAll({
    where: { stock: { [Op.lt]: LOW_STOCK_THRESHOLD } },
    order: [['stock', 'ASC']]
  });

  for (const bhp of lowStockBhps) {
    const refKey = `${QUEUE_PREFIX}bhp:${bhp.id}`;
    activeRefKeys.add(refKey);
    await upsertNotification({
      userId,
      type: 'bhp_low_stock',
      title: 'Stok BHP Kritis',
      message: `${bhp.name}: tersisa ${bhp.stock} ${bhp.unit}.`,
      link: '/stafflab/bhps',
      icon: 'ti ti-alert-circle text-danger',
      refKey
    });
  }

  await removeStaleQueueNotifications(userId, activeRefKeys);
}

async function syncStaffLabQueues(userId) {
  const activeRefKeys = new Set();

  const lowStockBhps = await Bhp.findAll({
    where: { stock: { [Op.lt]: LOW_STOCK_THRESHOLD } },
    order: [['stock', 'ASC']]
  });

  for (const bhp of lowStockBhps) {
    const refKey = `${QUEUE_PREFIX}bhp:${bhp.id}`;
    activeRefKeys.add(refKey);
    await upsertNotification({
      userId,
      type: 'bhp_low_stock',
      title: 'Stok BHP Tipis',
      message: `${bhp.name}: tersisa ${bhp.stock} ${bhp.unit}.`,
      link: '/stafflab/bhps',
      icon: 'ti ti-alert-circle text-danger',
      refKey
    });
  }

  const maintenanceInventories = await Inventory.findAll({
    where: { condition: 'Maintenance' },
    order: [['updated_at', 'DESC']]
  });

  for (const inv of maintenanceInventories) {
    const refKey = `${QUEUE_PREFIX}maintenance:inv:${inv.id}`;
    activeRefKeys.add(refKey);
    await upsertNotification({
      userId,
      type: 'inventory_maintenance',
      title: 'Maintenance Aktif',
      message: `${inv.name} (${inv.label_number}) masih dalam maintenance.`,
      link: `/stafflab/inventories?condition=Maintenance`,
      icon: 'ti ti-tool text-warning',
      refKey
    });
  }

  await removeStaleQueueNotifications(userId, activeRefKeys);
}

async function syncQueueNotifications(sessionUser) {
  if (!sessionUser || !sessionUser.id) return;

  const role = sessionUser.role;
  if (role === 'Ketua Program Studi') {
    await syncKaprodiQueues(sessionUser.id);
  } else if (role === 'Staf Administrasi') {
    await syncAdminQueues(sessionUser.id);
  } else if (role === 'Kepala Laboratorium') {
    await syncLabHeadQueues(sessionUser.id);
  } else if (role === 'Staf Laboratorium') {
    await syncStaffLabQueues(sessionUser.id);
  }
}

async function getUnreadForUser(userId, limit = NOTIFICATION_LIMIT) {
  const notifications = await Notification.findAll({
    where: { user_id: userId, read_at: null },
    order: [['created_at', 'DESC']],
    limit
  });

  const unreadCount = await Notification.count({
    where: { user_id: userId, read_at: null }
  });

  return { notifications, unreadCount };
}

async function markAsRead(notificationId, userId) {
  const notification = await Notification.findOne({
    where: { id: notificationId, user_id: userId }
  });
  if (!notification) return null;
  if (!notification.read_at) {
    await notification.update({ read_at: new Date() });
  }
  return notification;
}

async function markAllAsRead(userId) {
  await Notification.update(
    { read_at: new Date() },
    { where: { user_id: userId, read_at: null } }
  );
}

// --- Event helpers ---

async function notifyDraftSubmitted(draft) {
  const labHeadName = draft.labHead ? draft.labHead.name : 'Kepala Laboratorium';
  await notifyRole('Ketua Program Studi', {
    type: 'draft_submitted',
    title: 'Draf Pengadaan Diajukan',
    message: `Draf pengadaan ${draft.year} dari ${labHeadName} menunggu review.`,
    link: `/procurement-drafts-history/${draft.id}`,
    icon: 'ti ti-file-upload text-warning',
    refKey: `event:draft-submitted:${draft.id}`
  });
}

async function notifyDraftLocked(draft) {
  const labHeadName = draft.labHead ? draft.labHead.name : 'Kepala Laboratorium';
  await notifyRole('Ketua Program Studi', {
    type: 'draft_locked',
    title: 'Pengajuan Finalisasi',
    message: `Draf ${draft.year} dari ${labHeadName} menunggu finalisasi.`,
    link: `/procurement-drafts-history/${draft.id}`,
    icon: 'ti ti-lock text-info',
    refKey: `event:draft-locked:${draft.id}`
  });
}

async function notifyItemRejected(draft, item) {
  if (!draft.lab_head_id) return;
  await notifyUser(draft.lab_head_id, {
    type: 'item_rejected',
    title: 'Item Ditolak',
    message: `Item "${item.item_name}" pada draf ${draft.year} ditolak Kaprodi.`,
    link: `/procurement-drafts/${draft.id}`,
    icon: 'ti ti-x text-danger',
    refKey: `event:item-rejected:${item.id}`
  });
}

async function notifyDraftFinalized(draft, decision) {
  if (!draft.lab_head_id) return;

  const isApproved = decision === 'Approved';
  await notifyUser(draft.lab_head_id, {
    type: isApproved ? 'draft_approved' : 'draft_rejected',
    title: isApproved ? 'Draf Disetujui' : 'Draf Ditolak',
    message: isApproved
      ? `Draf pengadaan ${draft.year} telah disetujui Kaprodi.`
      : `Draf pengadaan ${draft.year} ditolak Kaprodi.`,
    link: `/procurement-drafts/${draft.id}`,
    icon: isApproved ? 'ti ti-circle-check text-success' : 'ti ti-circle-x text-danger',
    refKey: `event:draft-finalized:${draft.id}`
  });

  if (isApproved) {
    await notifyRole('Staf Administrasi', {
      type: 'procurement_ready',
      title: 'Pengadaan Disetujui',
      message: `Draf ${draft.year} disetujui. Proses penerimaan barang dapat dimulai.`,
      link: `/administration/procurements/${draft.id}`,
      icon: 'ti ti-truck-delivery text-primary',
      refKey: `event:procurement-ready:${draft.id}`
    });
  }
}

async function notifyGoodsReceived(item, quantity, draft, receivedAfter = null) {
  if (!draft || !draft.lab_head_id) return;
  const totalReceived = receivedAfter != null ? receivedAfter : getReceivedTotal(item);
  await notifyUser(draft.lab_head_id, {
    type: 'goods_received',
    title: 'Barang Diterima',
    message: `${quantity} unit "${item.item_name}" dicatat oleh Staf Administrasi.`,
    link: '/procurement-drafts',
    icon: 'ti ti-package text-info',
    refKey: `event:goods-received:${item.id}:${totalReceived}`
  });
}

async function notifyMaintenanceCompleted(log, inventory, staffName) {
  await notifyRole('Kepala Laboratorium', {
    type: 'maintenance_completed',
    title: 'Maintenance Selesai',
    message: `${inventory.name} (${inventory.label_number}) selesai oleh ${staffName}. Kondisi: ${log.condition_after || '-'}.`,
    link: `/stafflab/maintenance/${log.id}`,
    icon: 'ti ti-tool text-success',
    refKey: `event:maintenance-done:${log.id}`
  });
}

async function notifyInventoryDamaged(inventory) {
  await notifyRole('Kepala Laboratorium', {
    type: 'inventory_damaged',
    title: 'Laporan Inventaris Rusak',
    message: `${inventory.name} (${inventory.label_number}) dilaporkan rusak.`,
    link: `/procurement-drafts/create?replace=${inventory.id}`,
    icon: 'ti ti-alert-triangle text-danger',
    refKey: `${QUEUE_PREFIX}damaged:inv:${inventory.id}`
  });
}

async function notifyUserCreated(newUser, roleName, creatorId = null) {
  const adminIds = (await getUserIdsByRole('Administrator')).filter((id) => id !== creatorId);
  for (const userId of adminIds) {
    await upsertNotification({
      userId,
      type: 'user_created',
      title: 'Pengguna Baru',
      message: `${newUser.name} (${roleName}) berhasil ditambahkan.`,
      link: '/users',
      icon: 'ti ti-user-plus text-primary'
    });
  }
}

module.exports = {
  LOW_STOCK_THRESHOLD,
  syncQueueNotifications,
  getUnreadForUser,
  markAsRead,
  markAllAsRead,
  notifyUser,
  notifyRole,
  notifyUsers,
  createNotification,
  clearQueueByRefKey,
  notifyDraftSubmitted,
  notifyDraftLocked,
  notifyItemRejected,
  notifyDraftFinalized,
  notifyGoodsReceived,
  notifyMaintenanceCompleted,
  notifyInventoryDamaged,
  notifyUserCreated
};
