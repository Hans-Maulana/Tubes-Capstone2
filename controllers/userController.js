const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Role = require('../models/Role');

/**
 * GET /users
 * Display list of all users
 */
exports.getUsers = async (req, res, next) => {
  try {
    const users = await User.findAll({
      include: [{ model: Role, as: 'role' }],
      order: [['id', 'ASC']]
    });

    res.render('users/index', {
      title: 'Kelola Pengguna - Sistem Inventaris Laboratorium',
      users,
      success: req.session.success || null,
      error: req.session.error || null
    });

    // Clear session alerts
    req.session.success = null;
    req.session.error = null;
  } catch (error) {
    next(error);
  }
};

/**
 * GET /users/create
 * Display form to create new user
 */
exports.getCreateUser = async (req, res, next) => {
  try {
    const roles = await Role.findAll();
    res.render('users/create', {
      title: 'Tambah Pengguna - Sistem Inventaris Laboratorium',
      roles,
      error: null,
      formData: {}
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /users
 * Store new user to database
 */
exports.postCreateUser = async (req, res, next) => {
  const { name, email, password, role_id } = req.body;

  try {
    const roles = await Role.findAll();

    if (!name || !email || !password || !role_id) {
      return res.render('users/create', {
        title: 'Tambah Pengguna - Sistem Inventaris Laboratorium',
        roles,
        error: 'Semua kolom wajib diisi.',
        formData: { name, email, role_id }
      });
    }

    // Check if email already registered
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.render('users/create', {
        title: 'Tambah Pengguna - Sistem Inventaris Laboratorium',
        roles,
        error: 'Email sudah terdaftar. Gunakan email lain.',
        formData: { name, email, role_id }
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    await User.create({
      name,
      email,
      password: hashedPassword,
      role_id
    });

    req.session.success = 'Pengguna baru berhasil ditambahkan!';
    return res.redirect('/users');
  } catch (error) {
    console.error('[Create User Error]:', error);
    next(error);
  }
};

/**
 * GET /users/edit/:id
 * Display form to edit existing user
 */
exports.getEditUser = async (req, res, next) => {
  const { id } = req.params;

  try {
    const userToEdit = await User.findByPk(id);
    if (!userToEdit) {
      req.session.error = 'Pengguna tidak ditemukan.';
      return res.redirect('/users');
    }

    const roles = await Role.findAll();
    res.render('users/edit', {
      title: 'Ubah Pengguna - Sistem Inventaris Laboratorium',
      userToEdit,
      roles,
      error: null
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /users/edit/:id
 * Update user data in database
 */
exports.postUpdateUser = async (req, res, next) => {
  const { id } = req.params;
  const { name, email, password, role_id } = req.body;

  try {
    const userToEdit = await User.findByPk(id);
    if (!userToEdit) {
      req.session.error = 'Pengguna tidak ditemukan.';
      return res.redirect('/users');
    }

    const roles = await Role.findAll();

    if (!name || !email || !role_id) {
      return res.render('users/edit', {
        title: 'Ubah Pengguna - Sistem Inventaris Laboratorium',
        userToEdit: { id, name, email, role_id },
        roles,
        error: 'Nama, Email, dan Peran wajib diisi.'
      });
    }

    // Check if email already used by another user
    if (email !== userToEdit.email) {
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        return res.render('users/edit', {
          title: 'Ubah Pengguna - Sistem Inventaris Laboratorium',
          userToEdit: { id, name, email, role_id },
          roles,
          error: 'Email sudah digunakan oleh pengguna lain.'
        });
      }
    }

    // Prepare update data
    const updateData = { name, email, role_id };

    // Update password only if provided
    if (password && password.trim() !== '') {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(password, salt);
    }

    await userToEdit.update(updateData);

    req.session.success = 'Data pengguna berhasil diubah!';
    return res.redirect('/users');
  } catch (error) {
    console.error('[Update User Error]:', error);
    next(error);
  }
};

/**
 * POST /users/delete/:id
 * Delete user from database
 */
exports.postDeleteUser = async (req, res, next) => {
  const { id } = req.params;

  try {
    const userToDelete = await User.findByPk(id);
    if (!userToDelete) {
      req.session.error = 'Pengguna tidak ditemukan.';
      return res.redirect('/users');
    }

    // Prevent admin from deleting themselves
    if (req.session.user && req.session.user.id === parseInt(id)) {
      req.session.error = 'Anda tidak dapat menghapus akun Anda sendiri yang sedang digunakan.';
      return res.redirect('/users');
    }

    await userToDelete.destroy();
    req.session.success = 'Pengguna berhasil dihapus!';
    return res.redirect('/users');
  } catch (error) {
    console.error('[Delete User Error]:', error);
    req.session.error = 'Tidak dapat menghapus pengguna. Pengguna mungkin sedang memiliki keterkaitan data lain.';
    return res.redirect('/users');
  }
};
