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

/**
 * Payment Gateway Webhook
 */

/**
 * Payment Webhook Signature Verification
 */
const verifyWebhookSignature = (req) => {
    const signature = req.headers['x-webhook-signature'];

    if (!signature) {
        return false;
    }

    const payload = Buffer.isBuffer(req.body)
        ? req.body
        : JSON.stringify(req.body);

    const expectedSignature = crypto
        .createHmac('sha256', process.env.PAYMENT_WEBHOOK_SECRET)
        .update(payload)
        .digest('hex');

    if (signature.length !== expectedSignature.length) {
        return false;
    }

    return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
    );
};

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    
    if (!verifyWebhookSignature(req)) {
        return res.status(401).json({
            success: false,
            message: "Invalid webhook signature."
        });
    }


    const {
        transactionId,
        amount,
        status,
        riderId
    } = req.body;


    if (
        typeof transactionId !== "string" ||
        transactionId.trim().length === 0 ||
        typeof riderId !== "string" ||
        riderId.trim().length === 0 ||
        !mongoose.Types.ObjectId.isValid(riderId)
    ) {
        return res.status(400).json({
            success: false,
            message: "Invalid webhook payload."
        });
    }

    if (status !== 'SUCCESS') {
        return res.status(400).json({
            success: false,
            message: "Payment failed or pending."
        });
    }

    if (!Number.isSafeInteger(amount) || amount <= 0) {
        return res.status(400).json({
            success: false,
            message: "Invalid payment amount."
        });
    }

    const session = await mongoose.startSession();

    session.startTransaction();

    try {

        const existingLedger = await LedgerEntry.findOne({
            settlementId: transactionId
        }).session(session);

        if (existingLedger) {
            await session.commitTransaction();
            session.endSession();

            return res.json({
                success: true,
                message: "Webhook already processed."
            });
        }

        const rider = await RiderProfile.findOneAndUpdate(
    {
        userId: riderId,
        "wallet.balance": { $gte: amount },
        "wallet.codPending": { $gte: amount }
    },
    {
        $inc: {
            "wallet.balance": -amount,
            "wallet.codPending": -amount
        }
    },
    {
        new: true,
        session
    }
);

if (!rider) {
    throw new Error("Rider profile not found.");
}

        const todayString =
            new Date().toISOString().split('T')[0];

        await AdminWallet.findOneAndUpdate(
            { date: todayString },
            {
                $inc: {
                    totalDigitalDebtRecovery: amount
                },
                $setOnInsert: {
                    date: todayString
                },
            },
            {
                session,
                new: true,
                upsert: true
            }
        );

        await LedgerEntry.insertMany([
            {
                settlementId: transactionId,
                entityType: "RIDER",
                entityId: rider._id,
                type: "DEBIT",
                amount,
                balanceAfter: rider.wallet.balance,
                description:
                    "Digital Top-up via Gateway to clear COD Debt"
            },
            {
                settlementId: transactionId,
                entityType: "ADMIN",
                type: "CREDIT",
                amount,
                description:
                    "Digital recovery of Rider COD debt via payment gateway"
            }
        ], { session });

        await session.commitTransaction();

        session.endSession();

        return res.json({
            success: true,
            message: "Webhook processed, debt cleared."
        });

    } catch (err) {

        if (session.inTransaction()) {
            await session.abortTransaction();
        }

        session.endSession();

        console.error(err);

        if (err?.code === 11000) {
            return res.status(200).json({
                success: true,
                message: "Webhook already processed."
            });
        }



        return res.status(500).json({
            success: false,
            error: "Internal processing error."
        });

    }

});

module.exports = router;


