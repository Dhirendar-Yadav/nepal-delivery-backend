const mongoose = require('mongoose');

/**
 * @description Admin Daily Wallet Ledger - Food Samundar HQ (Enterprise Sharded Version)
 * 🛡️ FINANCIAL RULE: Stored strictly in INTEGERS (Paisa) to prevent floating-point errors.
 * 🛡️ SHARDING RULE: One document per day (YYYY-MM-DD) to prevent database write bottlenecks.
 */
const adminWalletSchema = new mongoose.Schema({
    // 📅 Daily Shard Key (Replaces the old 'MASTER' singleton rule)
    date: { 
        type: String, 
        required: true,
        unique: true,
        index: true,
        match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format.'] 
    },

    // 💰 REVENUE TRACKING (In Paisa)
    totalPlatformRevenue: { 
        type: Number, 
        default: 0,
        min: [0, "Revenue cannot be negative."],
        validate: { validator: Number.isInteger, message: 'Revenue must be an integer (paisa).' }
    }, 

    totalDigitalDebtRecovery: {
        type: Number,
        default: 0,
        min: [0, "Collected cash cannot be negative."],
        validate: {
            validator: Number.isInteger,
            message: "Collected cash must be an integer (paisa)."
        }
    },

    totalRiderBonusesPaid: { 
        type: Number, 
        default: 0,
        min: [0, "Bonuses cannot be negative."],
        validate: { validator: Number.isInteger, message: 'Bonus must be an integer (paisa).' }
    }, 

    // 📊 OPERATIONAL COUNTERS
    totalOrdersProcessed: { type: Number, default: 0, min: 0 },
    totalRefundsProcessed: { type: Number, default: 0, min: 0 },
    transactionCount: { type: Number, default: 0, min: 0 },
    
    // 🛡️ LEDGER INTEGRITY
    version: { type: Number, default: 0 }

}, { 
    timestamps: true,
    toJSON: { virtuals: true }, 
    toObject: { virtuals: true }
});

// ==========================================
// 🛡️ MIDDLEWARES (GUARDS)
// ==========================================

// 2. Update Guard: Safely handle upserts and increment versioning
adminWalletSchema.pre(['findOneAndUpdate', 'updateOne', 'updateMany'], async function(next) {
    const update = this.getUpdate();
    if (!update) return next();

    // Automatically increment the document version on every financial update
    if (update.$inc) {
        update.$inc.version = (update.$inc.version || 0) + 1;
    }


    if (update.$set && Object.keys(update.$set).some(k =>
        k.startsWith('total') || k === 'transactionCount' || k === 'version'
    )) {
        return next(new Error('CRITICAL: Financial fields must use controlled atomic updates.'));
    }

    if (update.$unset && Object.keys(update.$unset).some(k =>
        k.startsWith('total') || k === 'transactionCount' || k === 'version'
    )) {
        return next(new Error('CRITICAL: Financial fields cannot be removed.'));
    }

    if (update.$rename && Object.keys(update.$rename).some(k =>
        k.startsWith('total') || k === 'transactionCount' || k === 'version'
    )) {
        return next(new Error('CRITICAL: Financial fields cannot be renamed.'));
    }

    if (update.$inc) {
        const allowedInc = new Set([
            'totalPlatformRevenue',
            'totalRiderBonusesPaid',
            'totalDigitalDebtRecovery',
            'totalOrdersProcessed',
            'totalRefundsProcessed',
            'transactionCount',
            'version'
        ]);

        const invalid = Object.keys(update.$inc)
            .filter(k => !allowedInc.has(k));

        if (invalid.length) {
            return next(new Error('CRITICAL: Invalid financial increment field.'));
        }
    }

    next();
});

// ==========================================
// 🧠 VIRTUALS (For Admin Dashboard Display)
// ==========================================

adminWalletSchema.virtual('netCompanyProfit').get(function() {
    return this.totalPlatformRevenue - this.totalRiderBonusesPaid;
});

adminWalletSchema.virtual('readableRevenue').get(function() {
    return (this.totalPlatformRevenue / 100).toFixed(2);
});

adminWalletSchema.virtual('readableProfit').get(function() {
    return (this.netCompanyProfit / 100).toFixed(2);
});

// ==========================================
// ⚡ INDEXING
// ==========================================
adminWalletSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AdminWallet', adminWalletSchema);
