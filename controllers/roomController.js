const Room = require('../models/Room');

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
  const { name, location, description } = req.body;

  try {
    if (!name) {
      return res.render('rooms/create', {
        title: 'Tambah Ruangan - Sistem Inventaris Laboratorium',
        error: 'Nama ruangan wajib diisi.',
        formData: { name, location, description }
      });
    }

    await Room.create({
      name,
      location,
      description
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
  const { name, location, description } = req.body;

  try {
    const roomToEdit = await Room.findByPk(id);
    if (!roomToEdit) {
      req.session.error = 'Ruangan tidak ditemukan.';
      return res.redirect('/rooms');
    }

    if (!name) {
      return res.render('rooms/edit', {
        title: 'Ubah Ruangan - Sistem Inventaris Laboratorium',
        roomToEdit: { id, name, location, description },
        error: 'Nama ruangan wajib diisi.'
      });
    }

    await roomToEdit.update({
      name,
      location,
      description
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
