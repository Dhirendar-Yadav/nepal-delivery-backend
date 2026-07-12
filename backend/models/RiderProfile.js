const mongoose = require('mongoose');

/**
 * @description Rider Profile Schema - Food Samundar HQ (CEO Hardened Version)
 * 🛡️ FINANCIAL: Integer (Paisa) + Balance Index for fast Payout discovery.
 * 🛰️ LOGISTICS: GeoJSON + Assignment Locking + Dispatch Optimization.
 */
const riderProfileSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true
    },
    
    // --- 🚦 RIDER STATE MACHINE ---
    status: { 
        type: String, 
        enum: ['OFFLINE', 'AVAILABLE', 'BUSY'], 
        default: 'OFFLINE'
    },

    // --- 🔒 ASSIGNMENT LOCKING ---
    currentOrderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        default: null
    },

    kycStatus: { 
        type: String, 
        enum: ['PENDING', 'APPROVED', 'REJECTED'], 
        default: 'PENDING'
    },
    isActive: { type: Boolean, default: true }, 

    // --- 🛰️ GEOJSON ENGINE (Strict Validation) ---
    currentLocation: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { 
            type: [Number], 
            default: undefined,
            validate: {
                validator: (v) => Array.isArray(v) && v.length === 2 && Number.isFinite(v[0]) && Number.isFinite(v[1]) && 
                                  v[0] >= -180 && v[0] <= 180 && // Longitude
                                  v[1] >= -90 && v[1] <= 90,     // Latitude
                message: 'Invalid GeoJSON [lng, lat].'
            }
        } 
    },
    lastLocationUpdateAt: { type: Date, default: Date.now },

    // --- 💰 FINANCIAL ENGINE (Integer + Idempotency) ---
    wallet: {
        balance: { 
            type: Number, 
            default: 0,
                        min: [0, 'Balance cannot be negative'],
            validate: { validator: Number.isSafeInteger, message: 'Balance must be integer paisa' }
        },
        lastProcessedOrderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Order'
        },
        incentiveEarnings: { type: Number, default: 0, min: 0, validate: Number.isSafeInteger },
        codPending: { type: Number, default: 0, min: 0, validate: Number.isSafeInteger },
        totalWithdrawn: { type: Number, default: 0, min: 0, validate: Number.isSafeInteger },
        
        // Audit & Concurrency
        transactionCount: { type: Number, default: 0, min: 0, validate: Number.isSafeInteger },
        walletVersion: { type: Number, default: 0, min: 0, validate: Number.isSafeInteger } 
    },

    // --- 📈 PERFORMANCE & AUDIT ---
    stats: {
        totalDeliveries: { type: Number, default: 0 },
        cancelCount: { type: Number, default: 0 },
        rating: { type: Number, default: 5, set: v => Math.round(v * 10) / 10 }
    },
    statusHistory: [{
        status: String,
        changedAt: { type: Date, default: Date.now }
    }],

    payoutMethod: {
        methodType: { type: String, enum: ['eSewa', 'Khalti', 'Bank'], default: 'eSewa' },
        accountNumber: { type: String, select: false },
        accountHolderName: { type: String }
    }

}, { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    autoIndex: false // 🔥 CEO FIX: Stop duplicate index collisions
});

/**
 * 🛡️ STRICT ATOMIC GUARD
 */
riderProfileSchema.pre('save', function(next) {
    if (this.isModified('wallet') && !this.isNew) {
        return next(new Error('CRITICAL: Wallet fields must use controlled atomic updates.'));
    }
    next();
});


riderProfileSchema.pre(['findOneAndUpdate','updateOne','updateMany'], function(next) {
    const update = this.getUpdate();

    const allowedWalletInc = new Set([
        'wallet.balance',
        'wallet.incentiveEarnings',
        'wallet.codPending',
        'wallet.totalWithdrawn',
        'wallet.transactionCount',
        'wallet.walletVersion'
    ]);

    if (update?.$set && Object.keys(update.$set).some(k => k.startsWith('wallet'))) {
        return next(new Error('CRITICAL: Wallet fields must use controlled atomic updates.'));
    }

    if (update?.$unset && Object.keys(update.$unset).some(k => k.startsWith('wallet'))) {
        return next(new Error('CRITICAL: Wallet fields cannot be removed.'));
    }

    if (update?.$rename && Object.keys(update.$rename).some(k => k.startsWith('wallet'))) {
        return next(new Error('CRITICAL: Wallet fields cannot be renamed.'));
    }

    if (update?.$inc) {

        update.$inc['wallet.walletVersion'] =
            (update.$inc['wallet.walletVersion'] || 0) + 1;

        const invalid = Object.keys(update.$inc)
            .filter(k => k.startsWith('wallet') && !allowedWalletInc.has(k));

        if (invalid.length) {
            return next(new Error('CRITICAL: Invalid wallet increment field.'));
        }
    }
    next();
});

// ==========================================
// ⚡ INDEXING (Production-Ready Search)
// ==========================================

// 1. Unique User Profile
riderProfileSchema.index(
    { userId: 1 },
    { unique: true, partialFilterExpression: { isActive: true } }
);

// 2. Optimized Dispatch Index
riderProfileSchema.index(
    { status: 1, currentLocation: "2dsphere" },
    { partialFilterExpression: { status: 'AVAILABLE', isActive: true } }
);

// 3. Financial Hub Query Fix (ChatGPT Point #7)
riderProfileSchema.index({ "wallet.balance": 1 }); 

// 4. Assignment Lock Index
riderProfileSchema.index({ currentOrderId: 1 }, { sparse: true });

// Virtual for Dashboard
riderProfileSchema.virtual('readableBalance').get(function() {
    return (this.wallet.balance / 100).toFixed(2);
});

const RiderProfile = mongoose.model('RiderProfile', riderProfileSchema);

// Cleanup stale indexes
RiderProfile.cleanIndexes().catch(() => {});

module.exports = RiderProfile;



