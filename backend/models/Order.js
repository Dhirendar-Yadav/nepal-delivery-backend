const mongoose = require('mongoose');
const crypto = require('crypto');

/**
 * @description Order Schema for Food Samundar (Final Titanium Version - Hardened)
 * 🛡️ FINANCIAL RULE: totalAmount = foodCost + deliveryFee.
 * 🔐 SECURITY: SHA-256 Hashing + Timing-Safe OTP Verification + Replay Protection.
 * 🚫 IMMUTABILITY: Delivered orders cannot be modified. Strict state transitions enforced.
 */
const orderSchema = new mongoose.Schema({
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
    assignedRiderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    
    // 🚀 INJECTED: Zomato/Swiggy Sequential Dispatch Locks & Timers
    offeredRiderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    offerExpiresAt: { type: Date, default: null, index: true },
    
    // 👇 For Sequential Nearest-Neighbor Dispatch
    dispatchQueue: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // List of nearest riders
    currentDispatchIndex: { type: Number, default: 0 }, // Current rider being offered
    // 👆 ========================================================
    
    // --- 🛒 Items List ---
    items: [{
        menuItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' }, 
        name: { type: String, required: true },
        price: { 
            type: Number, 
            required: true,
            min: 0,
            validate: { validator: Number.isInteger, message: 'Price must be Paisa (Integer).' } 
        },
        quantity: { type: Number, default: 1, min: 1 }
    }],

    // --- 💰 Financial Split (INTEGERS - PAISA) ---
    totalAmount: { type: Number, required: true, min: 0, validate: { validator: Number.isInteger } },
    foodCost: { type: Number, default: 0, min: 0, validate: { validator: Number.isInteger } }, 
    deliveryFee: { type: Number, default: 0, min: 0, validate: { validator: Number.isInteger } }, 
    platformFee: { type: Number, default: 0, min: 0, validate: { validator: Number.isInteger } }, 
    riderIncentive: { type: Number, default: 0, min: 0, validate: { validator: Number.isInteger } },

    // --- 🛡️ Order Lifecycle ---
    status: { 
        type: String, 
        enum: ['Pending', 'Confirmed', 'Cooking', 'Out for Delivery', 'PROCESSING', 'Delivered', 'Cancelled'], 
        default: 'Pending',
        index: true
    },
    paymentStatus: { 
        type: String, 
        enum: ['PENDING', 'PAID', 'FAILED', 'REFUNDED'], 
        default: 'PENDING', 
        index: true 
    },
    processingLock: { type: Boolean, default: false, index: true }, 
    
    processingOwner: { type: String, default: null }, // 🔒 Anti-Hijack Lock
    otpUsed: { type: Boolean, default: false }, // 🛡️ OTP Replay Protection
    
    prevStatus: { type: String, default: null }, 
    
    // --- 🔐 Locking & Idempotency ---
    isPaymentProcessed: { type: Boolean, default: false, index: true }, 
    paymentReference: { 
        type: String, 
        sparse: true 
    },
    clientOrderId: { type: String, sparse: true }, 
    version: { type: Number, default: 0 }, 
    processingStartedAt: { type: Date }, 
    
    // --- 🔑 Security (Hashed OTP) ---
    deliveryOTP: { type: String }, 
    deliveryOTPExpiresAt: { type: Date }, 
    
    // --- 📍 Logistics ---
    deliveryDetails: {
        address: { type: String, required: true },
        phone: { type: String, required: true },
        latitude: { type: Number },
        longitude: { type: Number }
    },

    riderLocation: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { 
            type: [Number], 
            default: undefined,
            validate: {
                validator: (v) => !v || (v.length === 2 && v[0] >= -180 && v[0] <= 180 && v[1] >= -90 && v[1] <= 90),
                message: 'Invalid GeoJSON coordinates'
            }
        } 
    },
    lastLocationUpdate: { type: Date, default: Date.now }

}, { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    autoIndex: false 
});

// ==========================================
// 🛡️ SECURITY & VERIFICATION METHODS
// ==========================================

orderSchema.methods.setHashedOTP = function(otp) {
    this.deliveryOTP = crypto.createHash('sha256').update(otp).digest('hex');
    this.otpUsed = false; // Reset flag when new OTP is generated
};

