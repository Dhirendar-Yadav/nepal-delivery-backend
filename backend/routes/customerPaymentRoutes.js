const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { authMiddleware } = require('../middlewares/auth');
const Order = require('../models/Order');

router.post('/initiate', authMiddleware, async (req, res) => {
    if (req.user.role !== 'Customer') {
        return res.status(403).json({ success: false, error: 'RESTRICTED_ACCESS' });
    }

    const { orderId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
        return res.status(400).json({ success: false, error: 'INVALID_ORDER_ID' });
    }

    const order = await Order.findById(orderId)
        .select('customerId paymentMethod paymentProvider paymentReference paymentStatus totalAmount')
        .lean();

    if (!order) {
        return res.status(404).json({ success: false, error: 'ORDER_NOT_FOUND' });
    }

    if (order.customerId.toString() !== req.user.id) {
        return res.status(403).json({ success: false, error: 'UNAUTHORIZED_ORDER_ACCESS' });
    }

    if (order.paymentMethod !== 'ONLINE') {
        return res.status(400).json({ success: false, error: 'INVALID_PAYMENT_METHOD' });
    }

    if (order.paymentStatus === 'PAID') {
        return res.status(409).json({ success: false, error: 'ORDER_ALREADY_PAID' });
    }

    if (order.paymentStatus !== 'PENDING' || !order.paymentReference || !order.paymentProvider) {
        return res.status(409).json({ success: false, error: 'INVALID_PAYMENT_STATE' });
    }

    return res.json({
        success: true,
        orderId: order._id,
        paymentReference: order.paymentReference,
        paymentProvider: order.paymentProvider,
        amount: order.totalAmount
    });
});

module.exports = router;
