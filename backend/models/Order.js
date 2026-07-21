const mongoose = require('mongoose');
const crypto = require('crypto');
const { VALID_ORDER_STATUSES, VALID_TRANSITIONS, VALID_ACTORS } = require('../constants/orderConstants');

/**
 * @description Order Schema for Food Samundar (The Absolute Master Copy ❄️)
 * 🛡️ FINANCIAL INTEGRITY: Enforces Safe Integer validation (Paisa) up to 2^53 - 1 boundaries.
 * 🔒 ATOMIC ARCHITECTURE COMPLIANT: 100% hook-free execution layer driven explicitly via static factories.
 */
const orderSchema = new mongoose.Schema({
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
    assignedRiderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    
    // Sequential Dispatch Queue Control Fields
    offeredRiderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    offerExpiresAt: { type: Date, default: null, index: true },
    currentDispatchIndex: { type: Number, default: -1 }, 
    
    // 🚀 INVARIANT HARDENING: Explicit boundary caps preventing document size memory bloat drops
    dispatchQueue: {
        type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        validate: {
            validator: (v) => v.length <= 100,
            message: 'Dispatch Invariant Violation: Array queue buffer bounds cannot exceed 100 candidate items.'
        }
    },
    
    // --- 🛒 Items Specification Matrix ---
    items: [{
        menuItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' }, 
        name: { type: String, required: true },
        price: { 
            type: Number, 
            required: true,
            min: 0,
            validate: { validator: Number.isSafeInteger, message: 'Price must be a Safe Paisa Integer.' } 
        },
        quantity: { type: Number, default: 1, min: 1 }
    }],

    // --- 💰 Financial Allocation (SAFE INTEGERS ONLY - PAISA) ---
    totalAmount: { type: Number, required: true, min: 0, validate: { validator: Number.isSafeInteger } },
    foodCost: { type: Number, default: 0, min: 0, validate: { validator: Number.isSafeInteger } }, 
    deliveryFee: { type: Number, default: 0, min: 0, validate: { validator: Number.isSafeInteger } }, 
    platformFee: { type: Number, default: 0, min: 0, validate: { validator: Number.isSafeInteger } }, 
    riderIncentive: { type: Number, default: 0, min: 0, validate: { validator: Number.isSafeInteger } },
    discountAmount: { type: Number, default: 0, min: 0, validate: { validator: Number.isSafeInteger } }, 
    taxAmount: { type: Number, default: 0, min: 0, validate: { validator: Number.isSafeInteger } },      

    // Pricing Forensic Snapshot for Business Auditing & Disputes Resolution
    pricingSnapshot: {
        couponCode: { type: String, default: null },
        taxPercentage: { type: Number, default: 0, min: 0 },
        commissionRate: { type: Number, default: 0, min: 0 },
        deliveryStrategy: { type: String, default: 'STANDARD' }
    },

    // --- 🛡️ Status Workflow Management ---
    status: { 
        type: String, 
        enum: VALID_ORDER_STATUSES, 
        default: 'Pending',
        index: true
    },
    
    statusUpdatedAt: {
        type: Date,
        default: Date.now,
        index: true
    },

    paymentStatus: { 
        type: String, 
        enum: ['PENDING', 'PAID', 'FAILED', 'REFUNDED'], 
        default: 'PENDING', 
        index: true 
    },

    paymentMethod: {
        type: String,
        enum: ['COD', 'ONLINE'],
        required: true
    },
    
    // Rich History Audit Log Timeline Array
    statusHistory: [{
        from: { type: String, enum: VALID_ORDER_STATUSES, required: true },
        to: { type: String, enum: VALID_ORDER_STATUSES, required: true },
        actorType: { type: String, enum: VALID_ACTORS, required: true },
        // 🚀 SUBDOC CONTEXT FIX: Dropped function required rules to block atomic array update query context failures.
        // Contract schema structural validation is delegated strictly to the factory layer payload builders instead.
        actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        changedAt: { type: Date, default: Date.now }
    }],
    dispatchHistory: [{
    riderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    action: {
        type: String,
        enum: ['OFFERED', 'REJECTED', 'EXPIRED', 'ACCEPTED'],
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}],

    otpUsed: { type: Boolean, default: false, index: true }, 
    isPaymentProcessed: { type: Boolean, default: false, index: true }, 
    
    paymentProvider: { 
        type: String, 
        default: null,
        uppercase: true,
        trim: true
    }, 
    paymentReference: { type: String, default: null },
    clientOrderId: { type: String, default: null },
    settlementId: { type: String, default: null, index: true },
    settlementStatus: {
        type: String,
        enum: ['PENDING','COMPLETED','FAILED','REVERSED'],
        default: 'PENDING',
        index: true
    }, 
    processingStartedAt: { type: Date },
    completedAt: { type: Date, default: null, index: true },
    otpAttempts: { type: Number, default: 0, min: 0 }, 
    
    // Secure OTP Infrastructure Tokens
    deliveryOTP: { type: String, default: null }, 
    deliveryOTPExpiresAt: { type: Date, default: null }, 
    
    // --- 📍 Logistics & Geolocation Metadata ---
    deliveryDetails: {
        address: { type: String, required: true },
        phone: { 
            type: String, 
            required: true,
            match: [/^\+?[0-9]{10,15}$/, 'Please provide a valid phone number structure.'] 
        },
        latitude: { type: Number },
        longitude: { type: Number }
    },

    riderLocation: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { 
            type: [Number], 
            default: undefined,
            validate: {
                validator: function(v) {
                    if (!v) return true;
                    return Array.isArray(v) && 
                           v.length === 2 && 
                           typeof v[0] === 'number' && Number.isFinite(v[0]) && v[0] >= -180 && v[0] <= 180 &&
                           typeof v[1] === 'number' && Number.isFinite(v[1]) && v[1] >= -90 && v[1] <= 90;
                },
                message: 'Invalid GeoJSON coordinates spatial layout.'
            }
        } 
    }

}, { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    autoIndex: false 
});

