const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Role = require('../models/Role');

exports.getLogin = (req, res) => {
  if (req.session && req.session.user) {
    return res.redirect('/dashboard');
  }
  return res.render('auth/login', {
    title: 'Login - Sistem Inventaris Laboratorium',
    error: null,
    csrfToken: res.locals.csrfToken
  });
};

exports.postLogin = async (req, res, next) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.render('auth/login', {
        title: 'Login - Sistem Inventaris Laboratorium',
        error: 'Email dan password wajib diisi.',
        csrfToken: res.locals.csrfToken
      });
    }

    const user = await User.findOne({
      where: { email },
      include: [{ model: Role, as: 'role' }]
    });

    if (!user) {
      return res.render('auth/login', {
        title: 'Login - Sistem Inventaris Laboratorium',
        error: 'Email atau password salah.',
        csrfToken: res.locals.csrfToken
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.render('auth/login', {
        title: 'Login - Sistem Inventaris Laboratorium',
        error: 'Email atau password salah.',
        csrfToken: res.locals.csrfToken
      });
    }

    const sessionUser = {
      id: user.id,
      name: user.name,
      role: user.role ? user.role.name : 'Unknown',
      email: user.email
    };

    req.session.regenerate((regenerateErr) => {
      if (regenerateErr) {
        return next(regenerateErr);
      }
      req.session.user = sessionUser;
      return req.session.save((saveErr) => {
        if (saveErr) return next(saveErr);
        return res.redirect('/dashboard');
      });
    });
  } catch (error) {
    console.error('[Login Error]:', error);
    return res.render('auth/login', {
      title: 'Login - Sistem Inventaris Laboratorium',
      error: 'Terjadi kesalahan sistem. Silakan coba beberapa saat lagi.',
      csrfToken: res.locals.csrfToken
    });
  }
};

exports.postLogout = (req, res, next) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('[Logout Error]:', err);
      return next(err);
    }
    res.clearCookie('connect.sid');
    return res.redirect('/auth/login');
  });
};

exports.logout = (req, res) => {
  res.status(405).render('auth/unauthorized', {
    title: '405 Method Not Allowed',
    message: 'Logout harus menggunakan metode POST.'
  });
};
