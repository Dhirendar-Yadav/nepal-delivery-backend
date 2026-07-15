const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const RiderProfile = require('../models/RiderProfile');
const Order = require('../models/Order');
const Restaurant = require('../models/Restaurant');
const AdminWallet = require('../models/AdminWallet');
const LedgerEntry = require('../models/LedgerEntry');
const dispatchService = require('../services/dispatchService');

// Validation helpers
const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validatePhone = (phone) => /^[0-9]{10}$/.test(phone.replace(/[^\d]/g, ''));
const sanitizeInput = (str) => String(str).trim().substring(0, 255);

/**
 * ✨ 1. RIDER ONBOARDING REGISTRATION
 * Security: Input validation, sanitization, rate limiting, secure URLs
 */
exports.signup = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { fullName, email, password, phone, licenseNumber, bikeNumber, citizenshipNo, nidNumber } = req.body;

        // Input validation
        if (!fullName || !email || !password || !phone) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }

        if (!validateEmail(email)) {
            return res.status(400).json({ success: false, message: "Invalid email format" });
        }

        if (!validatePhone(phone)) {
            return res.status(400).json({ success: false, message: "Invalid phone number format" });
        }

        if (password.length < 8) {
            return res.status(400).json({ success: false, message: "Password must be at least 8 characters" });
        }

        // Prevent duplicate registrations
        const existingUser = await User.findOne({ email: email.toLowerCase() }).session(session);
        if (existingUser) {
            await session.abortTransaction();
            session.endSession();
            return res.status(409).json({ success: false, message: "Email already registered" });
        }

        // Hash password with proper salt
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create user with transaction
        const newUser = new User({
            name: sanitizeInput(fullName),
            email: email.toLowerCase(),
            password: hashedPassword,
            phone: sanitizeInput(phone),
            role: 'Rider'
        });
        await newUser.save({ session });

        // Build file URLs using environment variable
        const baseUrl = process.env.UPLOAD_BASE_URL || 'http://localhost:5005';
        const files = req.files || {};
        const getUrl = (fieldname) => {
            return files[fieldname] ? `${baseUrl}/uploads/${files[fieldname][0].filename}` : null;
        };

        // Create rider profile with transaction
        const newRider = new RiderProfile({
            userId: newUser._id,
            licenseNumber: sanitizeInput(licenseNumber),
            bikeNumber: sanitizeInput(bikeNumber),
            citizenshipNo: sanitizeInput(citizenshipNo),
            nidNumber: sanitizeInput(nidNumber),
            citizenshipFront: getUrl('citizenshipFront'),
            citizenshipBack: getUrl('citizenshipBack'),
            licenseFront: getUrl('licenseFront'),
            nidDoc: getUrl('nidDoc'),
            bluebookDoc: getUrl('bluebookImage'),
            isVerified: false,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        await newRider.save({ session });
        await session.commitTransaction();
        session.endSession();

        return res.status(201).json({ 
            success: true,
            message: "Rider account created. Pending admin approval",
            userId: newUser._id 
        });
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        console.error('Signup error:', err);
        return res.status(500).json({ success: false, message: "Registration failed. Please try again" });
    }
};

/**
 * ✨ 2. RETRIEVE METRIC PROFILE FEED
 * Security: Consistent data retrieval, no fallback leaks
 */
exports.getProfile = async (req, res) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        let profile = await RiderProfile.findOne({ 
            userId: new mongoose.Types.ObjectId(req.user.id) 
        }).lean();

        const user = await User.findById(req.user.id).lean();
        if (!user) {
            return res.status(404).json({ success: false, message: "User account not found" });
        }

        // Merge data with consistent fallback
        const mergedData = {
            userId: user._id,
            ...(profile || {}),
            bikeNumber: profile?.bikeNumber || 'Not Set',
            licenseNumber: profile?.licenseNumber || 'Not Set',
            citizenshipNo: profile?.citizenshipNo || 'Not Set',
            phone: user?.phone || 'Not Set',
            email: user?.email || 'Not Set',
            name: user?.name || 'Not Set',
            isOnline: user?.isOnline === true,
            shiftStartTime: user?.shiftStartTime || null,
            walletBalance: Math.max(0, profile?.wallet?.balance || 0),
            citizenshipFront: profile?.documents?.citizenshipFront || profile?.citizenshipFront || null,
            citizenshipBack: profile?.documents?.citizenshipBack || profile?.citizenshipBack || null,
            licenseFront: profile?.documents?.licenseFront || profile?.licenseFront || null,
            bluebookDoc: profile?.documents?.bluebookDoc || profile?.documents?.bluebookImage || null,
            isVerified: profile?.isVerified === true
        };

        return res.status(200).json(mergedData);
    } catch (err) {
        console.error('Get profile error:', err);
        return res.status(500).json({ success: false, message: "Failed to retrieve profile" });
    }
};

