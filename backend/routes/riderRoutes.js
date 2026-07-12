const express = require('express');
const router = express.Router();
const riderController = require('../controllers/riderController');
const { authMiddleware } = require('../middlewares/auth');

const requireRider = (req, res, next) => {
    if (req.user.role !== 'Rider') {
        return res.status(403).json({ success: false, message: 'Access restricted to Riders only.' });
    }
    next();
};

// --- 🔐 Authentication & Onboarding Channels ---
router.post('/signup', riderController.signup);
router.get('/profile', authMiddleware, requireRider, riderController.getProfile);
router.put('/bike', authMiddleware, requireRider, riderController.updateBike);

// --- 📡 Real-Time Radar Logistical Channels ---
router.get('/orders/available', authMiddleware, requireRider, riderController.getAvailableOrders);
router.get('/orders/active', authMiddleware, requireRider, riderController.getActiveOrder);
router.post('/update-location', authMiddleware, requireRider, riderController.updateLocation);
router.put('/toggle-status', authMiddleware, requireRider, riderController.toggleStatus);

// --- 🏎️ Core Atomic Order Dispatch Pipelines ---
router.put('/orders/:id/accept', authMiddleware, requireRider, riderController.acceptOrder);
router.put('/orders/:id/reject', authMiddleware, requireRider, riderController.rejectOrder);
router.put('/orders/:id/complete', authMiddleware, requireRider, riderController.completeOrder);

module.exports = router;
