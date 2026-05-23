const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Role = require('../models/Role');

/**
 * Show the login form
 */
exports.getLogin = (req, res) => {
  // If user is already logged in, redirect to dashboard
  if (req.session && req.session.user) {
    return res.redirect('/dashboard');
  }
  return res.render('auth/login', {
    title: 'Login - Sistem Inventaris Laboratorium',
    error: null
  });
};

/**
 * Handle login form submission
 */
exports.postLogin = async (req, res, next) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.render('auth/login', {
        title: 'Login - Sistem Inventaris Laboratorium',
        error: 'Email dan password wajib diisi.'
      });
    }

    // Find user by email and eager load Role
    const user = await User.findOne({ 
      where: { email },
      include: [{ model: Role, as: 'role' }]
    });

    if (!user) {
      return res.render('auth/login', {
        title: 'Login - Sistem Inventaris Laboratorium',
        error: 'Email atau password salah.'
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.render('auth/login', {
        title: 'Login - Sistem Inventaris Laboratorium',
        error: 'Email atau password salah.'
      });
    }

    // Set user session data (extracting role name from associated model)
    req.session.user = {
      id: user.id,
      name: user.name,
      role: user.role ? user.role.name : 'Unknown', // Tetap dilempar sebagai string untuk kompatibilitas Pug view
      email: user.email
    };

    // Redirect to dashboard
    return res.redirect('/dashboard');
  } catch (error) {
    console.error('[Login Error]:', error);
    return res.render('auth/login', {
      title: 'Login - Sistem Inventaris Laboratorium',
      error: 'Terjadi kesalahan sistem. Silakan coba beberapa saat lagi.'
    });
  }
};

/**
 * Handle logout
 */
exports.logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('[Logout Error]:', err);
    }
    return res.redirect('/auth/login');
  });
};
