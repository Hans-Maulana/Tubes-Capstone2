const notificationService = require('../services/notificationService');

const SYNC_INTERVAL_MS = 30000;
const lastSyncByUser = new Map();

function shouldSyncNotifications(userId) {
  const last = lastSyncByUser.get(userId) || 0;
  if (Date.now() - last < SYNC_INTERVAL_MS) return false;
  lastSyncByUser.set(userId, Date.now());
  return true;
}

function invalidateNotificationSync(userId) {
  if (userId) lastSyncByUser.delete(userId);
}

async function notificationMiddleware(req, res, next) {
  res.locals.notifications = [];
  res.locals.unreadNotificationCount = 0;

  if (!req.session || !req.session.user) {
    return next();
  }

  try {
    const userId = req.session.user.id;
    if (shouldSyncNotifications(userId)) {
      await notificationService.syncQueueNotifications(req.session.user);
    }
    const { notifications, unreadCount } = await notificationService.getUnreadForUser(userId);
    res.locals.notifications = notifications;
    res.locals.unreadNotificationCount = unreadCount;
  } catch (err) {
    console.error('[Notification Middleware Error]:', err);
  }

  return next();
}

module.exports = {
  notificationMiddleware,
  invalidateNotificationSync
};
