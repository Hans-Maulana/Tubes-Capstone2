const express = require('express');
const router = express.Router();
const homeController = require('../controllers/homeController');
const dashboardController = require('../controllers/dashboardController');
const authCheck = require('../middlewares/authCheck');

// Define main/landing route
// router.get('/', homeController.getHome);
router.get('/home', homeController.getHome);

// Secure Dashboard Route protected by authCheck middleware
router.get('/', authCheck, dashboardController.getDashboard);
router.get('/dashboard', authCheck, dashboardController.getDashboard);

module.exports = router;
