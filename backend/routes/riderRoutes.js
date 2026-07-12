const express = require('express');
const router = express.Router();
const riderController = require('../controllers/riderController');
const { authMiddleware } = require('../middlewares/auth');

// --- 🔐 Authentication & Onboarding Channels ---
router.post('/signup', riderController.signup);
router.get('/profile', authMiddleware, riderController.getProfile);
router.put('/bike', authMiddleware, riderController.updateBike);

// --- 📡 Real-Time Radar Logistical Channels ---
router.get('/orders/available', authMiddleware, riderController.getAvailableOrders);
router.get('/orders/active', authMiddleware, riderController.getActiveOrder);
router.post('/update-location', authMiddleware, riderController.updateLocation);
router.put('/toggle-status', authMiddleware, riderController.toggleStatus);

// --- 🏎️ Core Atomic Order Dispatch Pipelines ---
router.put('/orders/:id/accept', authMiddleware, riderController.acceptOrder);
router.put('/orders/:id/reject', authMiddleware, riderController.rejectOrder);
router.put('/orders/:id/complete', authMiddleware, riderController.completeOrder);

module.exports = router;