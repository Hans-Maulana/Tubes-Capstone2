const { Inventory, Room, ProcurementItem, ProcurementDraft } = require('../models');
const { Op } = require('sequelize');

exports.getInventories = async (req, res, next) => {
  try {
    const { room_id, year } = req.query;

    const inventoryWhere = {};
    if (room_id) {
      inventoryWhere.room_id = parseInt(room_id, 10);
    }

    const draftWhere = { status: 'Approved' };
    if (year) {
      draftWhere.year = parseInt(year, 10);
    }

    const inventories = await Inventory.findAll({
      where: inventoryWhere,
      include: [
        { model: Room, as: 'room' },
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

    res.render('inventories/index', {
      title: 'Daftar Inventaris - Sistem Inventaris Laboratorium',
      inventories,
      rooms,
      years,
      selectedRoomId: room_id || '',
      selectedYear: year || ''
    });
  } catch (error) {
    next(error);
  }
};
