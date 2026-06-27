const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const riderController = require('../controllers/riderController');

// 🛡️ Middleware: Verify Token (Upgraded Security Framework Guard)
const verifyToken = (req, res, next) => {
    const authHeader = req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: "Access Denied! Invalid authorization format." });
    }
    try {
        const token = authHeader.split(" ")[1];
        const verified = jwt.verify(token, process.env.JWT_SECRET || 'nepaldelivery_super_secret_key');
        req.user = verified;
        req.user.id = verified.id || verified._id || verified.userId;
        next();
    } catch (err) { 
        return res.status(403).json({ success: false, message: "Invalid Token!" }); 
    }
};

// --- 🔐 Authentication & Onboarding Channels ---
router.post('/signup', riderController.signup);
router.get('/profile', verifyToken, riderController.getProfile);
router.put('/bike', verifyToken, riderController.updateBike);

// --- 📡 Real-Time Radar Logistical Channels ---
router.get('/orders/available', verifyToken, riderController.getAvailableOrders);
router.get('/orders/active', verifyToken, riderController.getActiveOrder);
router.post('/update-location', verifyToken, riderController.updateLocation);
router.put('/toggle-status', verifyToken, riderController.toggleStatus);

// --- 🏎️ Core Atomic Order Dispatch Pipelines ---
router.put('/orders/:id/accept', verifyToken, riderController.acceptOrder);
router.put('/orders/:id/complete', verifyToken, riderController.completeOrder);

module.exports = router;