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

    totalRiderBonusesPaid: { 
        type: Number, 
        default: 0,
        min: [0, "Bonuses cannot be negative."],
        validate: { validator: Number.isInteger, message: 'Bonus must be an integer (paisa).' }
    }, 

    // 📊 OPERATIONAL COUNTERS
    totalOrdersProcessed: { type: Number, default: 0 },
    totalRefundsProcessed: { type: Number, default: 0 },
    transactionCount: { type: Number, default: 0 },
    
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

// 1. Pre-Validate Guard: Ensure we never pay more in bonuses than we earn in revenue
adminWalletSchema.pre('validate', function(next) {
    if (this.totalRiderBonusesPaid > this.totalPlatformRevenue) {
        return next(new Error('FATAL: Bonuses paid cannot exceed total platform revenue.'));
    }
    next();
});

// 2. Update Guard: Safely handle upserts and increment versioning
adminWalletSchema.pre(['findOneAndUpdate', 'updateOne', 'updateMany'], async function(next) {
    const update = this.getUpdate();
    if (!update) return next();

    // Automatically increment the document version on every financial update
    if (update.$inc) {
        update.$inc.version = 1;
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