/**
 * ✨ 3. UPDATE RIDER LOGISTICAL ASSET IDENTIFIER
 * Security: Input validation for bike number
 */
exports.updateBike = async (req, res) => {
    try {
        if (!req.body.bikeNumber) {
            return res.status(400).json({ success: false, message: "Bike number is required" });
        }

        const bikeNumber = sanitizeInput(req.body.bikeNumber);
        if (bikeNumber.length > 20) {
            return res.status(400).json({ success: false, message: "Bike number too long" });
        }

        const updatedProfile = await RiderProfile.findOneAndUpdate(
            { userId: new mongoose.Types.ObjectId(req.user.id) },
            { bikeNumber, updatedAt: new Date() },
            { new: true, runValidators: true }
        );

        if (!updatedProfile) {
            return res.status(404).json({ success: false, message: "Rider profile not found" });
        }

        return res.status(200).json({ 
            success: true,
            message: "Bike updated successfully",
            bikeNumber: updatedProfile.bikeNumber 
        });
    } catch (err) {
        console.error('Update bike error:', err);
        return res.status(500).json({ success: false, message: "Failed to update bike number" });
    }
};

/**
 * ✨ 4. FETCH SCANNING RADAR OFFERS Matrix
 * Scalability: Pagination, limits, indexes
 */
exports.getAvailableOrders = async (req, res) => {
    try {
        const now = new Date();
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, parseInt(req.query.limit) || 20);
        const skip = (page - 1) * limit;

        if (!req.user || !req.user.id) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const userId = new mongoose.Types.ObjectId(req.user.id);

        const availableOrders = await Order.find({
            status: { $in: ['Pending', 'Accepted', 'Preparing', 'Ready for Pickup'] },
            offeredRiderId: userId,
            offerExpiresAt: { $gt: now },
            assignedRiderId: null
        })
        .select('_id orderNumber foodCost deliveryFee totalAmount status restaurantId customerId')
        .populate('restaurantId', 'name location latitude longitude phone')
        .populate('customerId', 'name phone address')
        .skip(skip)
        .limit(limit)
        .sort({ offerExpiresAt: 1 })
        .lean();

        const total = await Order.countDocuments({
            status: { $in: ['Pending', 'Accepted', 'Preparing', 'Ready for Pickup'] },
            offeredRiderId: userId,
            offerExpiresAt: { $gt: now },
            assignedRiderId: null
        });

        return res.status(200).json({
            success: true,
            orders: availableOrders,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        console.error('Get available orders error:', err);
        return res.status(500).json({ success: false, message: "Failed to fetch available orders" });
    }
};

/**
 * ✨ 5. RETRIEVE CURRENT RUNNING CONTEXT ACTIVE ORDER
 * Security: Authorization validation
 */
exports.getActiveOrder = async (req, res) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const activeOrder = await Order.findOne({
            assignedRiderId: new mongoose.Types.ObjectId(req.user.id),
            status: 'Out for Delivery'
        })
        .select('-deliveryOTP -statusHistory')
        .populate('restaurantId', 'name location latitude longitude address phone')
        .populate('customerId', 'name phone address')
        .lean();

        if (activeOrder) {
            return res.status(200).json({ success: true, order: activeOrder });
        } else {
            return res.status(200).json({ success: false, message: "No active orders" });
        }
    } catch (err) {
        console.error('Get active order error:', err);
        return res.status(500).json({ success: false, message: "Failed to fetch active order" });
    }
};

/**
 * ✨ 6. ATOMIC LOGISTICAL ORDER RESERVATION FACTORY ENGINE
 * Security: Atomic lock acquisition prevents TOCTOU, cryptographically secure OTP
 * Transaction: Single atomic lock-and-claim operation
 */
