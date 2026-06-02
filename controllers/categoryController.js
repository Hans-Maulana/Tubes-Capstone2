const { Op } = require('sequelize');
const { ItemCategory, Inventory } = require('../models');

exports.getCategories = async (req, res, next) => {
  try {
    const categories = await ItemCategory.findAll({
      order: [['name', 'ASC']]
    });

    res.render('administration/categories/index', {
      title: 'Kelola Kategori Barang - Sistem Inventaris Laboratorium',
      categories,
      success: req.session.success || null,
      error: req.session.error || null
    });

    req.session.success = null;
    req.session.error = null;
  } catch (error) {
    next(error);
  }
};

exports.getCreateCategory = (req, res) => {
  res.render('administration/categories/create', {
    title: 'Tambah Kategori Barang - Sistem Inventaris Laboratorium',
    error: null,
    formData: {}
  });
};

exports.postCreateCategory = async (req, res, next) => {
  const { name, description } = req.body;

  try {
    if (!name || !name.trim()) {
      return res.render('administration/categories/create', {
        title: 'Tambah Kategori Barang - Sistem Inventaris Laboratorium',
        error: 'Nama kategori wajib diisi.',
        formData: { name, description }
      });
    }

    const existing = await ItemCategory.findOne({
      where: { name: { [Op.like]: name.trim() } }
    });

    if (existing) {
      return res.render('administration/categories/create', {
        title: 'Tambah Kategori Barang - Sistem Inventaris Laboratorium',
        error: 'Kategori dengan nama tersebut sudah terdaftar.',
        formData: { name, description }
      });
    }

    await ItemCategory.create({
      name: name.trim(),
      description: description ? description.trim() : null
    });

    req.session.success = `Kategori "${name.trim()}" berhasil ditambahkan.`;
    return res.redirect('/administration/categories');
  } catch (error) {
    next(error);
  }
};

exports.getEditCategory = async (req, res, next) => {
  try {
    const category = await ItemCategory.findByPk(req.params.id);
    if (!category) {
      req.session.error = 'Kategori tidak ditemukan.';
      return res.redirect('/administration/categories');
    }

    res.render('administration/categories/edit', {
      title: 'Ubah Kategori Barang - Sistem Inventaris Laboratorium',
      category,
      error: null
    });
  } catch (error) {
    next(error);
  }
};

exports.postUpdateCategory = async (req, res, next) => {
  const { name, description } = req.body;

  try {
    const category = await ItemCategory.findByPk(req.params.id);
    if (!category) {
      req.session.error = 'Kategori tidak ditemukan.';
      return res.redirect('/administration/categories');
    }

    if (!name || !name.trim()) {
      return res.render('administration/categories/edit', {
        title: 'Ubah Kategori Barang - Sistem Inventaris Laboratorium',
        category: { id: category.id, name, description },
        error: 'Nama kategori wajib diisi.'
      });
    }

    const existing = await ItemCategory.findOne({
      where: {
        name: { [Op.like]: name.trim() },
        id: { [Op.ne]: category.id }
      }
    });

    if (existing) {
      return res.render('administration/categories/edit', {
        title: 'Ubah Kategori Barang - Sistem Inventaris Laboratorium',
        category: { id: category.id, name, description },
        error: 'Kategori dengan nama tersebut sudah terdaftar.'
      });
    }

    const oldName = category.name;
    await category.update({
      name: name.trim(),
      description: description ? description.trim() : null
    });

    await Inventory.update(
      { category: name.trim() },
      { where: { category_id: category.id } }
    );

    req.session.success = `Kategori "${oldName}" berhasil diperbarui.`;
    return res.redirect('/administration/categories');
  } catch (error) {
    next(error);
  }
};

exports.postDeleteCategory = async (req, res, next) => {
  try {
    const category = await ItemCategory.findByPk(req.params.id);
    if (!category) {
      req.session.error = 'Kategori tidak ditemukan.';
      return res.redirect('/administration/categories');
    }

    const usageCount = await Inventory.count({
      where: { category_id: category.id }
    });

    if (usageCount > 0) {
      req.session.error = `Kategori "${category.name}" tidak dapat dihapus karena masih digunakan oleh ${usageCount} inventaris.`;
      return res.redirect('/administration/categories');
    }

    await category.destroy();
    req.session.success = `Kategori "${category.name}" berhasil dihapus.`;
    return res.redirect('/administration/categories');
  } catch (error) {
    next(error);
  }
};
