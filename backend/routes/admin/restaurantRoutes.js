const express = require('express');
const router = express.Router();
// 🛡️ FIX: Ab ye naye restaurantController ko point kar raha hai
const restaurantController = require('../../controllers/admin/restaurantController');
const { verifyAdmin, orderLimiter, criticalLimiter } = require('../../middlewares/adminAuth');

// =========================================================================
// 🏢 RESTAURANT OPERATIONS CONTROL HUB 
// =========================================================================

router.get('/restaurants', verifyAdmin, orderLimiter, restaurantController.getAllRestaurantsForAdmin);
router.patch('/restaurants/:id/status', verifyAdmin, criticalLimiter, restaurantController.updateRestaurantStatus);
router.patch('/restaurants/:id/operate', verifyAdmin, criticalLimiter, restaurantController.updateOperationalState);
router.patch('/restaurants/:id/metrics', verifyAdmin, criticalLimiter, restaurantController.updateRankingMetrics);

router.post('/sync-legacy-data', verifyAdmin, restaurantController.syncLegacyData);

module.exports = router;