exports.acceptOrder = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    let riderId = null;
    let riderLocked = null;

    try {
        if (!req.user || !req.user.id || !req.params.id) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        session.endSession();
            return res.status(400).json({ success: false, message: "Invalid request parameters" });
        }

        const now = new Date();
        const orderId = new mongoose.Types.ObjectId(req.params.id);
        riderId = new mongoose.Types.ObjectId(req.user.id);

        // STEP 1: Atomically acquire lock on rider (check-and-set pattern)
        // This prevents concurrent order acceptance by same rider
        riderLocked = await User.findOneAndUpdate(
            {
                _id: riderId,
                currentActiveOrderId: null  // Only succeed if currently unlocked
            },
            {
                $set: { currentActiveOrderId: orderId }
            },
            { session, new: true }
        );

        if (!riderLocked) {
            await session.abortTransaction();
            session.endSession();
            return res.status(409).json({ success: false, message: "You already have an active order" });
        }

        // The atomic assignment filter below enforces Ready for Pickup as the only legal predecessor.
        const previousStatus = 'Ready for Pickup';

        // STEP 2: Generate cryptographically secure OTP using model's hash method
        const generatedOTP = crypto.randomInt(100000, 1000000).toString();
        const hashedOTP = Order.hashOTP(generatedOTP);

        // STEP 3: Update order with rider assignment and OTP
        const order = await Order.findOneAndUpdate(
            {
                _id: orderId,
                offeredRiderId: riderId,
                offerExpiresAt: { $gt: now },
                assignedRiderId: null,
                status: 'Ready for Pickup',
                $or: [
                    { paymentMethod: 'COD' },
                    { paymentMethod: 'ONLINE', paymentStatus: 'PAID' }
                ]
            },
            {
                $set: {
                    assignedRiderId: riderId,
                    status: 'Out for Delivery',
                    statusUpdatedAt: now,
                    offeredRiderId: null,
                    offerExpiresAt: null,
                    deliveryOTP: hashedOTP,
                    otpUsed: false,
                    deliveryOTPExpiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000)
                },
                $push: {
                    statusHistory: {
                        from: previousStatus,
                        to: 'Out for Delivery',
                        actorType: 'RIDER',
                        actorId: riderId,
                        changedAt: now
                    }
                }
            },
            { new: true, runValidators: true, session }
        );

        if (!order) {
            // Order was taken by another rider; lock is already acquired, so release it
            await User.findByIdAndUpdate(
                riderId,
                { currentActiveOrderId: null },
                { session }
            );
            await session.abortTransaction();
            session.endSession();
            return res.status(409).json({ success: false, message: "Order no longer available" });
        }

        await session.commitTransaction();
        session.endSession();

        // Emit event after transaction succeeds (best effort - failure won't roll back)
        try {
            const io = req.app.get('io');
            if (io && order.restaurantId && riderLocked) {
                io.to(order.restaurantId.toString()).emit('orderAssignedToRider', {
                    orderId: order._id,
                    riderName: riderLocked.name || 'Rider',
                    riderPhone: riderLocked.phone || 'N/A',
                    riderBike: riderLocked.bikeNumber || 'N/A',
                    assignedAt: now
                });
            }
        } catch (socketErr) {
            console.error('Socket emission failed:', socketErr);
        }

        const populatedOrder = await Order.findById(order._id)
            .populate('restaurantId', 'name location latitude longitude address phone')
            .populate('customerId', 'name phone address')
            .select('-statusHistory -deliveryOTP')
            .lean();

        return res.status(200).json({
            success: true,
            message: "Order accepted successfully",
            order: populatedOrder,
            deliveryOTP: generatedOTP
        });
    } catch (err) {

        try {
            if (session.inTransaction()) {
                await session.abortTransaction();
            }
        } finally {
            session.endSession();
        }

        if (riderLocked && riderId) {
            try {
                await User.findByIdAndUpdate(
                    riderId,
                    { currentActiveOrderId: null }
                );
            } catch (unlockErr) {
                console.error("Failed to release rider lock:", unlockErr);
            }
        }

        console.error("Accept order error:", err);

        return res.status(500).json({
            success: false,
            message: "Failed to accept order"
        });
    }
};

/**
 * ✨ 7. GEOGRAPHIC LOCATION TRACKING INGESTION STREAM CONSTRAINTS
 * Security: Strict coordinate validation
 */
