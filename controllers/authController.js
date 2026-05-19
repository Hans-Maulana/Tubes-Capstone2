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
 * Show the registration form
 */
exports.getRegister = async (req, res, next) => {
  try {
    // If user is already logged in, redirect to dashboard
    if (req.session && req.session.user) {
      return res.redirect('/dashboard');
    }

    // Daftar role dari database
    const roles = await Role.findAll();

    return res.render('auth/register', {
      title: 'Register - Sistem Inventaris Laboratorium',
      roles,
      error: null
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Handle registration form submission
 */
exports.postRegister = async (req, res, next) => {
  const { name, email, password, role_id } = req.body;

  try {
    // Ambil daftar roles untuk di-render ulang jika form error
    const roles = await Role.findAll();

    if (!name || !email || !password || !role_id) {
      return res.render('auth/register', {
        title: 'Register - Sistem Inventaris Laboratorium',
        roles,
        error: 'Semua field wajib diisi.'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.render('auth/register', {
        title: 'Register - Sistem Inventaris Laboratorium',
        roles,
        error: 'Email sudah terdaftar. Silakan gunakan email lain.'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user with Sequelize
    await User.create({
      name,
      email,
      password: hashedPassword,
      role_id // Menyimpan ID Role
    });

    // Redirect to login page on success
    return res.redirect('/auth/login');
  } catch (error) {
    console.error('[Register Error]:', error);
    return res.render('auth/register', {
      title: 'Register - Sistem Inventaris Laboratorium',
      roles,
      error: 'Terjadi kesalahan sistem saat mendaftar. Silakan coba lagi.'
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
