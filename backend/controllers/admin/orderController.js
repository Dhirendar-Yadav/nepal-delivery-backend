const mongoose = require('mongoose');
const crypto = require('crypto');
const Order = require('../../models/Order');
const AdminWallet = require('../../models/AdminWallet');
const Restaurant = require('../../models/Restaurant');
const User = require('../../models/User'); 
const LedgerEntry = require('../../models/LedgerEntry');

exports.processOrderDelivery = async (req, res) => {
    const { orderId, otp } = req.body;
    const MAX_RETRIES = 3;

    if (!orderId || !otp) {
        return res.status(400).json({ success: false, error: 'MISSING_DATA', message: "Order ID and OTP required." });
    }

    if (req.user.role !== 'Rider' && req.user.role !== 'Admin') {
        return res.status(403).json({ success: false, error: 'UNAUTHORIZED_ROLE', message: "Only assigned riders or admins can complete delivery." });
    }

    const otpHash = crypto.createHash('sha256').update(otp.toString().trim()).digest('hex');

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        const session = await mongoose.startSession();

        try {
            session.startTransaction({ readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60000);
            
            const lockedOrder = await Order.findOneAndUpdate(
                { 
                    _id: orderId, 
                    isPaymentProcessed: false,
                    status: 'Out for Delivery',
                    ...(req.user.role === 'Rider' ? { assignedRiderId: req.user.id } : {}), 
                    otpHash: otpHash, 
                    otpUsed: false,
                    otpAttempts: { $lt: 5 }, 
                    $or: [
                        { processingLock: false },
                        { processingStartedAt: { $lt: fiveMinutesAgo } } 
                    ]
                },
                { 
                    $set: { 
                        processingLock: true, 
                        processingStartedAt: new Date(),
                        processingOwner: req.requestId,
                        otpUsed: true 
                    },
                    $inc: { processingVersion: 1, otpAttempts: 1 } 
                },
                { session, new: true }
            ).maxTimeMS(2000); 

            if (!lockedOrder) {
                const checkState = await Order.findById(orderId).select('status isPaymentProcessed otpAttempts otpUsed otpHash').lean();
                if (!checkState) throw { status: 404, code: 'ORDER_NOT_FOUND' };
                if (checkState.otpAttempts >= 5) throw { status: 403, code: 'ORDER_LOCKED', message: "Too many failed OTP attempts." };
                if (checkState.isPaymentProcessed || checkState.status === 'Delivered') {
                    return res.status(200).json({ success: true, message: "Idempotent response: Already settled." });
                }
                if (checkState.otpHash !== otpHash) {
                    await Order.updateOne({ _id: orderId }, { $inc: { otpAttempts: 1 } }, { session });
                    throw { status: 401, code: 'INVALID_OTP', message: "Invalid OTP provided." };
                }
                throw { status: 409, code: 'PROCESSING_CONFLICT' };
            }

            const baseFoodCost = lockedOrder.foodCost || 0; 
            const baseDeliveryFee = lockedOrder.deliveryFee || 0; 
            const restaurantCredit = Math.round(baseFoodCost * 0.90);
            const riderBonus = Math.round(baseFoodCost * 0.02);
            const riderCredit = baseDeliveryFee + riderBonus;
            const adminRevenue = Math.round(baseFoodCost * 0.08);

            const totalCredits = restaurantCredit + adminRevenue + riderCredit; 
            const totalDebits = baseFoodCost + baseDeliveryFee; 

            if (totalCredits !== totalDebits) throw { status: 500, code: 'LEDGER_IMBALANCE' };

            const todayString = new Date().toISOString().split('T')[0]; 
            const shardId = crypto.createHash('md5').update(orderId.toString()).digest()[0] % 10;

            const [restaurantUpdate, riderUpdate, adminWalletUpdate] = await Promise.all([
                Restaurant.findOneAndUpdate(
                    { _id: lockedOrder.restaurantId, lastProcessedOrderId: { $ne: lockedOrder._id } }, 
                    { $inc: { walletBalance: restaurantCredit, totalEarnings: restaurantCredit }, $set: { lastProcessedOrderId: lockedOrder._id } },
                    { session, new: true }
                ).maxTimeMS(2000),
                lockedOrder.assignedRiderId ? User.findOneAndUpdate(
                    { _id: lockedOrder.assignedRiderId, lastProcessedOrderId: { $ne: lockedOrder._id } },
                    { $inc: { walletBalance: riderCredit, totalDeliveries: 1 }, $set: { lastProcessedOrderId: lockedOrder._id } },
                    { session, new: true }
                ).maxTimeMS(2000) : Promise.resolve(null),
                AdminWallet.findOneAndUpdate(
                    { date: todayString, shard: shardId }, 
                    { $inc: { totalPlatformRevenue: adminRevenue, totalRiderBonusesPaid: riderBonus, totalOrdersProcessed: 1, transactionCount: 1 } },
                    { session, new: true, upsert: true } 
                ).maxTimeMS(2000)
            ]);

            const settlementId = crypto.createHash('sha256').update(`${orderId}_DELIVERY_SETTLEMENT`).digest('hex');
            const ledgerEntries = [
                { settlementId, orderId, entityType: 'SYSTEM_CLEARING', type: 'DEBIT', amount: baseFoodCost, description: `Food Clearing` },
                { settlementId, orderId, entityType: 'RESTAURANT', entityId: lockedOrder.restaurantId, type: 'CREDIT', amount: restaurantCredit, balanceAfter: restaurantUpdate?.walletBalance || 0, description: `90% Food Payout` },
                { settlementId, orderId, entityType: 'ADMIN', type: 'CREDIT', amount: adminRevenue, description: `8% Revenue` }
            ];

            await LedgerEntry.insertMany(ledgerEntries, { session, ordered: false });

            const finalUpdate = await Order.updateOne(
                { _id: orderId, processingOwner: req.requestId, processingVersion: lockedOrder.processingVersion }, 
                { $set: { status: 'Delivered', paymentStatus: 'PAID', processingLock: false, isPaymentProcessed: true, settlementId, settlementStatus: 'COMPLETED' } },
                { session }
            );
            
            if (finalUpdate.modifiedCount === 0) throw { status: 409, code: 'LOCK_HIJACKED' };

            await session.commitTransaction();
            session.endSession();
            return res.status(200).json({ success: true, message: 'Delivered!', data: { settlementId } });

        } catch (err) {
            await session.abortTransaction();
            session.endSession();
            if (err.hasErrorLabel?.('TransientTransactionError') && attempt < MAX_RETRIES) continue;
            return res.status(err.status || 500).json({ success: false, error: err.code || 'FAILED', message: err.message });
        }
    }
};