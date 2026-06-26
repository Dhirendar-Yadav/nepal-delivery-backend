const mongoose = require('mongoose');

/**
 * @description Wallet Ledger System - Enterprise Grade (Audit Safe)
 * 🛡️ Rule: All amounts stored in smallest unit (Paisa/Paisa equivalent) to avoid floating point errors.
 */

const walletTransactionSchema = new mongoose.Schema({
    // 👤 Owner (Whose wallet is being updated)
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true,
        index: true 
    },

    // 🏦 Wallet Identity
    walletType: {
        type: String,
        enum: ['ADMIN', 'RIDER', 'SELLER', 'CUSTOMER'],
        required: true
    },

    // 💰 Amount (STRICT: Store in Paisa. Example: NPR 100.50 = 10050)
    amount: { 
        type: Number, 
        required: true 
    },

    // 🔄 Direction
    direction: { 
        type: String, 
        enum: ['IN', 'OUT'], 
        required: true 
    },

    // 📢 Source of money movement
    source: { 
        type: String, 
        enum: ['ORDER', 'REFUND', 'PAYOUT', 'BONUS', 'PENALTY', 'SETTLEMENT'], 
        required: true 
    },

    // 🔗 Reference (Link to Order)
    referenceId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Order',
        index: true 
    },

    // 🧾 Audit Snapshot (Balance after this transaction)
    balanceAfter: { 
        type: Number, 
        required: true 
    },

    // 👮 Who triggered this?
    initiatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },

    initiatorRole: {
        type: String,
        enum: ['ADMIN', 'SYSTEM', 'USER'],
        default: 'SYSTEM'
    },

    // 🔁 Idempotency Key (Prevents duplicate entries on network retries)
    idempotencyKey: {
        type: String,
        unique: true,
        sparse: true
    },

    description: { 
        type: String, 
        trim: true 
    },

    status: { 
        type: String, 
        enum: ['PENDING', 'SUCCESS', 'FAILED'], 
        default: 'SUCCESS' 
    }

}, { timestamps: true });

// 🚀 Performance Indexes
walletTransactionSchema.index({ userId: 1, createdAt: -1 });
walletTransactionSchema.index({ referenceId: 1 });
walletTransactionSchema.index({ walletType: 1 });

module.exports = mongoose.model('WalletTransaction', walletTransactionSchema);