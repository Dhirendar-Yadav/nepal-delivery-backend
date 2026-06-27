const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * @description User Schema for Food Samundar (Titanium Fintech & Logistics Edition)
 * 🛡️ SECURITY: Passwords hidden by default, Soft-deletes enabled.
 * 💰 FINANCIALS: Wallet cache with versioning for optimistic locking.
 * 📍 LOGISTICS: GeoJSON 2dsphere indexing for finding nearby riders instantly.
 */
const userSchema = new mongoose.Schema({
    // --- 👤 IDENTITY & AUTH ---
    name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [80, 'Name cannot exceed 80 characters']
},
    email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    index: true,
    trim: true,
    lowercase: true
}, 
   password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters long'],
    select: false
},
    phone: {
    type: String,
    required: [true, 'Phone number is required'],
    unique: true,
    index: true,
    trim: true,
    validate: {
        validator: function (value) {
            return /^(98|97)\d{8}$/.test(value);
        },
        message: 'Please enter a valid Nepal mobile number.'
    }
}, 
    role: { 
        type: String, 
        enum: ['Customer', 'Seller', 'Rider', 'Admin'], 
        default: 'Customer',
        index: true 
    },
   businessName: {
    type: String,
    trim: true,
    required: [
        function () {
            return this.role === 'Seller';
        },
        'Business name is required for sellers.'
    ],
    maxlength: [120, 'Business name cannot exceed 120 characters']
},
    
    // --- 🛡️ ACCOUNT STATUS & COMPLIANCE ---
    isActive: { type: Boolean, default: true },
    isBlocked: { type: Boolean, default: false }, // For fraud control / banning
    isDeleted: { type: Boolean, default: false }, // Soft-delete (Never hard delete financial users)
    kycStatus: { 
        type: String, 
        enum: ['PENDING', 'VERIFIED', 'REJECTED'], 
        default: 'PENDING' 
    }, // 🏦 Required for payouts

    // --- 💰 FINANCIAL WALLET (Cached from Ledger) ---
    // NOTE: For Riders, walletBalance > 0 means they OWE the admin (COD Collected).
    walletBalance: { 
        type: Number, 
        default: 0,
        // Removed min: 0 because some roles might have negative balances (like advances), 
        // but kept integer validation for Paisa/Smallest Unit.
        validate: { 
            validator: (v) => Number.isInteger(v), 
            message: 'Wallet balance must be an integer (Smallest Currency Unit).' 
        }
    },
    walletVersion: { type: Number, default: 0 }, // 🔄 Optimistic locking for concurrency
    lastSettlementId: { type: String, default: null }, // 🔗 Ties wallet state to the exact Ledger Entry
    
    // --- 🛵 RIDER LOGISTICS & OPS ---
    totalDeliveries: { type: Number, default: 0, min: 0 },
    isOnline: { type: Boolean, default: false, index: true }, // Is rider ready for orders?
    
    // 🟢 NEW: Track exactly when the shift started for the 12-hour limit
    shiftStartTime: { type: Date, default: null },

    // 🟢 NEW: Track current order so Cron Job doesn't kick them mid-delivery
    currentActiveOrderId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Order', 
        default: null 
    },

    currentLocation: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { 
            type: [Number], // [longitude, latitude]
            default: undefined,
            validate: {
                validator: (v) => !v || (v.length === 2 && v[0] >= -180 && v[0] <= 180 && v[1] >= -90 && v[1] <= 90),
                message: 'Invalid GeoJSON coordinates'
            }
        }
    }

}, { 
    timestamps: true 
});

// ==========================================
// ⚡ INDEXING (For Hyper-Scale)
// ==========================================

userSchema.index({ "currentLocation": "2dsphere" }); 
userSchema.index({ role: 1, isOnline: 1 }); 
userSchema.index({ isDeleted: 1 }); 
// 🟢 NEW: Index for the Shift Monitor Cron Job to query faster
userSchema.index({ isOnline: 1, shiftStartTime: 1, currentActiveOrderId: 1 });

// 🛡️ Middleware: Auto-increment wallet version on financial updates
userSchema.pre(['findOneAndUpdate', 'updateOne', 'updateMany'], function(next) {
    const update = this.getUpdate();
    if (update.$inc && update.$inc.walletBalance !== undefined) {
        // If walletVersion is not manually provided in the update, increment it
        if (!update.$inc.walletVersion) {
            update.$inc.walletVersion = 1; 
        }
    }
    next();
});

module.exports = mongoose.model('User', userSchema);