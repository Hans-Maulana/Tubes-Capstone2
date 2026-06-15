const notificationService = require('../services/notificationService');
const { safeRedirectPath } = require('../utils/safeRedirect');

exports.openNotification = async (req, res, next) => {
  try {
    const notification = await notificationService.markAsRead(
      req.params.id,
      req.session.user.id
    );

    if (notification && notification.link) {
      return res.redirect(safeRedirectPath(notification.link));
    }

    return res.redirect('/');
  } catch (error) {
    next(error);
  }
};

exports.postMarkAsRead = async (req, res, next) => {
  try {
    await notificationService.markAsRead(req.params.id, req.session.user.id);

    if (req.get('X-Requested-With') === 'XMLHttpRequest') {
      return res.json({ ok: true });
    }

    return res.redirect(safeRedirectPath(req.body.redirect, req.get('Referer') || '/'));
  } catch (error) {
    next(error);
  }
};

exports.postMarkAllAsRead = async (req, res, next) => {
  try {
    await notificationService.markAllAsRead(req.session.user.id);

    if (req.get('X-Requested-With') === 'XMLHttpRequest') {
      return res.json({ ok: true });
    }

    return res.redirect(safeRedirectPath(req.body.redirect, req.get('Referer') || '/'));
  } catch (error) {
    next(error);
  }
};