// =========================================================================
// 🔐 TIMING-SAFE STATIC & INSTANCE OTP UTILITIES
// =========================================================================

// Internal salt/pepper retrieval pattern configuration mapping rules
const getSystemPepperToken = () => process.env.OTP_SECRET || 'FoodSamundarSystemServerPepperStringSignatureHashToken';

orderSchema.statics.hashOTP = function(otp) {
    if (otp == null || String(otp).trim() === '') return null;
    return crypto.createHash('sha256').update(String(otp).trim() + getSystemPepperToken()).digest('hex');
};

orderSchema.statics.verifyTimingSafeOTP = function(rawOtp, storedHash, expiresAt, otpUsed) {
    if (otpUsed === true) return false; 
    if (rawOtp == null || String(rawOtp).trim() === '' || !storedHash || !expiresAt) return false;
    if (Date.now() > new Date(expiresAt).getTime()) return false;
    if (!/^[a-f0-9]{64}$/i.test(storedHash)) return false;

    const incomingHash = crypto.createHash('sha256').update(String(rawOtp).trim() + getSystemPepperToken()).digest();
    const existingHash = Buffer.from(storedHash, 'hex');

    if (incomingHash.length !== existingHash.length) return false;
    return crypto.timingSafeEqual(incomingHash, existingHash);
};

// =========================================================================
// 🚀 STATE ATOMIC UPDATE FACTORY UTILITIES
// =========================================================================

/**
 * Centralized Deterministic Update Payload Generation Factory
 */
orderSchema.statics.buildStatusUpdatePayload = function(fromStatus, toStatus, actorType, actorId = null) {
    if (!VALID_ORDER_STATUSES.includes(fromStatus)) {
        throw new Error(`State Machine Boundary Violation: Provided fromStatus [${fromStatus}] is not a recognized state machine entry metric.`);
    }
    if (!VALID_ORDER_STATUSES.includes(toStatus)) {
        throw new Error(`State Machine Boundary Violation: Provided toStatus [${toStatus}] is not a recognized state machine entry metric.`);
    }

    const normalizedActor = String(actorType).trim().toUpperCase();
    if (!VALID_ACTORS.includes(normalizedActor)) {
        throw new Error(`State Machine Security Exception: Provided actorType [${normalizedActor}] falls outside legal registration scopes: ${VALID_ACTORS.join(', ')}`);
    }

    if (normalizedActor === 'SYSTEM' && actorId != null) {
        throw new Error('Operational Invariant Breach: Automated SYSTEM routines cannot retain human actorId contextual tracking assignments references.');
    }

    const allowedTransitions = VALID_TRANSITIONS[fromStatus] || [];
    if (!allowedTransitions.includes(toStatus)) {
        throw new Error(`State Machine Refusal Exception: Status transition track path from [${fromStatus}] to [${toStatus}] configuration is strictly illegal.`);
    }

    if (normalizedActor !== 'SYSTEM') {
        if (!actorId || !mongoose.Types.ObjectId.isValid(actorId)) {
            throw new Error(`State Machine Context Exception: Real human user operations require a valid, non-null structural ObjectId representation.`);
        }
    }

    const currentExecutionTime = new Date();

    return {
        $set: {
            status: toStatus,
            statusUpdatedAt: currentExecutionTime
        },
        $push: {
            statusHistory: {
                from: fromStatus,
                to: toStatus,
                actorType: normalizedActor,
                actorId: normalizedActor === 'SYSTEM' ? null : new mongoose.Types.ObjectId(actorId),
                changedAt: currentExecutionTime
            }
        }
    };
};

/**
 * Automated Atomic Queue Advancement Payload Factory
 */
