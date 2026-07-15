const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/auth');
const mongoose = require('mongoose'); 
const fs = require('fs');
const path = require('path');

// Core Database Models
const Restaurant = require('../models/Restaurant');
const MenuItem = require('../models/MenuItem');
const Order = require('../models/Order');
const User = require('../models/User'); 

const restaurantController = require('../controllers/restaurantController');
const { VALID_ORDER_STATUSES } = require('../constants/orderConstants');
const dispatchService = require('../services/dispatchService');

const DISPATCH_TRIGGER_STATUSES = ['Accepted', 'Preparing'];

const ORDER_STATUS_TRANSITIONS = {
    'Pending': ['Accepted', 'Cancelled'],
    'Accepted': ['Preparing', 'Cancelled'],
    'Preparing': ['Ready for Pickup', 'Cancelled'],
    'Ready for Pickup': ['Out for Delivery'],
    'Out for Delivery': ['Delivered'],
    'Delivered': [], 
    'Cancelled': []  
};

// ==========================================
// 🛠️ CENTRALIZED UTILITY MIDDLEWARES
// ==========================================

/**
 * Centralized Express Async Error Handler Wrapper
 */
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Hardened Seller Security Middleware
 */
const verifySeller = asyncHandler(async (req, res, next) => {

    authMiddleware(req, res, async () => {

        if (req.user.role !== 'Seller') {
            return res.status(403).json({
                success: false,
                error: "RESTRICTED_ACCESS",
                message: "Restricted Access! Seller authorization clearance flags required."
            });
        }

        const activeUserCheck = await User.findById(req.user.id)
            .select('isActive kycStatus')
            .lean();

        if (
            !activeUserCheck ||
            !activeUserCheck.isActive ||
            activeUserCheck.kycStatus !== 'VERIFIED'
        ) {
            return res.status(403).json({
                success: false,
                error: "BANNED_SELLER_ACCOUNT",
                message: "Access Suspended: This account has been deactivated or failed verification checks."
            });
        }

        req.user.id = activeUserCheck._id.toString();

        next();

    });

});

/**
 * Centralized Restaurant Context Attachment Middleware
 */
const attachRestaurantContext = asyncHandler(async (req, res, next) => {
    const restaurant = await Restaurant.findOne({ ownerId: req.user.id })
        .select('_id currentLocation name isOpen status')
        .lean();

    // 🚀 PROBLEM 2 FIXED: Removed non-standard HTTP 444 code to comply with native gateway proxies contracts
    if (!restaurant) {
        return res.status(404).json({ success: false, error: "RESTAURANT_PROFILE_NOT_FOUND", message: "Operational block: Seller account possesses no active restaurant profile setup mapping entries." });
    }

    if (restaurant.status !== 'ACTIVE') {
        return res.status(403).json({ success: false, error: "RESTAURANT_INACTIVE", message: "Access Forbidden: Restaurant profiling has been suspended or is currently unapproved." });
    }

    req.restaurant = restaurant;
    return next();
});

// ==========================================
// 🏢 DECOUPLED DISPATCH SERVICE LAYER LOGIC
// ==========================================
// ==========================================
// ?? CUSTOMER ROUTES (Public Operations)
// ==========================================
router.get('/', restaurantController.getAllRestaurants);

router.get('/:id/image', asyncHandler(async (req, res) => {
    const restaurantId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
        return res.status(400).json({ success: false, error: 'INVALID_RESTAURANT_ID' });
    }

    const restaurant = await Restaurant.findOne({ _id: restaurantId, isDiscoverable: true, image: { $ne: null } }).select('image').lean();
    if (!restaurant?.image) {
        return res.status(404).json({ success: false, error: 'RESTAURANT_IMAGE_NOT_FOUND' });
    }

    const filename = typeof restaurant.image === 'string' ? path.basename(restaurant.image.replace(/\\/g, '/')) : '';
    if (!/^[A-Za-z0-9._-]+\.(?:jpe?g|png|webp)$/i.test(filename)) {
        return res.status(404).json({ success: false, error: 'RESTAURANT_IMAGE_NOT_FOUND' });
    }

    const uploadDirectory = path.resolve(__dirname, '..', 'uploads');
    const imagePath = path.resolve(uploadDirectory, filename);
    if (!imagePath.startsWith(`${uploadDirectory}${path.sep}`)) {
        return res.status(404).json({ success: false, error: 'RESTAURANT_IMAGE_NOT_FOUND' });
    }

    try {
        await fs.promises.access(imagePath, fs.constants.R_OK);
    } catch {
        return res.status(404).json({ success: false, error: 'RESTAURANT_IMAGE_NOT_FOUND' });
    }

    return res.sendFile(imagePath, (err) => {
        if (err && !res.headersSent) {
            return res.status(err.statusCode === 404 ? 404 : 500).json({ success: false, error: 'RESTAURANT_IMAGE_NOT_FOUND' });
        }
    });
}));

// ==========================================
// 🏪 SELLER DASHBOARD ROUTES (Protected Sandbox)
// ==========================================

// 1. ADD NEW MENU ITEM (POST /api/seller/menu)
router.post('/menu', verifySeller, attachRestaurantContext, asyncHandler(async (req, res) => {
    const { name, price, description } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
        return res.status(400).json({ success: false, error: "INVALID_INPUT_NAME", message: "Validation error: name parameter attribute value must be a non-empty string." });
    }
    if (price === undefined || typeof price === 'boolean' || typeof price !== 'number' || !Number.isFinite(price) || price <= 0) {
        return res.status(400).json({ success: false, error: "INVALID_INPUT_PRICE", message: "Validation error: price variable metrics must map to a finite positive numeric expression." });
    }

    const newItem = new MenuItem({
        restaurantId: req.restaurant._id,
        name: name.trim(),
        price,
        description: description && typeof description === 'string' ? description.trim() : '',
        isAvailable: true
    });

    await newItem.save();
    return res.status(201).json({ success: true, message: "Menu item successfully registered.", item: newItem });
}));

