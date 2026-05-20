const express = require('express');
const router = express.Router();
const homeController = require('../controllers/homeController');
const dashboardController = require('../controllers/dashboardController');
const userController = require('../controllers/userController');
const roomController = require('../controllers/roomController');
const authCheck = require('../middlewares/authCheck');
const adminCheck = require('../middlewares/adminCheck');

// Define main/landing route
// router.get('/', homeController.getHome);
router.get('/home', homeController.getHome);

// Secure Dashboard Route protected by authCheck middleware
router.get('/', authCheck, dashboardController.getDashboard);
router.get('/dashboard', authCheck, dashboardController.getDashboard);

// --- User Management Routes (Administrator Only) ---
router.get('/users', authCheck, adminCheck, userController.getUsers);
router.get('/users/create', authCheck, adminCheck, userController.getCreateUser);
router.post('/users', authCheck, adminCheck, userController.postCreateUser);
router.get('/users/edit/:id', authCheck, adminCheck, userController.getEditUser);
router.post('/users/edit/:id', authCheck, adminCheck, userController.postUpdateUser);
router.post('/users/delete/:id', authCheck, adminCheck, userController.postDeleteUser);

// --- Room Management Routes ---
// View is open to all logged in users, modifications require adminCheck
router.get('/rooms', authCheck, roomController.getRooms);
router.get('/rooms/create', authCheck, adminCheck, roomController.getCreateRoom);
router.post('/rooms', authCheck, adminCheck, roomController.postCreateRoom);
router.get('/rooms/edit/:id', authCheck, adminCheck, roomController.getEditRoom);
router.post('/rooms/edit/:id', authCheck, adminCheck, roomController.postUpdateRoom);
router.post('/rooms/delete/:id', authCheck, adminCheck, roomController.postDeleteRoom);

module.exports = router;
