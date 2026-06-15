const { Op } = require('sequelize');
const { Inventory } = require('../models');

async function getMaxLabelSequence(year, transaction = null) {
  const prefix = `LAB-INV-${year}-`;
  const queryOptions = {
    where: {
      label_number: { [Op.like]: `${prefix}%` }
    },
    attributes: ['label_number']
  };

  if (transaction) {
    queryOptions.transaction = transaction;
    queryOptions.lock = transaction.LOCK.UPDATE;
  }

  const inventories = await Inventory.findAll(queryOptions);

  let maxSeq = 0;
  for (const inventory of inventories) {
    const suffix = inventory.label_number.slice(prefix.length);
    const seq = parseInt(suffix, 10);
    if (!Number.isNaN(seq) && seq > maxSeq) {
      maxSeq = seq;
    }
  }

  return maxSeq;
}

async function generateNextLabelNumber(year, transaction = null) {
  const maxSeq = await getMaxLabelSequence(year, transaction);
  return `LAB-INV-${year}-${String(maxSeq + 1).padStart(3, '0')}`;
}

async function generateLabelNumbers(year, count, transaction = null) {
  const maxSeq = await getMaxLabelSequence(year, transaction);
  const prefix = `LAB-INV-${year}-`;
  const labels = [];

  for (let i = 1; i <= count; i++) {
    labels.push(`${prefix}${String(maxSeq + i).padStart(3, '0')}`);
  }

  return labels;
}

module.exports = {
  generateNextLabelNumber,
  generateLabelNumbers,
  getMaxLabelSequence
};
