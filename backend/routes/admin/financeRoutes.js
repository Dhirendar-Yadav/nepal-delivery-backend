const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const crypto = require('crypto');

const Restaurant = require('../../models/Restaurant');
const AdminWallet = require('../../models/AdminWallet');
const RiderProfile = require('../../models/RiderProfile');
const LedgerEntry = require('../../models/LedgerEntry');

// 🛡️ FIX: Ab ye naye financeController ko point kar raha hai
const financeController = require('../../controllers/admin/financeController');
const { verifyAdmin, criticalLimiter } = require('../../middlewares/adminAuth');

const generateHash = (...args) => crypto.createHash('sha256').update(args.join('_')).digest('hex');

// 🛡️ DYNAMIC MODELS
const AdminAuditLog = mongoose.models.AdminAuditLog || mongoose.model('AdminAuditLog', new mongoose.Schema({
    _id: String, adminId: String, action: String, targetType: String, batchId: String, cursor: String, 
    createdAt: { type: Date, default: Date.now, expires: 7776000 } 
}));
const BulkPayoutFailure = mongoose.models.BulkPayoutFailure || mongoose.model('BulkPayoutFailure', new mongoose.Schema({
    batchId: String, entityId: String, targetType: String, amount: Number, reason: String,
    retryCount: { type: Number, default: 0 }, status: { type: String, enum: ['PENDING', 'RETRYING', 'FAILED'], default: 'PENDING' },
    createdAt: { type: Date, default: Date.now }
}));
const BulkPayoutBatch = mongoose.models.BulkPayoutBatch || mongoose.model('BulkPayoutBatch', new mongoose.Schema({
    _id: String, targetType: String, status: { type: String, enum: ['PROCESSING', 'COMPLETED', 'PARTIAL', 'FAILED'], default: 'PROCESSING' },
    totalProcessed: { type: Number, default: 0 }, totalFailed: { type: Number, default: 0 }, totalAmount: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
}));
const SystemLock = mongoose.models.SystemLock || mongoose.model('SystemLock', new mongoose.Schema({
    _id: String, isLocked: Boolean, ownerId: String, lockedAt: { type: Date, default: Date.now, expires: 300 }
}));

// ==========================================
// 💸 FINANCIAL HUB (CEO CONTROL)
// ==========================================

