const sequelize = require('../models/db');

/**
 * Render the home/dashboard page with project info and database status.
 */
exports.getHome = async (req, res, next) => {
  const dbStatus = {
    connected: false,
    message: 'Checking database connection...',
    error: null
  };

  try {
    // Authenticate Sequelize connection
    await sequelize.authenticate();
    dbStatus.connected = true;
    dbStatus.message = 'Sequelize successfully established database connection!';
  } catch (error) {
    dbStatus.connected = false;
    dbStatus.message = 'Database connection failed. Ensure MySQL is running and credentials in .env are correct.';
    dbStatus.error = error.message;
  }

  res.render('index', {
    title: 'Tubes Capstone II - Express MVC Starter',
    dbStatus,
    projectStructure: [
      { name: 'controllers/', desc: 'Application controller definitions. Processes incoming requests and drives data into views.' },
      { name: 'models/', desc: 'Sequelize ORM model definitions. Maps tables to Javascript classes.' },
      { name: 'routes/', desc: 'Route declarations. Connects HTTP requests/URLs directly to controller actions.' },
      { name: 'views/', desc: 'Dynamic presentation templates. Rendered using Pug template engine on the server.' },
      { name: 'public/', desc: 'Static resources accessible by browsers, including CSS, frontend JS, and images.' },
      { name: 'app.js', desc: 'Express bootstrapper. Bundles middlewares, configures static file directories, and starts local port server.' },
      { name: '.env', desc: 'Secure environment configuration parameters. Keeps access keys and DB settings safe.' }
    ]
  });
};
