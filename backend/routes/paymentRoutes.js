const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const crypto = require('crypto');

const { authMiddleware } = require('../middlewares/auth');

// Required Database Models
const User = require('../models/User');
const RiderProfile = require('../models/RiderProfile');
const AdminWallet = require('../models/AdminWallet');
const LedgerEntry = require('../models/LedgerEntry');

/**
 * Rider Only Middleware
 */
const verifyRider = (req, res, next) => {
    if (req.user.role !== 'Rider') {
        return res.status(403).json({
            success: false,
            message: "Access restricted to Riders only."
        });
    }

    next();
};

/**
 * POST /api/payment/initiate-clear-dues
 */
router.post('/initiate-clear-dues', authMiddleware, verifyRider, async (req, res) => {
    try {

        const { amount } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Valid amount is required to clear dues."
            });
        }

        const rider = await User.findById(req.user.id);

        if (!rider) {
            throw new Error("Rider not found.");
        }

        const transactionId = `TXN_${crypto.randomUUID()}`;

        return res.json({
            success: true,
            message: "Payment initiated successfully.",
            data: {
                transactionId,
                amount,
                merchantCode:
                    process.env.MERCHANT_CODE || "FOOD_SAMUNDAR_MAIN"
            }
        });

    } catch (err) {

        return res.status(500).json({
            success: false,
            error: err.message
        });

    }
});



module.exports = router;
