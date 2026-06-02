const { Inventory, Room, ProcurementItem, ProcurementDraft, ItemCategory } = require('../models');
const { Op } = require('sequelize');

exports.getInventories = async (req, res, next) => {
  try {
    const { room_id, year, label, category_id } = req.query;

    const inventoryWhere = {};
    if (room_id) {
      inventoryWhere.room_id = parseInt(room_id, 10);
    }
    if (label) {
      inventoryWhere.label_number = { [Op.like]: `%${label.trim()}%` };
    }
    if (category_id) {
      inventoryWhere.category_id = parseInt(category_id, 10);
    }

    const draftWhere = { status: 'Approved' };
    if (year) {
      draftWhere.year = parseInt(year, 10);
    }

    const inventories = await Inventory.findAll({
      where: inventoryWhere,
      include: [
        { model: Room, as: 'room' },
        { model: ItemCategory, as: 'itemCategory' },
        {
          model: ProcurementItem,
          as: 'procurementItem',
          required: true,
          where: {
            item_type: { [Op.ne]: 'BHP' },
            status: 'Approved'
          },
          include: [
            {
              model: ProcurementDraft,
              as: 'draft',
              required: true,
              where: draftWhere
            }
          ]
        }
      ],
      order: [['id', 'DESC']]
    });

    const distinctDrafts = await ProcurementDraft.findAll({
      attributes: ['year'],
      where: { status: 'Approved' },
      group: ['year'],
      order: [['year', 'DESC']]
    });
    const years = distinctDrafts.map(d => d.year);
    const rooms = await Room.findAll({ order: [['name', 'ASC']] });
    const categories = await ItemCategory.findAll({ order: [['name', 'ASC']] });

    res.render('inventories/index', {
      title: 'Daftar Inventaris - Sistem Inventaris Laboratorium',
      inventories,
      rooms,
      categories,
      years,
      selectedRoomId: room_id || '',
      selectedYear: year || '',
      selectedLabel: label || '',
      selectedCategoryId: category_id || ''
    });
  } catch (error) {
    next(error);
  }
};
