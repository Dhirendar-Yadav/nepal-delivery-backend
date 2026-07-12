const mongoose = require('mongoose');

/**
 * @description Double-Entry Financial Ledger for Food Samundar
 * 🛡️ AUDIT READY: Every credit has a matching debit. Immutable records.
 */
const ledgerEntrySchema = new mongoose.Schema({
    settlementId: { type: String, required: true, index: true }, // 🔗 Groups all related transactions (Credits + Debits)
    orderId: { 
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        default: null,
        index: true
    },
    
    entityType: { type: String, enum: ['ADMIN', 'RESTAURANT', 'RIDER', 'SYSTEM_CLEARING'], required: true, index: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, default: null }, // Null for SYSTEM_CLEARING or Master Admin
    
    type: { type: String, enum: ['CREDIT', 'DEBIT'], required: true },
    
    // 💰 Financials (Integers Only)
    amount: {
        type: Number,
        required: true,
        min: 1,
        validate: {
            validator: Number.isSafeInteger,
            message: 'Amount must be stored as an integer (smallest currency unit).'
        }
    },
    currency: { type: String, default: 'NPR', required: true }, // 🇳🇵 Ready for scaling
    balanceAfter: {
        type: Number,
        validate: {
            validator: (v) => v == null || Number.isSafeInteger(v),
            message: 'Balance must be stored as an integer (smallest currency unit).'
        }
    }, // 📊 Wallet Audit Trail
    
    description: {
        type: String,
        trim: true,
        maxlength: 500
    },
    
    // ↩️ For future Refund/Reversal architecture
    reversalOf: { type: mongoose.Schema.Types.ObjectId, ref: 'LedgerEntry', default: null }
}, { timestamps: true });

// ==========================================
// ⚡ INDEXING (Super-Fast Dashboards)
// ==========================================

// 🚫 Prevent duplicate ledger entries for the same entity in a single settlement
ledgerEntrySchema.index(
    { settlementId: 1, entityType: 1, entityId: 1, type: 1 },
    { unique: true, partialFilterExpression: { entityId: { $ne: null } } }
); 

// 📊 Fast Queries for Wallet History & Dashboards


// SYSTEM_CLEARING duplicate protection
ledgerEntrySchema.index(
    { settlementId: 1, entityType: 1, type: 1 },
    {
        unique: true,
        partialFilterExpression: { entityType: "SYSTEM_CLEARING" }
    }
);

ledgerEntrySchema.index({ entityId: 1, createdAt: -1 }); // "Show my recent transactions"
ledgerEntrySchema.index({ entityType: 1, createdAt: -1 }); // "Show all Restaurant payouts"
ledgerEntrySchema.index({ createdAt: -1 }); 



// ==========================================
// ??? IMMUTABLE LEDGER PROTECTION
// ==========================================

ledgerEntrySchema.pre('findOneAndUpdate', function(next) {
    next(new Error('LedgerEntry is immutable. Updates are not allowed.'));
});

ledgerEntrySchema.pre('updateOne', function(next) {
    next(new Error('LedgerEntry is immutable. Updates are not allowed.'));
});

ledgerEntrySchema.pre('updateMany', function(next) {
    next(new Error('LedgerEntry is immutable. Updates are not allowed.'));
});

ledgerEntrySchema.pre('deleteOne', function(next) {
    next(new Error('LedgerEntry is immutable. Deletes are not allowed.'));
});

ledgerEntrySchema.pre('deleteMany', function(next) {
    next(new Error('LedgerEntry is immutable. Deletes are not allowed.'));
});

module.exports = mongoose.model('LedgerEntry', ledgerEntrySchema);


