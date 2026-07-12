const mongoose = require('mongoose');
const crypto = require('crypto'); 

/**
 * @description Compute Visibility Flag
 * Hides restaurants that are suspended, manually closed, deleted, or inactive for 7+ days.
 */
function computeDiscoverable(doc) {
    const inactiveThreshold = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 Days in ms
    const lastActive = doc.lastActiveAt ? new Date(doc.lastActiveAt).getTime() : Date.now();

    return (
        doc.status === 'ACTIVE' &&
        doc.isOpen === true &&
        doc.isVerifiedByAdmin === true &&
        doc.isDeleted === false &&
        lastActive >= inactiveThreshold
    );
}

/**
 * @description Compute Popularity Score (Zomato-grade Ranking Algorithm)
 * Rewards high ratings & orders. Penalizes slow delivery times.
 */
function computePopularity(doc) {
    const orders = doc.ordersLast7Days || 0;
    const rating = doc.rating || 0;
    const clicks = doc.clicksLast24h || 0;
    const deliveryTime = doc.avgDeliveryTime || 30;

    return (orders * 0.5) + (rating * 20) + (clicks * 0.2) - (deliveryTime * 0.3);
}

/**
 * @description Restaurant Schema - Food Samundar HQ (Titanium Fintech & Logistics Edition)
 * Engineered for 10M+ records. 
 */
const restaurantSchema = new mongoose.Schema({
    // --- 👤 IDENTITY & SECURITY ---
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true, lowercase: true, minlength: 2, maxlength: 100 },
    slug: { type: String, unique: true, sparse: true, index: true }, 
    
    // --- 🚦 OPERATIONAL STATE & VISIBILITY ---
    status: { 
        type: String, 
        enum: ['PENDING', 'ACTIVE', 'SUSPENDED'], 
        default: 'PENDING' 
    },
    isVerifiedByAdmin: { type: Boolean, default: false },
    isOpen: { type: Boolean, default: true }, 
    lastActiveAt: { type: Date, default: Date.now, index: true }, 
    
    // 🕰️ Dynamic Time Management
    openingHours: [{
        day: { type: String, enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] },
        open: { type: String }, 
        close: { type: String } 
    }],

    // ✨ Precomputed flags
    isDiscoverable: { type: Boolean, default: false }, 
    isDeleted: { type: Boolean, default: false }, 
    deletedAt: { type: Date, default: null }, 

    // --- 📍 LOGISTICS & LOCATION ---
    location: { type: String, default: 'Nepal' }, 
    latitude: { type: Number },
    longitude: { type: Number },
    
    currentLocation: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { 
            type: [Number], 
            default: undefined,
            validate: {
                validator: (v) => !v || (Array.isArray(v) && v.length === 2 && Number.isFinite(v[0]) && Number.isFinite(v[1]) && v[0] >= -180 && v[0] <= 180 && v[1] >= -90 && v[1] <= 90),
                message: 'Invalid GeoJSON [lng, lat].'
            }
        } 
    },
    
    // --- 🍔 RESTAURANT PROFILE ---
    foodType: { type: String, default: 'Local Cuisine' },
    foodTypes: { type: [{ type: String }], default: [] }, // Enforced at API layer, not DB layer
    isPureVeg: { type: Boolean, default: false }, 
    image: { type: String },
    panVatNumber: { type: String, default: null, sparse: true }, 
    
    // ⭐ METRICS, MARKETING & RANKING
    rating: { type: Number, default: 0, min: 0, max: 5 },
    totalRatings: { type: Number, default: 0 },
    totalRatingSum: { type: Number, default: 0 }, 
    offerTag: { type: String, default: null }, 
    
    // 📈 Advanced Ranking Signals
    avgDeliveryTime: { type: Number, default: 30 }, 
    ordersLast7Days: { type: Number, default: 0 },
    clicksLast24h: { type: Number, default: 0 },
    popularityScore: { type: Number, default: 0, index: true }, 

    // ==========================================
    // 💰 FINANCIAL ENGINE (Atomic)
    // ==========================================
    walletBalance: { 
        type: Number, 
        default: 0,
        min: [0, 'Balance cannot be negative'],
        validate: { validator: Number.isInteger, message: 'Balance must be in Paisa (Integer)' }
    },
    totalEarnings: {
        type: Number,
        default: 0,
        validate: { validator: Number.isSafeInteger, message: 'Earnings must be integer paisa.' }
    },
    totalSettled: {
        type: Number,
        default: 0,
        validate: { validator: Number.isSafeInteger, message: 'Settled amount must be integer paisa.' }
    },
    
    commissionRate: { type: Number, default: 10, min: 0, max: 100 },

    lastProcessedOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    lastSettlementId: { type: String, default: null }, 
    walletVersion: { type: Number, default: 0 }, 
    transactionCount: { type: Number, default: 0 },

    payoutSettings: {
        method: { type: String, enum: ['eSewa', 'Khalti', 'Bank'], default: 'eSewa' },
        eSewaId: { type: String, default: null }, 
        bankDetails: {
            accountName: { type: String, default: null },
            accountNumber: { type: String, default: null, select: false }, 
            bankName: { type: String, default: null }
        }
    }

}, { 
    timestamps: true,
    versionKey: false 
});