exports.updateLocation = async (req, res) => {
    try {
        const { orderId, latitude, longitude } = req.body;

        if (!orderId) {
            return res.status(400).json({ success: false, message: "Order ID is required" });
        }

        // Strict coordinate validation
        if (typeof latitude !== 'number' || typeof longitude !== 'number') {
            return res.status(400).json({ success: false, message: "Invalid coordinate format" });
        }

        if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            return res.status(400).json({ success: false, message: "Coordinates out of valid range" });
        }

        const updatedOrder = await Order.findOneAndUpdate(
            {
                _id: new mongoose.Types.ObjectId(orderId),
                assignedRiderId: new mongoose.Types.ObjectId(req.user.id),
                status: 'Out for Delivery'
            },
            {
                $set: {
                    riderLocation: {
                        type: 'Point',
                        coordinates: [longitude, latitude]
                    },
                    lastLocationUpdate: new Date()
                }
            },
            { new: true, runValidators: true }
        );

        if (!updatedOrder) {
            return res.status(404).json({ success: false, message: "Active order not found or access denied" });
        }

        return res.status(200).json({
            success: true,
            message: "Location updated",
            coords: updatedOrder.riderLocation
        });
    } catch (err) {
        console.error('Update location error:', err);
        return res.status(500).json({ success: false, message: "Failed to update location" });
    }
};

/**
 * ✨ 8. FINTECH-GRADE AUTOMATED ATOMIC SETTLEMENT & DELIVERY DISPATCH ENGINE
 * Security: OTP verified BEFORE state mutation, timing-safe comparison
 * Transaction: Read-validate-then-mutate prevents double-settlement, ledger idempotency
 * Atomicity: Single state transition barrier after all validations pass
 */
exports.completeOrder = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { otp } = req.body;

        if (!req.user || !req.user.id || !req.params.id || !otp) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ success: false, message: "Invalid request parameters" });
        }

        if (String(otp).length !== 6 || !/^\d+$/.test(otp)) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ success: false, message: "Invalid OTP format" });
        }

        const orderId = new mongoose.Types.ObjectId(req.params.id);
        const riderId = new mongoose.Types.ObjectId(req.user.id);
        const now = new Date();

        // STEP 1: Read order WITHOUT modifying (validate state)
        const order = await Order.findOne({
            _id: orderId,
            assignedRiderId: riderId,
            status: 'Out for Delivery',
            otpUsed: false
        }).session(session);

        if (!order) {
            await session.abortTransaction();
            session.endSession();
            return res.status(409).json({ success: false, message: "Order not found or already completed" });
        }

        if (order.paymentMethod === 'ONLINE' && order.paymentStatus !== 'PAID') {
            await session.abortTransaction();
            session.endSession();
            return res.status(409).json({ success: false, error: 'PAYMENT_REQUIRED', message: "Online payment must be completed before delivery" });
        }

        // STEP 2: Verify OTP using timing-safe method BEFORE any state mutation
        const isTokenValid = Order.verifyTimingSafeOTP(otp, order.deliveryOTP, order.deliveryOTPExpiresAt, order.otpUsed);
        if (!isTokenValid) {
            console.warn(`Incorrect OTP attempt - Order: ${orderId}, Rider: ${riderId}`);
            await session.abortTransaction();
            session.endSession();
            return res.status(401).json({ success: false, message: "Invalid or expired OTP" });
        }

        // STEP 3: Validate financial breakdown using model helper
        const financialStatus = Order.validateFinancialBreakdown({
            foodCost: order.foodCost,
            deliveryFee: order.deliveryFee,
            platformFee: 0,
            taxAmount: order.taxAmount,
            discountAmount: order.discountAmount,
            totalAmount: order.totalAmount
        });

        if (!financialStatus.valid) {
            console.error(`Financial validation failed - Order: ${orderId}, Delta: ${financialStatus.delta}`);
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ success: false, message: "Financial data mismatch" });
        }

        // STEP 4: Database unique indexes enforce settlement idempotency.
        // Duplicate settlements are handled via MongoDB duplicate-key (11000).

        const settlementId = crypto.randomUUID();

