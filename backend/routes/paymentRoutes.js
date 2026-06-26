const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

// Required Database Models
const User = require('../models/User'); // Rider profile
const AdminWallet = require('../models/AdminWallet');
const LedgerEntry = require('../models/LedgerEntry');

/**
 * Middleware to verify Rider authentication
 * Ensures only logged-in riders can initiate payments
 */
const verifyRider = (req, res, next) => {
    const authHeader = req.header('Authorization');
    if (!authHeader) return res.status(401).json({ success: false, message: "Authentication required." });
    
    try {
        const token = authHeader.split(" ")[1];
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        
        if (verified.role !== 'Rider') {
            return res.status(403).json({ success: false, message: "Access restricted to Riders only." });
        }
        req.user = verified;
        next();
    } catch (err) { 
        res.status(403).json({ success: false, message: "Invalid token." }); 
    }
};

/**
 * @route   POST /api/payment/initiate-clear-dues
 * @desc    Generates a transaction token for eSewa/Khalti checkout
 * @access  Private (Rider only)
 */
router.post('/initiate-clear-dues', verifyRider, async (req, res) => {
    try {
        const { amount } = req.body;
        
        if (!amount || amount <= 0) {
            return res.status(400).json({ success: false, message: "Valid amount is required to clear dues." });
        }

        const rider = await User.findById(req.user.id);
        if (!rider) throw new Error("Rider not found.");

        // Generate a unique transaction ID for the payment gateway
        const transactionId = `TXN_${Date.now()}_${rider._id.toString().slice(-4)}`;

        // In a real scenario, you return the signature/payload required by eSewa/Khalti SDK here
        return res.status(200).json({
            success: true,
            message: "Payment initiated successfully.",
            data: {
                transactionId: transactionId,
                amount: amount,
                merchantCode: process.env.MERCHANT_CODE || "FOOD_SAMUNDAR_MAIN",
                // Khalti/eSewa specific payload will go here
            }
        });

    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * @route   POST /api/payment/webhook
 * @desc    Automated callback from eSewa/Khalti when payment is successful.
 * Clears Rider debt and updates CEO Master Wallet atomically.
 * @access  Public (Secured via Server IP / Secret Key from Gateway)
 */
router.post('/webhook', async (req, res) => {
    // Gateway sends transaction details
    const { transactionId, amount, status, riderId, gatewaySignature } = req.body;

    // Security Check: Verify if the request actually came from the payment gateway
    // NOTE: Implement actual HMAC/SHA256 signature verification based on Gateway Docs
    if (status !== 'SUCCESS') {
        return res.status(400).json({ success: false, message: "Payment failed or pending." });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // 1. Fetch Rider and ensure they exist
        const rider = await User.findById(riderId).session(session);
        if (!rider) throw new Error("Rider not found.");

        // 2. Reduce Rider's COD Debt (Assuming walletBalance is positive for debt)
        rider.walletBalance -= amount;
        
        // If debt goes below threshold, unblock the rider automatically
        if (rider.walletBalance <= 0) {
            rider.isBlocked = false; 
        }
        await rider.save({ session });

        // 3. Update CEO Master Wallet (Real money received in bank)
        const todayString = new Date().toISOString().split('T')[0];
        const adminWallet = await AdminWallet.findOneAndUpdate(
            { date: todayString },
            { $inc: { totalRealCashCollected: amount } },
            { session, new: true, upsert: true }
        );

        // 4. Create Deterministic Ledger Entry
        const ledgerEntries = [
            {
                settlementId: transactionId,
                entityType: 'RIDER',
                entityId: rider._id,
                type: 'CREDIT', 
                amount: amount,
                balanceAfter: rider.walletBalance,
                description: `Digital Top-up via Gateway to clear COD Debt`
            },
            {
                settlementId: transactionId,
                entityType: 'ADMIN',
                type: 'DEBIT', // Cash in bank
                amount: amount,
                description: `Received Rider COD Cash Collection via Gateway`
            }
        ];

        await LedgerEntry.insertMany(ledgerEntries, { session });

        // 5. Commit Transaction
        await session.commitTransaction();
        session.endSession();

        return res.status(200).json({ success: true, message: "Webhook processed, debt cleared." });

    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        console.error("Webhook processing failed:", err.message);
        return res.status(500).json({ success: false, error: "Internal processing error." });
    }
});

module.exports = router;