// ==========================================
// 🛡️ MIDDLEWARES & GUARDS (Modernized - No 'next' required)
// ==========================================

restaurantSchema.pre('save', function() {
    // 📍 1. Auto-Generate GeoJSON safely
    if (this.latitude !== undefined && this.longitude !== undefined && (!this.currentLocation || !this.currentLocation.coordinates)) {
        this.currentLocation = {
            type: 'Point',
            coordinates: [this.longitude, this.latitude] 
        };
    }

    // 🚀 2. Precompute isDiscoverable Flag
    this.isDiscoverable = computeDiscoverable(this);

    // 🔗 3. Generate Deterministic Slug (Lock-free, handled in controller if collision occurs)
    if (!this.slug && this.name) {
        const base = this.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
        const hash = crypto.randomBytes(3).toString('hex'); 
        this.slug = `${base}-${hash}`;
    }

    // 🔄 4. Normalize foodTypes
    if (this.foodTypes && this.foodTypes.length > 0) {
        this.foodTypes = [...new Set(this.foodTypes.map(type => type.toLowerCase().trim()))];
    }

    // ⭐ 5. Strict Rating Math Enforcement
    if (this.totalRatings > 0) {
        this.rating = Math.round((this.totalRatingSum / this.totalRatings) * 10) / 10;
    } else {
        this.rating = 0;
    }

    // 📈 6. Precompute Popularity Score
    this.popularityScore = computePopularity(this);
});

// 💰 7. Financial Invariant Guard
restaurantSchema.pre('validate', function() {
    if (this.totalSettled > this.totalEarnings) {
        throw new Error('FATAL: Settled amount cannot exceed total earnings.');
    }
});

// ==========================================
// 🔄 UPDATE MIDDLEWARES
// ==========================================

