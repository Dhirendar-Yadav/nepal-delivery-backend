const mongoose = require('mongoose');
const Order = require('../models/Order');
const RiderProfile = require('../models/RiderProfile');
const Restaurant = require('../models/Restaurant');
const AdminWallet = require('../models/AdminWallet');
const WalletTransaction = require('../models/WalletTransaction');

/**
 * @description Atomic Order Delivery Engine (Bank-Grade)
 * 🛡️ Rule 1: Everything inside a MongoDB Session (Transaction).
 * 🛡️ Rule 2: No .save(). Only Atomic $inc and $set.
 * 🛡️ Rule 3: Idempotency keys to prevent double-payouts.
 */
const processOrderDelivery = async (orderId, adminId) => {
    // 1. Start Session for Transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // 2. Fetch Order and check status (Idempotency Guard)
        const order = await Order.findById(orderId).session(session);
        if (!order) throw new Error("Order not found");
        if (order.status === 'Delivered') throw new Error("Order already processed and delivered");

        const { foodCost, deliveryFee, platformFee, riderIncentive, restaurantId, assignedRiderId } = order;

        // 3. Update Admin Wallet (Cache Layer)
        await AdminWallet.findOneAndUpdate(
            {}, 
            { 
                $inc: { 
                    totalPlatformRevenue: platformFee, 
                    totalRiderBonusesPaid: riderIncentive,
                    totalOrdersProcessed: 1,
                    transactionCount: 1
                }
            }, 
            { session, upsert: true }
        );

        // 4. Update Rider Wallet (Balance + Release Status)
        const riderEarning = deliveryFee + riderIncentive;
        const riderUpdate = await RiderProfile.findOneAndUpdate(
            { userId: assignedRiderId },
            { 
                $inc: { 
                    "wallet.balance": riderEarning,
                    "wallet.incentiveEarnings": riderIncentive,
                    "wallet.transactionCount": 1
                },
                $set: { 
                    status: 'AVAILABLE', // Release rider for next order
                    "wallet.lastProcessedOrderId": orderId 
                }
            },
            { session, new: true }
        );
        if (!riderUpdate) throw new Error("Rider profile update failed");

        // 5. Update Restaurant Wallet
        const restaurantUpdate = await Restaurant.findOneAndUpdate(
            { _id: restaurantId },
            { 
                $inc: { 
                    "wallet.balance": foodCost,
                    "wallet.totalEarnings": foodCost,
                    "wallet.transactionCount": 1
                },
                $set: { "wallet.lastProcessedOrderId": orderId }
            },
            { session }
        );
        if (!restaurantUpdate) throw new Error("Restaurant update failed");

        // 6. Generate Ledger Entries (Source of Truth)
        // Creating 3 distinct records for Admin, Rider, and Seller
        const transactions = [
            {
                userId: adminId,
                walletType: 'ADMIN',
                amount: platformFee,
                direction: 'IN',
                source: 'ORDER',
                referenceId: orderId,
                balanceAfter: 0, // Computed in real-time for Audit
                description: `Commission for Order #${orderId}`,
                idempotencyKey: `ADMIN_${orderId}`
            },
            {
                userId: assignedRiderId,
                walletType: 'RIDER',
                amount: riderEarning,
                direction: 'IN',
                source: 'ORDER',
                referenceId: orderId,
                balanceAfter: riderUpdate.wallet.balance,
                description: `Earnings for Order #${orderId}`,
                idempotencyKey: `RIDER_${orderId}`
            },
            {
                userId: restaurantUpdate.ownerId,
                walletType: 'SELLER',
                amount: foodCost,
                direction: 'IN',
                source: 'ORDER',
                referenceId: orderId,
                balanceAfter: 0, 
                description: `Food cost for Order #${orderId}`,
                idempotencyKey: `SELLER_${orderId}`
            }
        ];

        await WalletTransaction.insertMany(transactions, { session });

        // 7. Finally, Mark Order as Delivered
        order.status = 'Delivered';
        await order.save({ session }); // This is safe because it's not a wallet update

        // 8. Commit everything to DB
        await session.commitTransaction();
        console.log(`✅ Order ${orderId} successfully processed and funds distributed.`);
        
        return { success: true, message: "Order processed successfully" };

    } catch (error) {
        // ❌ Rollback: If anything fails, revert all changes
        await session.abortTransaction();
        console.error("❌ Transaction Aborted:", error.message);
        return { success: false, error: error.message };
    } finally {
        session.endSession();
    }
};

module.exports = { processOrderDelivery };