const express = require('express');
const router = express.Router();
const homeController = require('../controllers/homeController');
const dashboardController = require('../controllers/dashboardController');
const userController = require('../controllers/userController');
const roomController = require('../controllers/roomController');
const procurementDraftController = require('../controllers/procurementDraftController');
const administrationController = require('../controllers/administrationController');
const authCheck = require('../middlewares/authCheck');
const adminCheck = require('../middlewares/adminCheck');
const adminStaffCheck = require('../middlewares/adminStaffCheck');
const roleCheck = require('../middlewares/roleCheck');
const staffLabController = require('../controllers/staffLabController');
const inventoryController = require('../controllers/inventoryController');
const categoryController = require('../controllers/categoryController');
const reportController = require('../controllers/reportController');

// Define main/landing route
// router.get('/', homeController.getHome);
router.get('/home', homeController.getHome);
router.get('/inventory-label/:label', administrationController.getInventoryByLabel);

// Secure Dashboard Route protected by authCheck middleware
router.get('/', authCheck, dashboardController.getDashboard);
router.get('/dashboard/stats', authCheck, dashboardController.getDashboardStats);
router.get('/dashboard', authCheck, dashboardController.getDashboard);

router.get('/reports/lab-head/pdf', authCheck, roleCheck('Kepala Laboratorium'), reportController.getLabHeadReportPdf);
router.get('/reports/kaprodi/pdf', authCheck, roleCheck('Ketua Program Studi'), reportController.getKaprodiReportPdf);
router.get('/reports/admin-staff/pdf', authCheck, adminStaffCheck, reportController.getAdminStaffReportPdf);
router.get('/inventories', authCheck, inventoryController.getInventories);

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

// --- Review/Validation Routes (Ketua Program Studi Only) ---
router.get('/procurement-drafts-history', authCheck, roleCheck('Ketua Program Studi'), procurementDraftController.getReviewDrafts);
router.get('/procurement-drafts-history/:id', authCheck, roleCheck('Ketua Program Studi'), procurementDraftController.getReviewDraftDetail);
router.post('/procurement-drafts-history/:id/items/:itemId/approve', authCheck, roleCheck('Ketua Program Studi'), procurementDraftController.postApproveItem);
router.post('/procurement-drafts-history/:id/items/:itemId/reject', authCheck, roleCheck('Ketua Program Studi'), procurementDraftController.postRejectItem);
router.post('/procurement-drafts-history/:id/finalize', authCheck, roleCheck('Ketua Program Studi'), procurementDraftController.postFinalizeDraft);

// --- Administration Staff Routes ---
router.get('/administration/procurement-items', authCheck, adminStaffCheck, administrationController.getProcurementItems);
router.get('/administration/procurement-items/:itemId/edit', authCheck, adminStaffCheck, administrationController.getEditProcurementItem);
router.post('/administration/procurement-items/:itemId/edit', authCheck, adminStaffCheck, administrationController.postUpdateProcurementItem);
router.post('/administration/procurement-items/:itemId/delete', authCheck, adminStaffCheck, administrationController.postDeleteProcurementItem);
router.get('/administration/procurements', authCheck, adminStaffCheck, administrationController.getApprovedDrafts);
router.get('/administration/procurements/:id', authCheck, adminStaffCheck, administrationController.getApprovedDraftDetail);
router.post('/administration/procurements/:id/items/:itemId/receipts', authCheck, adminStaffCheck, administrationController.postCreateReceipt);
router.get('/administration/inventories', authCheck, adminStaffCheck, administrationController.getInventories);
router.get('/administration/inventories/create', authCheck, adminStaffCheck, administrationController.getCreateInventory);
router.post('/administration/inventories', authCheck, adminStaffCheck, administrationController.postCreateInventory);
router.get('/administration/inventories/:id/edit', authCheck, adminStaffCheck, administrationController.getEditInventory);
router.post('/administration/inventories/:id/edit', authCheck, adminStaffCheck, administrationController.postUpdateInventory);
router.post('/administration/inventories/:id/delete', authCheck, adminStaffCheck, administrationController.postDeleteInventory);

router.get('/administration/categories', authCheck, adminStaffCheck, categoryController.getCategories);
router.get('/administration/categories/create', authCheck, adminStaffCheck, categoryController.getCreateCategory);
router.post('/administration/categories', authCheck, adminStaffCheck, categoryController.postCreateCategory);
router.get('/administration/categories/:id/edit', authCheck, adminStaffCheck, categoryController.getEditCategory);
router.post('/administration/categories/:id/edit', authCheck, adminStaffCheck, categoryController.postUpdateCategory);
router.post('/administration/categories/:id/delete', authCheck, adminStaffCheck, categoryController.postDeleteCategory);

// --- Staff Laboratorium Routes ---
router.get('/stafflab/bhps', authCheck, staffLabController.getBhps);

router.get('/stafflab/maintenance', authCheck, staffLabController.getMaintenanceLogs);
router.get('/stafflab/maintenance/create', authCheck, roleCheck('Staf Laboratorium'), staffLabController.getCreateMaintenanceLog);
router.post('/stafflab/maintenance', authCheck, roleCheck('Staf Laboratorium'), staffLabController.postCreateMaintenanceLog);
router.get('/stafflab/maintenance/:id', authCheck, staffLabController.getMaintenanceLogDetail);

router.get('/stafflab/inventories', authCheck, roleCheck('Staf Laboratorium'), staffLabController.getInventories);
router.get('/stafflab/inventories/scan', authCheck, roleCheck('Staf Laboratorium'), staffLabController.getScanInventory);
router.get('/stafflab/inventories/lookup', authCheck, roleCheck('Staf Laboratorium'), staffLabController.getInventoryLookup);
router.post('/stafflab/inventories/:id/start-maintenance', authCheck, roleCheck('Staf Laboratorium'), staffLabController.postStartMaintenance);
router.get('/stafflab/inventories/:id/move-room', authCheck, roleCheck('Staf Laboratorium'), staffLabController.getMoveRoom);
router.post('/stafflab/inventories/:id/move-room', authCheck, roleCheck('Staf Laboratorium'), staffLabController.postMoveRoom);
router.get('/stafflab/inventories/:id/complete-maintenance', authCheck, roleCheck('Staf Laboratorium'), staffLabController.getCompleteMaintenance);
router.post('/stafflab/inventories/:id/complete-maintenance', authCheck, roleCheck('Staf Laboratorium'), staffLabController.postCompleteMaintenance);
router.get('/stafflab/inventories/:id/change-status', authCheck, roleCheck('Staf Laboratorium'), staffLabController.getChangeStatus);
router.post('/stafflab/inventories/:id/change-status', authCheck, roleCheck('Staf Laboratorium'), staffLabController.postChangeStatus);
router.get('/stafflab/inventories/:id/edit', authCheck, roleCheck('Staf Laboratorium'), staffLabController.getEditInventory);
router.post('/stafflab/inventories/:id/edit', authCheck, roleCheck('Staf Laboratorium'), staffLabController.postUpdateInventory);

module.exports = router;