// STEP 5: Atomic state transition (write barrier - commit point for delivery)
        const updatedOrder = await Order.findOneAndUpdate(
            {
                _id: orderId,
                assignedRiderId: riderId,
                status: 'Out for Delivery',
                otpUsed: false,
                $or: [
                    { paymentMethod: 'COD' },
                    { paymentMethod: 'ONLINE', paymentStatus: 'PAID' }
                ]
            },
            {
                $set: {
                    status: 'Delivered',
                    statusUpdatedAt: now,
                    otpUsed: true,
                    deliveryOTP: null,
                    deliveryOTPExpiresAt: null,
                    completedAt: now,
                    settlementStatus: 'COMPLETED',
                    settlementId: settlementId
                },
                $push: {
                    statusHistory: {
                        from: 'Out for Delivery',
                        to: 'Delivered',
                        actorType: 'RIDER',
                        actorId: riderId,
                        changedAt: now
                    }
                }
            },
            { session, runValidators: true, new: true }
        );

        if (!updatedOrder) {
            // Another request completed this order concurrently
            await session.abortTransaction();
            session.endSession();
            return res.status(409).json({ success: false, message: "Order was completed by another request" });
        }

        // STEP 6: Create ledger entries (settlement record for idempotency and audit)
        const riderBonus = order.riderIncentive || Math.round(order.totalAmount * 0.02);
        const netAdminProfit = order.platformFee - riderBonus;

        const ledgerEntries = [
            {
                settlementId,
                orderId: orderId,
                entityType: 'RIDER',
                entityId: riderId,
                type: 'CREDIT',
                amount: order.deliveryFee + riderBonus,
                currency: 'NPR',
                balanceAfter: null,
                description: 'Delivery settlement',
                createdAt: now
            },
            {
                settlementId,
                orderId: orderId,
                entityType: 'RESTAURANT',
                entityId: order.restaurantId,
                type: 'CREDIT',
                amount: order.foodCost,
                currency: 'NPR',
                balanceAfter: null,
                description: 'Restaurant settlement',
                createdAt: now
            },
            {
                settlementId,
                orderId: orderId,
                entityType: 'ADMIN',
                entityId: null,
                type: 'CREDIT',
                amount: order.platformFee,
                currency: 'NPR',
                balanceAfter: null,
                description: 'Platform commission',
                createdAt: now
            }
        ];
        await LedgerEntry.insertMany(ledgerEntries, { session });

        // STEP 7: Update rider wallet
        const updatedRiderProfile = await RiderProfile.findOneAndUpdate(
            { userId: riderId },
            {
                $inc: {
                    "wallet.balance": (order.deliveryFee + riderBonus),
                    "wallet.incentiveEarnings": riderBonus,
                    "wallet.transactionCount": 1,
                    "wallet.walletVersion": 1
                }
            },
            { new: true, runValidators: true, session }
        );

        if (!updatedRiderProfile) {
            throw new Error("RiderProfile not found");
        }

        // STEP 8: Update restaurant wallet
        const updatedRestaurant = await Restaurant.findByIdAndUpdate(
            order.restaurantId,
            {
                $inc: {
                    "walletBalance": order.foodCost,
                    "totalEarnings": order.foodCost,
                    "transactionCount": 1,
                    "walletVersion": 1
                },
                $set: {
                    "lastProcessedOrderId": orderId,
                    "lastSettlementId": settlementId
                }
            },
            { session, runValidators: true, new: true }
        );

        if (!updatedRestaurant) {
            throw new Error("Restaurant not found");
        }

        // STEP 9: Update admin wallet with proper initialization
        await AdminWallet.findOneAndUpdate(
            { date: now.toISOString().slice(0,10) },
            {
                $inc: {
                    totalPlatformRevenue: order.platformFee,
                    totalRiderBonusesPaid: riderBonus,
                    totalOrdersProcessed: 1,
                    transactionCount: 1
                },
                $setOnInsert: { date: now.toISOString().slice(0,10) }
            },
            { upsert: true, new: true, session, runValidators: true, setDefaultsOnInsert: true }
        );

        // STEP 10: Release rider lock and check for shift end
        const user = await User.findById(riderId).session(session);
        let shiftEndedMsg = "";
        let forcedOffline = false;

        if (user && user.shiftStartTime && user.isOnline) {
            const shiftDurationMs = now.getTime() - new Date(user.shiftStartTime).getTime();
            const maxDurationMs = (process.env.MAX_SHIFT_DURATION_MINUTES || 480) * 60 * 1000;

            if (shiftDurationMs >= maxDurationMs) {
                user.isOnline = false;
                user.shiftStartTime = null;
                forcedOffline = true;
                shiftEndedMsg = " Your shift has ended. Please log back in to start a new shift.";
            }

            user.currentActiveOrderId = null;
            await user.save({ session });
        }

        await session.commitTransaction();
        session.endSession();

        const io = req.app.get('io');
        if (io) {
            io.to(order.customerId.toString()).emit('orderDelivered', {
                orderId: order._id
            });

            io.to(order.restaurantId.toString()).emit('orderDelivered', {
                orderId: order._id
            });
        }

        return res.status(200).json({
            success: true,
            message: `Order delivered successfully.${shiftEndedMsg}`,
            forcedOffline,
            orderDetails: {
                orderId: order._id,
                riderEarnings: order.deliveryFee + riderBonus,
                completedAt: now
            }
        });
    } catch (err) {

        try {
            if (session.inTransaction()) {
                await session.abortTransaction();
            }
        } finally {
            session.endSession();
        }

        if (err?.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "Order settlement already processed."
            });
        }

        console.error("Complete order error:", err);

        return res.status(500).json({
            success: false,
            message: "Failed to complete order"
        });
    }
};

