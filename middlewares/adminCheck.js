module.exports = (req, res, next) => {
  if (req.session && req.session.user && req.session.user.role === 'Administrator') {
    return next();
  }
  const err = new Error('Akses ditolak. Halaman ini hanya dapat diakses oleh Administrator.');
  err.status = 403;
  return next(err);
};