router.get('/financial-hub', verifyAdmin, criticalLimiter, async (req, res) => {
    try {
        const riders = await RiderProfile.find({ "wallet.balance": { $gt: 0 } }).select('userId wallet.balance stats isActive cancelCount').populate('userId', 'name phone').lean();
        const sellers = await Restaurant.find({ "walletBalance": { $gt: 0 } }).select('name walletBalance status totalEarnings').lean();
        const wallet = await AdminWallet.findOne({ walletType: 'MASTER' }).lean();

        res.json({ success: true, data: { pendingRiderPayouts: riders, pendingSellerSettlements: sellers, masterWallet: wallet } });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// 🛡️ FIX: Using financeController here
router.post('/restaurants/:id/settle', verifyAdmin, criticalLimiter, financeController.processRestaurantSettlement);

// 💰 ELITE FINTECH-GRADE BULK SETTLEMENT
router.post('/payouts/bulk-approve', verifyAdmin, criticalLimiter, async (req, res) => {
    try {
        const { targetType, batchId, lastId } = req.body; 
        if (!batchId) throw new Error("Idempotency Batch ID is required.");
        
        const chunkHash = generateHash(req.user.id, targetType, batchId, lastId || 'start');
        const lockKey = `BULK_LOCK_${batchId}`;
        const ownerSignature = `${req.user.id}_${Date.now()}`;

        const acquireLock = await SystemLock.findOneAndUpdate(
            { _id: lockKey, isLocked: { $ne: true } },
            { $set: { isLocked: true, ownerId: ownerSignature, lockedAt: new Date() } },
            { upsert: true, new: true }
        ).catch(err => { if (err.code === 11000) return null; throw err; });

        if (!acquireLock || acquireLock.ownerId !== ownerSignature) {
            return res.status(429).json({ success: false, message: "Batch is currently being processed by another instance." });
        }

        try {
            await AdminAuditLog.create({ _id: chunkHash, adminId: req.user.id, action: 'BULK_PAYOUT_CHUNK', targetType, batchId, cursor: lastId || null });
            await BulkPayoutBatch.findOneAndUpdate({ _id: batchId }, { $setOnInsert: { targetType, status: 'PROCESSING' } }, { upsert: true });
        } catch (err) {
            await SystemLock.deleteOne({ _id: lockKey, ownerId: ownerSignature });
            if (err.code === 11000) return res.status(200).json({ success: true, message: "Idempotent: Chunk already processed." });
            throw err;
        }

        let processedCount = 0, failedCount = 0, totalPayoutAmount = 0, nextCursor = null, entities = [];

        if (targetType === 'RIDER') {
            let query = { "wallet.balance": { $gt: 0 }, $or: [{ cancelCount: { $lte: 2 } }, { cancelCount: { $exists: false } }] };
            if (lastId && mongoose.Types.ObjectId.isValid(lastId)) query._id = { $gt: new mongoose.Types.ObjectId(lastId) };
            entities = await RiderProfile.find(query).sort({ _id: 1 }).limit(50); 
        } else if (targetType === 'SELLER') {
            let query = { walletBalance: { $gt: 0 }, status: 'ACTIVE' };
            if (lastId && mongoose.Types.ObjectId.isValid(lastId)) query._id = { $gt: new mongoose.Types.ObjectId(lastId) };
            entities = await Restaurant.find(query).sort({ _id: 1 }).limit(50);
        } else {
            await SystemLock.deleteOne({ _id: lockKey, ownerId: ownerSignature });
            throw new Error("Invalid target type.");
        }

        for (const entity of entities) {
            const session = await mongoose.startSession();
            session.startTransaction();
            try {
                const payoutAmount = targetType === 'RIDER' ? entity.wallet.balance : entity.walletBalance;
                const settlementId = generateHash(chunkHash, entity._id.toString());
                
                const adminWalletUpdate = await AdminWallet.findOneAndUpdate(
                    { walletType: 'MASTER', availableBalance: { $gte: payoutAmount } },
                    { $inc: { availableBalance: -payoutAmount } }, { session, new: true }
                );

                if (!adminWalletUpdate) throw new Error("Insufficient funds in Master Wallet.");

                let updatedEntity;
                if (targetType === 'RIDER') {
                    updatedEntity = await RiderProfile.findOneAndUpdate({ _id: entity._id, "wallet.balance": payoutAmount }, { $set: { "wallet.balance": 0 } }, { session, new: true });
                } else {
                    updatedEntity = await Restaurant.findOneAndUpdate({ _id: entity._id, walletBalance: payoutAmount }, { $inc: { walletBalance: -payoutAmount, totalSettled: payoutAmount, walletVersion: 1 } }, { session, new: true });
                }

                if (!updatedEntity) throw new Error("Balance snapshot mismatch (Race condition).");

                const ledgerEntries = [
                    { settlementId, orderId: null, entityType: targetType, entityId: targetType === 'RIDER' ? entity.userId : entity._id, type: 'CREDIT', amount: payoutAmount, balanceAfter: 0, description: `Bulk Payout via Admin (Batch: ${batchId})` },
                    { settlementId, orderId: null, entityType: 'SYSTEM_CLEARING', entityId: 'MASTER_WALLET', type: 'DEBIT', amount: payoutAmount, balanceAfter: adminWalletUpdate.availableBalance, description: `Master Wallet Bulk Deduction (Batch: ${batchId})` }
                ];

                await LedgerEntry.insertMany(ledgerEntries, { session, ordered: false });
                await session.commitTransaction();
                processedCount++; totalPayoutAmount += payoutAmount; nextCursor = entity._id;
            } catch (err) {
                await session.abortTransaction(); failedCount++;
                await BulkPayoutFailure.create({ batchId, entityId: entity._id.toString(), targetType, amount: 0, reason: err.message });
            } finally { session.endSession(); }
        }

        let finalBatchStatus = entities.length < 50 ? (failedCount === 0 ? 'COMPLETED' : 'PARTIAL') : 'PROCESSING';
        await BulkPayoutBatch.updateOne({ _id: batchId }, { $inc: { totalProcessed: processedCount, totalFailed: failedCount, totalAmount: totalPayoutAmount }, $set: { status: finalBatchStatus } });
        await SystemLock.deleteOne({ _id: lockKey, ownerId: ownerSignature });

        res.json({ success: true, message: `Batch chunk processed.`, stats: { processed: processedCount, failed: failedCount, totalAmount: totalPayoutAmount, batchId, status: finalBatchStatus }, nextCursor: entities.length === 50 ? nextCursor : null });
    } catch (err) {
        if (req.user && req.user.id) await SystemLock.deleteOne({ _id: `BULK_LOCK_${req.body.batchId}` }).catch(() => {});
        res.status(400).json({ success: false, message: err.message });
    }
});

module.exports = router;