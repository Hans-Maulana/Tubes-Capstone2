module.exports = (...allowedRoles) => {
  return (req, res, next) => {
    if (req.session && req.session.user && allowedRoles.includes(req.session.user.role)) {
      return next();
    }
    const err = new Error('Forbidden - Anda tidak memiliki hak akses untuk halaman ini.');
    err.status = 403;
    return next(err);
  };
};
