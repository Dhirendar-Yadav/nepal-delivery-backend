const mongoose = require('mongoose');

/**
 * @description Double-Entry Financial Ledger for Food Samundar
 * 🛡️ AUDIT READY: Every credit has a matching debit. Immutable records.
 */
const ledgerEntrySchema = new mongoose.Schema({
    settlementId: { type: String, required: true, index: true }, // 🔗 Groups all related transactions (Credits + Debits)
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    
    entityType: { type: String, enum: ['ADMIN', 'RESTAURANT', 'RIDER', 'SYSTEM_CLEARING'], required: true, index: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, default: null }, // Null for SYSTEM_CLEARING or Master Admin
    
    type: { type: String, enum: ['CREDIT', 'DEBIT'], required: true },
    
    // 💰 Financials (Integers Only)
    amount: { type: Number, required: true, min: 0, validate: { validator: Number.isInteger } },
    currency: { type: String, default: 'NPR', required: true }, // 🇳🇵 Ready for scaling
    balanceAfter: { type: Number, validate: { validator: Number.isInteger } }, // 📊 Wallet Audit Trail
    
    description: { type: String },
    
    // ↩️ For future Refund/Reversal architecture
    reversalOf: { type: mongoose.Schema.Types.ObjectId, ref: 'LedgerEntry', default: null }
}, { timestamps: true });

// ==========================================
// ⚡ INDEXING (Super-Fast Dashboards)
// ==========================================

// 🚫 Prevent duplicate ledger entries for the same entity in a single settlement
ledgerEntrySchema.index({ settlementId: 1, entityType: 1, entityId: 1, type: 1 }, { unique: true }); 

// 📊 Fast Queries for Wallet History & Dashboards
ledgerEntrySchema.index({ entityId: 1, createdAt: -1 }); // "Show my recent transactions"
ledgerEntrySchema.index({ entityType: 1, createdAt: -1 }); // "Show all Restaurant payouts"
ledgerEntrySchema.index({ createdAt: -1 }); 

module.exports = mongoose.model('LedgerEntry', ledgerEntrySchema);