orderSchema.methods.verifyOTP = function(inputOTP) {
    // 🚀 CHATGPT FIX: OTP Replay Protection
    if (this.otpUsed) throw new Error('OTP has already been used.');
    
    if (!this.deliveryOTP || !this.deliveryOTPExpiresAt) throw new Error('OTP missing.');
    if (new Date() > this.deliveryOTPExpiresAt) throw new Error('OTP expired.');

    const hashedInput = crypto.createHash('sha256').update(inputOTP).digest();
    const storedBuffer = Buffer.from(this.deliveryOTP, 'hex');

    if (storedBuffer.length !== hashedInput.length || !crypto.timingSafeEqual(storedBuffer, hashedInput)) {
        throw new Error('Invalid OTP.');
    }

    // Mark as used and clear data
    this.otpUsed = true;
    this.deliveryOTP = null;
    this.deliveryOTPExpiresAt = null;
    return true;
};

// ==========================================
// 🛡️ MIDDLEWARE (GUARDS & STATE MACHINES)
// ==========================================

// Valid State Machine Transitions
const validTransitions = {
    'Pending': ['Confirmed', 'PROCESSING', 'Cancelled'],
    'PROCESSING': ['Pending', 'Confirmed', 'FAILED', 'Cancelled'],
    'Confirmed': ['Cooking', 'Out for Delivery', 'Cancelled'],
    'Cooking': ['Out for Delivery', 'Cancelled'],
    'Out for Delivery': ['Delivered', 'Cancelled'],
    'Delivered': [], // End state
    'Cancelled': []  // End state
};

orderSchema.pre('validate', function() {
    const computedFoodCost = this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    if (this.foodCost !== computedFoodCost) {
        throw new Error(`FATAL: foodCost mismatch.`);
    }

    if (this.totalAmount !== (this.foodCost + this.deliveryFee)) {
        throw new Error('FATAL: totalAmount mismatch.');
    }

    if (this.platformFee + this.riderIncentive > this.foodCost) {
        throw new Error('FATAL: Fee split exceeds food cost.');
    }
    
    // 🚀 CHATGPT FIX: Payment Integrity Guard
    if (this.paymentStatus === 'PAID' && !this.isPaymentProcessed) {
        throw new Error('CRITICAL: Inconsistent payment state. Status is PAID but isPaymentProcessed is false.');
    }
});

orderSchema.pre('save', function() {
    if (!this.isNew) {
        const protectedStatuses = ['Confirmed', 'Cooking', 'Out for Delivery', 'Delivered'];
        if (protectedStatuses.includes(this.status) && (this.isModified('items') || this.isModified('foodCost'))) {
            throw new Error('CRITICAL: Order items or pricing cannot be modified after confirmation.');
        }

        // 🚀 CHATGPT FIX: Strict State Transition Guard
        if (this.isModified('status')) {
            const prev = this.prevStatus || 'Pending';
            if (validTransitions[prev] && !validTransitions[prev].includes(this.status)) {
                throw new Error(`CRITICAL: Invalid status transition from ${prev} to ${this.status}`);
            }
            this.prevStatus = this.status;
            this.version += 1; // Optimistic locking bump
        }
    }

    if (this.status === 'Out for Delivery' && !this.assignedRiderId) {
        throw new Error('CRITICAL: Rider assignment required before Out for Delivery.');
    }
});

// ==========================================
// ⚡ INDEXING (Production-Safe & Hardened)
// ==========================================
orderSchema.index({ createdAt: -1 });
orderSchema.index({ customerId: 1, createdAt: -1 }); 
orderSchema.index({ riderLocation: "2dsphere" }, { sparse: true }); 
orderSchema.index({ assignedRiderId: 1, status: 1 }); 
orderSchema.index({ restaurantId: 1, status: 1 }); 
orderSchema.index({ status: 1, processingStartedAt: 1 }); 
orderSchema.index({ deliveryOTP: 1 });

// 🚀 CHATGPT FIX: High-speed index for finding available orders for riders
orderSchema.index({ status: 1, offeredRiderId: 1, offerExpiresAt: 1 });

orderSchema.index(
    { customerId: 1, clientOrderId: 1 }, 
    { unique: true, partialFilterExpression: { clientOrderId: { $exists: true } } }
);

orderSchema.index(
    { paymentReference: 1 },
    { unique: true, partialFilterExpression: { paymentReference: { $exists: true } } }
);

orderSchema.index(
    { status: 1, isPaymentProcessed: 1 },
    { partialFilterExpression: { status: { $in: ['Out for Delivery', 'PROCESSING'] } } }
);

const Order = mongoose.model('Order', orderSchema);

Order.cleanIndexes().catch(() => {});

module.exports = Order;