orderSchema.statics.buildNextDispatchPayload = function(dispatchQueue, currentIndex) {
    if (!Array.isArray(dispatchQueue)) {
        throw new Error("Dispatch Engine Core Error: Target dispatch validation parameters queue is malformed.");
    }
    
    if (currentIndex < -1 || currentIndex >= dispatchQueue.length) {
        throw new Error(`Dispatch State Invariant Corruption: Received dispatch index [${currentIndex}] drifts entirely out of bounds for current queue allocations array size [${dispatchQueue.length}].`);
    }
    
    const nextIndex = currentIndex + 1;
    const nextRiderId = dispatchQueue[nextIndex] || null;

    // Validate queue integrity before advancing dispatch
const uniqueRiders = new Set(dispatchQueue.map(id => id?.toString()));

if (uniqueRiders.size !== dispatchQueue.length) {
    throw new Error(
        "Dispatch Queue Integrity Violation: Duplicate rider detected inside dispatch queue."
    );
}

if (dispatchQueue.some(id => !id)) {
    throw new Error(
        "Dispatch Queue Integrity Violation: Null rider detected inside dispatch queue."
    );
}

if (nextRiderId && !mongoose.Types.ObjectId.isValid(nextRiderId)) {
    throw new Error(
        `Dispatch Invariant Violation: Extracted candidate unit identifier [${nextRiderId}] at queue index [${nextIndex}] fails strict ObjectId parsing rules.`
    );
}

    return {
    $set: {
        currentDispatchIndex: nextRiderId ? nextIndex : -1,
        offeredRiderId: nextRiderId
            ? new mongoose.Types.ObjectId(nextRiderId)
            : null,
        offerExpiresAt: nextRiderId
            ? new Date(Date.now() + 60 * 1000)
            : null,
        dispatchQueue: nextRiderId ? dispatchQueue : []
    }
};
};

/**
 * Programmatic Financial Reconciliation Validator Static Hook
 */
orderSchema.statics.validateFinancialBreakdown = function(financials, { includePlatformFee = true } = {}) {
    const keys = ['foodCost', 'deliveryFee', 'platformFee', 'taxAmount', 'discountAmount', 'totalAmount'];
    
    for (const key of keys) {
        const val = financials[key];
        if (val === undefined || typeof val === 'boolean' || !Number.isSafeInteger(val)) {
            throw new Error(`Financial Integrity Violation: Accounting data property key [${key}] must parse strictly as a valid finite safe integer primitive (Paisa).`);
        }
    }

    const { foodCost, deliveryFee, platformFee, taxAmount, discountAmount, totalAmount } = financials;
    const expectedTotal = (foodCost + deliveryFee + (includePlatformFee ? platformFee : 0) + taxAmount) - discountAmount;
    
    const isSane = expectedTotal >= 0 && totalAmount >= 0 && foodCost >= 0 && deliveryFee >= 0 && platformFee >= 0 && taxAmount >= 0 && discountAmount >= 0;
    const isMatched = totalAmount === expectedTotal;

    return {
        valid: isSane && isMatched,
        expectedTotal,
        actualTotal: totalAmount,
        delta: totalAmount - expectedTotal
    };
};

// =========================================================================
// ⚡ HIGH-SPEED PERFORMANCE STRATEGIC COMPOUND INDEXES
// =========================================================================

orderSchema.index({ customerId: 1, createdAt: -1 }); 
orderSchema.index({ riderLocation: "2dsphere" }, { sparse: true }); 
orderSchema.index({ assignedRiderId: 1, status: 1 }); 

// High-performance indices eliminating memory SORT_STAGE bottlenecks completely across dashboards queries
orderSchema.index({ restaurantId: 1, createdAt: -1, _id: -1 });
orderSchema.index({ restaurantId: 1, status: 1, createdAt: -1, _id: -1 }); 

// Dedicated dispatch query scanner indexing
orderSchema.index({ status: 1, offeredRiderId: 1, offerExpiresAt: 1 });
orderSchema.index({ status: 1, processingStartedAt: 1 }); 

// SLA Engine Poll Scanning compound index
orderSchema.index({ status: 1, statusUpdatedAt: 1 });

// Idempotency keys constraints structures
orderSchema.index(
    { customerId: 1, clientOrderId: 1 }, 
    { unique: true, partialFilterExpression: { clientOrderId: { $type: "string" } } }
);
orderSchema.index(
    { settlementId: 1 },
    {
        unique: true,
        partialFilterExpression: {
            settlementId: { $type: "string" }
        }
    }
);
// Multi-Gateway Tenant Isolation Indexing
orderSchema.index(
    { paymentProvider: 1, paymentReference: 1 },
    { unique: true, partialFilterExpression: { paymentReference: { $type: "string" }, paymentProvider: { $type: "string" } } }
);

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;