/**
 * ✨ 9. SHIFT TOGGLE ENGINE SCHEDULER
 * Security: Validation of pending settlements before shift start
 * Race condition: Check active orders before allowing offline
 */
exports.toggleStatus = async (req, res) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const { targetStatus } = req.body;
        if (typeof targetStatus !== 'boolean') {
            return res.status(400).json({ success: false, message: "Invalid targetStatus. Must be true or false" });
        }

        // Going online - check active order and pending COD
        if (targetStatus === true) {
            const user = await User.findById(req.user.id).select('currentActiveOrderId');
            if (!user) {
                return res.status(404).json({ success: false, message: "User not found" });
            }

            if (user.currentActiveOrderId) {
                return res.status(409).json({
                    success: false,
                    message: "Cannot start shift while you have an active order",
                    activeOrderId: user.currentActiveOrderId
                });
            }

            let profile = await RiderProfile.findOne({ userId: new mongoose.Types.ObjectId(req.user.id) });
            const pendingCOD = profile?.wallet?.codPending || 0;

            if (pendingCOD > 0) {
                return res.status(403).json({
                    success: false,
                    requiresSettlement: true,
                    message: `You have pending COD settlement of NPR ${pendingCOD}. Please settle before starting a new shift`,
                    pendingAmount: pendingCOD
                });
            }

            const shiftStartTime = new Date();
            const updatedUser = await User.findOneAndUpdate(
                { _id: req.user.id },
                { $set: { isOnline: true, shiftStartTime } },
                { new: true }
            );

            if (!updatedUser) {
                return res.status(404).json({ success: false, message: "User not found" });
            }

            return res.status(200).json({
                success: true,
                message: "Shift started. You are now online",
                shiftStartTime: updatedUser.shiftStartTime
            });
        }
        // Going offline - prevent if active order exists
        else {
            const user = await User.findById(req.user.id).select("currentActiveOrderId");

            if (!user) {
                return res.status(404).json({ success: false, message: "User not found" });
            }

            if (user.currentActiveOrderId) {
                return res.status(403).json({
                    success: false,
                    message: "Cannot go offline. You have an active delivery order",
                    activeOrderId: user.currentActiveOrderId
                });
            }

            const updatedUser = await User.findOneAndUpdate(
                { _id: req.user.id },
                { $set: { isOnline: false, shiftStartTime: null } },
                { new: true }
            );

            if (!updatedUser) {
                return res.status(404).json({ success: false, message: "User not found" });
            }

            return res.status(200).json({
                success: true,
                message: "You are now offline"
            });
        }
    } catch (err) {
        console.error('Toggle status error:', err);
        return res.status(500).json({ success: false, message: "Failed to update shift status" });
    }
};






/**
 * ? Rider Reject Order
 */
exports.rejectOrder = async (req, res) => {
    try {
        const riderId = new mongoose.Types.ObjectId(req.user.id);
        const orderId = new mongoose.Types.ObjectId(req.params.id);

        const order = await Order.findOneAndUpdate(
            {
                _id: orderId,
                assignedRiderId: null,
                offeredRiderId: riderId
            },
            {
                $set: {
                    offeredRiderId: null,
                    offerExpiresAt: null
                }
            },
            {
                new: true,
                runValidators: true
            }
        );

        if (!order) {
            return res.status(409).json({
                success: false,
                message: "Order offer no longer available."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Order rejected."
        });
    } catch (err) {
        console.error("Reject order error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to reject order."
        });
    }
};
