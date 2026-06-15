exports.getDebugDbStatus = async (req, res, next) => {
  try {
    const models = require('../models');
    const data = { counts: {} };

    for (const modelName of Object.keys(models)) {
      if (modelName === 'sequelize') continue;
      try {
        data.counts[modelName] = await models[modelName].count();
      } catch (err) {
        data.counts[modelName] = `Error: ${err.message}`;
      }
    }

    res.json(data);
  } catch (err) {
    next(err);
  }
};
