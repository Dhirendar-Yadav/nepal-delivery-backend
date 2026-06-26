const express = require('express');
const router = express.Router();

// Modular Sub-routers
const restaurantRoutes = require('./admin/restaurantRoutes');
const financeRoutes = require('./admin/financeRoutes');
const opsRoutes = require('./admin/opsRoutes');

// Mount all routes cleanly on the main router
router.use('/', restaurantRoutes);
router.use('/', financeRoutes);
router.use('/', opsRoutes);

module.exports = router;