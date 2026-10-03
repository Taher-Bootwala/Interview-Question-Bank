const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

router.get('/user', isAuthenticated, dashboardController.getUserDashboard);
router.get('/admin', isAdmin, dashboardController.getAdminDashboard);
router.get('/users', isAdmin, dashboardController.getUsersList);

module.exports = router;