// 2. GET SELLER'S MENU (GET /api/seller/menu)
router.get('/menu', verifySeller, attachRestaurantContext, asyncHandler(async (req, res) => {
    const items = await MenuItem.find({ restaurantId: req.restaurant._id }).sort({ createdAt: -1 }).lean();
    return res.status(200).json(items);
}));

// 3. GET SELLER'S ORDERS (GET /api/seller/orders)
router.get('/orders', verifySeller, attachRestaurantContext, asyncHandler(async (req, res) => {
    // 🚀 PROBLEM 7 FIXED: Guard against memory saturation vulnerabilities via strict pagination bounds limits
    const { page = 1, limit = 20 } = req.query;
    const pageValue = Math.max(1, parseInt(page, 10) || 1);
    const limitValue = Math.min(Math.max(1, parseInt(limit, 10) || 20), 50);
    const skip = (pageValue - 1) * limitValue;

    const orders = await Order.find({ restaurantId: req.restaurant._id })
        .populate('customerId', 'name phone') 
        .populate('assignedRiderId', 'name phone bikeNumber') 
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitValue)
        .lean();
        
    return res.status(200).json({ success: true, count: orders.length, page: pageValue, data: orders });
}));

// 4. UPDATE ORDER STATUS (PUT /api/seller/orders/:id/status)
router.put('/orders/:id/status', verifySeller, attachRestaurantContext, asyncHandler(async (req, res) => {
    const orderId = req.params.id;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
        return res.status(400).json({ success: false, error: "INVALID_OBJECT_ID", message: "Malformed context parameter reference format identifier dropped." });
    }

    if (!status || typeof status !== 'string' || !VALID_ORDER_STATUSES.includes(status)) {
        return res.status(400).json({ success: false, error: "INVALID_TARGET_STATUS", message: "Requested state out of system runtime parameters limits mappings bounds." });
    }

    const existingOrder = await Order.findOne({ _id: orderId, restaurantId: req.restaurant._id }).select('status offeredRiderId assignedRiderId paymentMethod paymentStatus').lean();
    if (!existingOrder) {
        return res.status(404).json({ success: false, error: "ORDER_NOT_FOUND", message: "Target request dataset criteria matches not found inside databases collections." });
    }

    if (existingOrder.paymentMethod === 'ONLINE' && existingOrder.paymentStatus !== 'PAID' && status !== 'Cancelled') {
        return res.status(409).json({ success: false, error: 'PAYMENT_REQUIRED', message: 'Online payment must be completed before order processing.' });
    }

    const allowedNextStates = ORDER_STATUS_TRANSITIONS[existingOrder.status] || [];
    if (!allowedNextStates.includes(status)) {
        return res.status(422).json({ 
            success: false, 
            error: "ILLEGAL_STATE_TRANSITION", 
            message: `State Machine Refusal: Status changes paths from state [${existingOrder.status}] to [${status}] is structurally blocked.` 
        });
    }

    // 🚀 PROBLEM 4 FIXED: Enriched Audit node tracking payload boundaries to track cross-platform transitions context securely
    const historicalAuditNode = {
        from: existingOrder.status,
        to: status,
        actorType: 'SELLER', 
        actorId: new mongoose.Types.ObjectId(req.user.id),
        changedAt: new Date()
    };

    const queryCondition = { 
        _id: orderId, 
        restaurantId: req.restaurant._id,
        status: existingOrder.status
    };

    if (status !== 'Cancelled') {
        queryCondition.$or = [
            { paymentMethod: 'COD' },
            { paymentMethod: 'ONLINE', paymentStatus: 'PAID' }
        ];
    }

    const order = await Order.findOneAndUpdate(
        queryCondition,
        { 
            $set: {
                status,
                statusUpdatedAt: historicalAuditNode.changedAt
            },
            $push: { statusHistory: historicalAuditNode } 
        },
        { new: true, runValidators: true }
    ).populate('customerId', 'name phone').populate('restaurantId', 'name address phone');

    if (!order) {
        return res.status(409).json({ success: false, error: "CONCURRENCY_CONFLICT", message: "State Mutation Blocked: Target transaction version hijacked by concurrent processes." });
    }

    if (DISPATCH_TRIGGER_STATUSES.includes(status)) {
        // 🚀 NOTE ON PROBLEM 6: Switch from immediate asynchronous loops to persistent memory tasks queue 
        // to protect the platform against unpredictable process termination crashes.
        setImmediate(async () => {
            const appIoContext = req.app.get('io');
            await dispatchService.triggerAutomatedRiderDispatch(order._id, req.restaurant.currentLocation, appIoContext);
        });
    }

    return res.status(200).json({ success: true, order });
}));

// ==========================================
// ⚠️ DYNAMIC ROUTES (MUST STAY AT THE BOTTOM)
// ==========================================
router.get('/:id', asyncHandler(async (req, res) => {
    const restaurantId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
        return res.status(400).json({ success: false, error: "INVALID_RESTAURANT_ID", message: "Target search parameters are not valid mongoose ObjectIds." });
    }

    const items = await MenuItem.find({ restaurantId: restaurantId, isAvailable: true }).sort({ createdAt: -1 }).lean();
    return res.status(200).json(items);
}));

// 🚀 PROBLEM 1 FIXED: Global Error handler boundary moved natively to server roots. 
// Route errors are seamlessly passed down via next(err) parameters.

module.exports = router;
