const express = require('express');
const router = express.Router();
const homeController = require('../controllers/homeController');
const dashboardController = require('../controllers/dashboardController');
const userController = require('../controllers/userController');
const roomController = require('../controllers/roomController');
const procurementDraftController = require('../controllers/procurementDraftController');
const authCheck = require('../middlewares/authCheck');
const adminCheck = require('../middlewares/adminCheck');
const roleCheck = require('../middlewares/roleCheck');

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

// --- Procurement Draft Routes (Kepala Laboratorium) ---
router.get('/procurement-drafts', authCheck, roleCheck('Kepala Laboratorium'), procurementDraftController.getDrafts);
router.get('/procurement-drafts/create', authCheck, roleCheck('Kepala Laboratorium'), procurementDraftController.getCreateDraft);
router.post('/procurement-drafts', authCheck, roleCheck('Kepala Laboratorium'), procurementDraftController.postCreateDraft);
router.get('/procurement-drafts/:id', authCheck, roleCheck('Kepala Laboratorium'), procurementDraftController.getDraftDetail);
router.post('/procurement-drafts/:id/items', authCheck, roleCheck('Kepala Laboratorium'), procurementDraftController.postCreateItem);
router.get('/procurement-drafts/:id/items/:itemId/edit', authCheck, roleCheck('Kepala Laboratorium'), procurementDraftController.getEditItem);
router.post('/procurement-drafts/:id/items/:itemId/edit', authCheck, roleCheck('Kepala Laboratorium'), procurementDraftController.postUpdateItem);
router.post('/procurement-drafts/:id/items/:itemId/delete', authCheck, roleCheck('Kepala Laboratorium'), procurementDraftController.postDeleteItem);
router.post('/procurement-drafts/:id/submit', authCheck, roleCheck('Kepala Laboratorium'), procurementDraftController.postSubmitDraft);
router.post('/procurement-drafts/:id/lock', authCheck, roleCheck('Kepala Laboratorium'), procurementDraftController.postLockDraft);

module.exports = router;
