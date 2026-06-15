const { Op } = require('sequelize');
const Room = require('../models/Room');

function normalizeRoomCode(code) {
  if (!code || !String(code).trim()) return null;
  return String(code).trim().toUpperCase();
}

/**
 * GET /rooms
 * Display list of all rooms
 */
exports.getRooms = async (req, res, next) => {
  try {
    const rooms = await Room.findAll({
      order: [['id', 'ASC']]
    });

    res.render('rooms/index', {
      title: 'Kelola Ruangan Lab - Sistem Inventaris Laboratorium',
      rooms,
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
 * GET /rooms/create
 * Display form to create new room
 */
exports.getCreateRoom = (req, res) => {
  res.render('rooms/create', {
    title: 'Tambah Ruangan - Sistem Inventaris Laboratorium',
    error: null,
    formData: {}
  });
};

/**
 * POST /rooms
 * Store new room in database
 */
exports.postCreateRoom = async (req, res, next) => {
  const { name, code, location, description } = req.body;
  const normalizedCode = normalizeRoomCode(code);

  try {
    if (!name) {
      return res.render('rooms/create', {
        title: 'Tambah Ruangan - Sistem Inventaris Laboratorium',
        error: 'Nama ruangan wajib diisi.',
        formData: { name, code, location, description }
      });
    }

    if (!normalizedCode) {
      return res.render('rooms/create', {
        title: 'Tambah Ruangan - Sistem Inventaris Laboratorium',
        error: 'Kode ruangan wajib diisi.',
        formData: { name, code, location, description }
      });
    }

    const existingCode = await Room.findOne({ where: { code: normalizedCode } });
    if (existingCode) {
      return res.render('rooms/create', {
        title: 'Tambah Ruangan - Sistem Inventaris Laboratorium',
        error: `Kode ruangan "${normalizedCode}" sudah digunakan.`,
        formData: { name, code, location, description }
      });
    }

    await Room.create({
      name: name.trim(),
      code: normalizedCode,
      location: location ? location.trim() : null,
      description: description ? description.trim() : null
    });

    req.session.success = 'Ruangan baru berhasil ditambahkan!';
    return res.redirect('/rooms');
  } catch (error) {
    console.error('[Create Room Error]:', error);
    next(error);
  }
};

/**
 * GET /rooms/edit/:id
 * Display form to edit existing room
 */
exports.getEditRoom = async (req, res, next) => {
  const { id } = req.params;

  try {
    const roomToEdit = await Room.findByPk(id);
    if (!roomToEdit) {
      req.session.error = 'Ruangan tidak ditemukan.';
      return res.redirect('/rooms');
    }

    res.render('rooms/edit', {
      title: 'Ubah Ruangan - Sistem Inventaris Laboratorium',
      roomToEdit,
      error: null
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /rooms/edit/:id
 * Update room data in database
 */
exports.postUpdateRoom = async (req, res, next) => {
  const { id } = req.params;
  const { name, code, location, description } = req.body;
  const normalizedCode = normalizeRoomCode(code);

  try {
    const roomToEdit = await Room.findByPk(id);
    if (!roomToEdit) {
      req.session.error = 'Ruangan tidak ditemukan.';
      return res.redirect('/rooms');
    }

    if (!name) {
      return res.render('rooms/edit', {
        title: 'Ubah Ruangan - Sistem Inventaris Laboratorium',
        roomToEdit: { id, name, code, location, description },
        error: 'Nama ruangan wajib diisi.'
      });
    }

    if (!normalizedCode) {
      return res.render('rooms/edit', {
        title: 'Ubah Ruangan - Sistem Inventaris Laboratorium',
        roomToEdit: { id, name, code, location, description },
        error: 'Kode ruangan wajib diisi.'
      });
    }

    const existingCode = await Room.findOne({
      where: {
        code: normalizedCode,
        id: { [Op.ne]: id }
      }
    });
    if (existingCode) {
      return res.render('rooms/edit', {
        title: 'Ubah Ruangan - Sistem Inventaris Laboratorium',
        roomToEdit: { id, name, code, location, description },
        error: `Kode ruangan "${normalizedCode}" sudah digunakan.`
      });
    }

    await roomToEdit.update({
      name: name.trim(),
      code: normalizedCode,
      location: location ? location.trim() : null,
      description: description ? description.trim() : null
    });

    req.session.success = 'Data ruangan berhasil diubah!';
    return res.redirect('/rooms');
  } catch (error) {
    console.error('[Update Room Error]:', error);
    next(error);
  }
};

/**
 * POST /rooms/delete/:id
 * Delete room from database
 */
exports.postDeleteRoom = async (req, res, next) => {
  const { id } = req.params;

  try {
    const roomToDelete = await Room.findByPk(id);
    if (!roomToDelete) {
      req.session.error = 'Ruangan tidak ditemukan.';
      return res.redirect('/rooms');
    }

    await roomToDelete.destroy();
    req.session.success = 'Ruangan berhasil dihapus!';
    return res.redirect('/rooms');
  } catch (error) {
    console.error('[Delete Room Error]:', error);
    req.session.error = 'Tidak dapat menghapus ruangan. Ruangan mungkin masih memiliki inventaris yang terikat.';
    return res.redirect('/rooms');
  }
};
