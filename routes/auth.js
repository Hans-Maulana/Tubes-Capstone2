const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Route for getting and posting to login
router.get('/login', authController.getLogin);
router.post('/login', authController.postLogin);

// Route for logging out
router.get('/logout', authController.logout);

module.exports = router;
