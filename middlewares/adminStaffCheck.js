module.exports = (req, res, next) => {
  if (req.session && req.session.user && req.session.user.role === 'Staf Administrasi') {
    return next();
  }

  const err = new Error('Akses ditolak. Halaman ini hanya dapat diakses oleh Staf Administrasi.');
  err.status = 403;
  return next(err);
};