restaurantSchema.pre(['findOneAndUpdate', 'updateOne'], async function() {
    const update = this.getUpdate();
    
    // 💰 Auto-Increment Wallet Version
    if (update.$inc && update.$inc['wallet.balance'] !== undefined) {
        update.$inc.walletVersion = (update.$inc.walletVersion || 0) + 1;
    }
    

    if (update.$set && Object.keys(update.$set).some(k => k.startsWith('wallet'))) {
        return next(new Error('CRITICAL: Wallet fields must use controlled atomic updates.'));
    }

    if (update.$unset && Object.keys(update.$unset).some(k => k.startsWith('wallet'))) {
        return next(new Error('CRITICAL: Wallet fields cannot be removed.'));
    }

    if (update.$rename && Object.keys(update.$rename).some(k => k.startsWith('wallet'))) {
        return next(new Error('CRITICAL: Wallet fields cannot be renamed.'));
    }

    if (update.$inc) {
        const allowedWalletInc = new Set([
            'wallet.balance',
            'wallet.totalEarnings',
            'wallet.totalSettled'
        ]);

        const invalid = Object.keys(update.$inc)
            .filter(k => k.startsWith('wallet') && !allowedWalletInc.has(k));

        if (invalid.length) {
            return next(new Error('CRITICAL: Invalid wallet increment field.'));
        }
    }

    if (update.$set || update.$inc) {
        const visibilityFields = ['status', 'isOpen', 'isVerifiedByAdmin', 'isDeleted', 'lastActiveAt'];
        const ratingFields = ['totalRatingSum', 'totalRatings'];
        const popularityFields = ['ordersLast7Days', 'clicksLast24h', 'avgDeliveryTime', ...ratingFields];
        
        const shouldRecomputeVisibility = update.$set && visibilityFields.some(f => update.$set[f] !== undefined);
        const shouldRecomputeRating = (update.$set && ratingFields.some(f => update.$set[f] !== undefined)) || (update.$inc && ratingFields.some(f => update.$inc[f] !== undefined));
        const shouldRecomputePopularity = shouldRecomputeRating || (update.$set && popularityFields.some(f => update.$set[f] !== undefined)) || (update.$inc && popularityFields.some(f => update.$inc[f] !== undefined));

        // 🔥 SINGLE FETCH OPTIMIZATION
        if (shouldRecomputeVisibility || shouldRecomputeRating || shouldRecomputePopularity) {
            const doc = await this.model.findOne(this.getQuery()).lean();
            
            if (doc) {
                const mergedDoc = { ...doc, ...(update.$set || {}) };
                
                if (update.$inc) {
                    for (const key in update.$inc) {
                        mergedDoc[key] = (mergedDoc[key] || 0) + update.$inc[key];
                    }
                }

                if (shouldRecomputeVisibility) {
                    if (!update.$set) update.$set = {};
                    update.$set.isDiscoverable = computeDiscoverable(mergedDoc);
                }

                if (shouldRecomputeRating) {
                    if (!update.$set) update.$set = {};
                    if (mergedDoc.totalRatings > 0) {
                        update.$set.rating = Math.round((mergedDoc.totalRatingSum / mergedDoc.totalRatings) * 10) / 10;
                    } else {
                        update.$set.rating = 0;
                    }
                    mergedDoc.rating = update.$set.rating; 
                }

                if (shouldRecomputePopularity) {
                    if (!update.$set) update.$set = {};
                    update.$set.popularityScore = computePopularity(mergedDoc);
                }
            }
        }
    }
});

// ==========================================
// ⚡ COMPOSITE INDEXING
// ==========================================

restaurantSchema.index({ isDiscoverable: 1, isPureVeg: 1, foodTypes: 1, rating: -1 });
restaurantSchema.index(
    { currentLocation: "2dsphere", isDiscoverable: 1 },
    { partialFilterExpression: { isDiscoverable: true, "currentLocation.coordinates": { $exists: true } } }
);
restaurantSchema.index({ isDiscoverable: 1, popularityScore: -1, rating: -1, foodTypes: 1 });
restaurantSchema.index({ rating: -1 });
restaurantSchema.index({ walletBalance: -1 }); 
restaurantSchema.index({ ownerId: 1 });
restaurantSchema.index({ createdAt: -1 });
restaurantSchema.index({ popularityScore: -1 });
restaurantSchema.index({ lastActiveAt: -1 });
restaurantSchema.index({ name: 'text', foodTypes: 'text' }, { weights: { name: 5, foodTypes: 3 } });

module.exports = mongoose.model('Restaurant', restaurantSchema);



