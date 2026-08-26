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

const {
    createImageUpload
} = require('../middlewares/imageUpload');

const {
    storeMenuImage,
    deleteMenuImage,
    cleanupUploadedMenuFiles,
    resolveMenuImagePath
} = require('../services/menuImageService');
const User = require('../models/User'); 

const restaurantController = require('../controllers/restaurantController');
const { VALID_ORDER_STATUSES } = require('../constants/orderConstants');
const dispatchService = require('../services/dispatchService');

const DISPATCH_TRIGGER_STATUSES = ['Accepted', 'Preparing'];

const ORDER_STATUS_TRANSITIONS = {
    'Pending': ['Accepted', 'Cancelled'],
    'Accepted': ['Preparing', 'Cancelled'],
    'Preparing': ['Ready for Pickup', 'Cancelled'],
    'Ready for Pickup': [],
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
        .select('_id currentLocation name isOpen status image registrationDoc panVatNumber')
        .lean();

    //PROBLEM 2 FIXED: Removed non-standard HTTP 444 code to comply with native gateway proxies contracts
    if (!restaurant) {
        return res.status(404).json({ success: false, error: "RESTAURANT_PROFILE_NOT_FOUND", message: "Operational block: Seller account possesses no active restaurant profile setup mapping entries." });
    }

    if (restaurant.status !== 'ACTIVE') {
        return res.status(403).json({ success: false, error: "RESTAURANT_INACTIVE", message: "Access Forbidden: Restaurant profiling has been suspended or is currently unapproved." });
    }

       req.restaurant = restaurant;
    return next();
});

const buildActiveSellerMenuFilter = (restaurantId) => ({
    restaurantId,
    isDeleted: false
});

const buildMenuItemMutationFilter = (restaurantId, itemId, version) => ({
    _id: itemId,
    ...buildActiveSellerMenuFilter(restaurantId),
    __v: version
});
//CUSTOMER ROUTES (Public Operations)
router.get('/', restaurantController.getAllRestaurants);

router.get('/:id/image', asyncHandler(async (req, res) => {
    const restaurantId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
        return res.status(400).json({ success: false, error: 'INVALID_RESTAURANT_ID' });
    }

    const restaurant = await Restaurant.findOne({
        _id: restaurantId,
        isDiscoverable: true,
        image: { $ne: null }
    }).select('image').lean();

    if (!restaurant?.image) {
        return res.status(404).json({ success: false, error: 'RESTAURANT_IMAGE_NOT_FOUND' });
    }

    const filename = typeof restaurant.image === 'string'
        ? path.basename(restaurant.image.replace(/\\/g, '/'))
        : '';

    if (
        !filename ||
        filename.includes('..') ||
        filename.includes('/') ||
        filename.includes('\\') ||
        !/^[A-Za-z0-9._-]+(?:\.(?:jpe?g|png|webp))?$/i.test(filename)
    ) {
        return res.status(404).json({
            success: false,
            error: 'RESTAURANT_IMAGE_NOT_FOUND'
        });
    }

    const uploadDirectory = path.resolve(__dirname, '..', 'uploads');

    const managedImagePath = path.resolve(
        uploadDirectory,
        'restaurants',
        restaurantId,
        'image',
        filename
    );

    const legacyImagePath = path.resolve(uploadDirectory, filename);

    const candidatePaths = [
        managedImagePath,
        legacyImagePath
    ];

    let imagePath = null;

    for (const candidatePath of candidatePaths) {
        if (!candidatePath.startsWith(`${uploadDirectory}${path.sep}`)) {
            continue;
        }

        try {
            await fs.promises.access(candidatePath, fs.constants.R_OK);
            imagePath = candidatePath;
            break;
        } catch {
            // Try legacy storage location.
        }
    }

    if (!imagePath) {
        return res.status(404).json({
            success: false,
            error: 'RESTAURANT_IMAGE_NOT_FOUND'
        });
    }

    return res.sendFile(imagePath, (err) => {
        if (err && !res.headersSent) {
            return res.status(err.statusCode === 404 ? 404 : 500).json({
                success: false,
                error: 'RESTAURANT_IMAGE_NOT_FOUND'
            });
        }
    });
}));

// ==========================================
// 🏪 SELLER DASHBOARD ROUTES (Protected Sandbox)
// ==========================================
router.get('/store', verifySeller, attachRestaurantContext, asyncHandler(async (req, res) => {
    res.set('Cache-Control', 'no-store, private, max-age=0');
    res.set('ETag', `"seller-store-${req.restaurant._id}-${Date.now()}"`);

    return res.json({
        success: true,
        restaurant: {
            _id: req.restaurant._id,
            name: req.restaurant.name,
            panVatNumber: req.restaurant.panVatNumber,
            isOpen: req.restaurant.isOpen,
            status: req.restaurant.status,
            isDiscoverable: req.restaurant.isDiscoverable,
            image: req.restaurant.image,
            registrationDoc: req.restaurant.registrationDoc
        }
    });
}));
router.patch(
    '/store/status',
    verifySeller,
    restaurantController.updateStoreStatus
);
// 1. ADD NEW MENU ITEM (POST /api/seller/menu)
router.post('/menu', verifySeller, attachRestaurantContext, asyncHandler(async (req, res) => {
const { name, price, description, foodCategory, tags } = req.body;

const normalizedName = typeof name === 'string' ? name.trim() : '';
const normalizedDescription = typeof description === 'string'
    ? description.trim()
    : '';

const normalizedTags = Array.isArray(tags)
    ? [
        ...new Set(
            tags
                .filter((tag) => typeof tag === 'string')
                .map((tag) => tag.trim())
                .filter(Boolean)
        )
    ]
    : [];

if (!normalizedName) {
    return res.status(400).json({
        success: false,
        error: 'INVALID_INPUT_NAME',
        message: 'Menu item name is required.'
    });
}

if (
    typeof price !== 'number' ||
    !Number.isFinite(price) ||
    !Number.isInteger(price) ||
    price < 100
) {
    return res.status(400).json({
        success: false,
        error: 'INVALID_INPUT_PRICE',
        message: 'Menu item price must be a whole number of at least NPR 100.'
    });
}

if (
    foodCategory !== undefined &&
    foodCategory !== 'Veg' &&
    foodCategory !== 'Non-Veg'
) {
    return res.status(400).json({
        success: false,
        error: 'INVALID_FOOD_CATEGORY',
        message: 'Food category must be Veg or Non-Veg.'
    });
}

if (!Array.isArray(tags) && tags !== undefined) {
    return res.status(400).json({
        success: false,
        error: 'INVALID_TAGS',
        message: 'Tags must be provided as an array.'
    });
}

if (normalizedTags.length > 10) {
    return res.status(400).json({
        success: false,
        error: 'TOO_MANY_TAGS',
        message: 'A menu item can have a maximum of 10 tags.'
    });
}

if (normalizedTags.some((tag) => tag.length > 50)) {
    return res.status(400).json({
        success: false,
        error: 'INVALID_TAG_LENGTH',
        message: 'Each menu tag must be 50 characters or fewer.'
    });
}

const newItem = new MenuItem({
    restaurantId: req.restaurant._id,
    name: normalizedName,
    price,
    description: normalizedDescription,
    foodCategory: foodCategory || 'Veg',
    tags: normalizedTags,
    isAvailable: true,
    isDeleted: false,
    deletedAt: null,
    createdBy: req.user.id,
    updatedBy: req.user.id
});
    await newItem.save();

    return res.status(201).json({
        success: true,
        message: 'Menu item successfully registered.',
        item: newItem
    });
}));

// 2. UPDATE SELLER MENU ITEM (PATCH /api/seller/menu/:id)
router.patch('/menu/:id', verifySeller, attachRestaurantContext, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const rawVersion = req.body.__v;
    const version = Number(rawVersion);

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
            success: false,
            error: 'INVALID_MENU_ITEM_ID',
            message: 'Menu item ID is invalid.'
        });
    }

    if (
        rawVersion === undefined ||
        !Number.isInteger(version) ||
        version < 0
    ) {
        return res.status(400).json({
            success: false,
            error: 'INVALID_MENU_ITEM_VERSION',
            message: 'A valid menu item version is required for editing.'
        });
    }

    const updateFields = {};

    if (req.body.name !== undefined) {
        if (typeof req.body.name !== 'string' || req.body.name.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'INVALID_INPUT_NAME',
                message: 'Menu item name must be a non-empty string.'
            });
        }

        updateFields.name = req.body.name.trim();
    }

    if (req.body.price !== undefined) {
        if (
            typeof req.body.price !== 'number' ||
            !Number.isFinite(req.body.price) ||
            !Number.isInteger(req.body.price) ||
            req.body.price < 100
        ) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_INPUT_PRICE',
                message: 'Menu item price must be a whole number of at least NPR 100.'
            });
        }

        updateFields.price = req.body.price;
    }

    if (req.body.description !== undefined) {
        if (typeof req.body.description !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'INVALID_INPUT_DESCRIPTION',
                message: 'Description must be a string.'
            });
        }

        updateFields.description = req.body.description.trim();
    }

    if (req.body.foodCategory !== undefined) {
        if (
            req.body.foodCategory !== 'Veg' &&
            req.body.foodCategory !== 'Non-Veg'
        ) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_FOOD_CATEGORY',
                message: 'Food category must be Veg or Non-Veg.'
            });
        }

        updateFields.foodCategory = req.body.foodCategory;
    }

    if (req.body.tags !== undefined) {
        if (!Array.isArray(req.body.tags)) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_TAGS',
                message: 'Tags must be provided as an array.'
            });
        }

        const normalizedTags = [
            ...new Set(
                req.body.tags
                    .filter((tag) => typeof tag === 'string')
                    .map((tag) => tag.trim())
                    .filter(Boolean)
            )
        ];

        if (normalizedTags.length > 10) {
            return res.status(400).json({
                success: false,
                error: 'TOO_MANY_TAGS',
                message: 'A menu item can have a maximum of 10 tags.'
            });
        }

        if (normalizedTags.some((tag) => tag.length > 50)) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_TAG_LENGTH',
                message: 'Each menu tag must be 50 characters or fewer.'
            });
        }

        updateFields.tags = normalizedTags;
    }

    if (req.body.isAvailable !== undefined) {
        if (typeof req.body.isAvailable !== 'boolean') {
            return res.status(400).json({
                success: false,
                error: 'INVALID_AVAILABILITY',
                message: 'Availability must be a boolean value.'
            });
        }

        updateFields.isAvailable = req.body.isAvailable;
    }

    if (Object.keys(updateFields).length === 0) {
        return res.status(400).json({
            success: false,
            error: 'NO_VALID_MENU_FIELDS',
            message: 'No valid menu item fields were provided for update.'
        });
    }

    updateFields.updatedBy = req.user.id;

    const updatedItem = await MenuItem.findOneAndUpdate(
        buildMenuItemMutationFilter(
            req.restaurant._id,
            id,
            version
        ),
        {
            $set: updateFields,
            $inc: { __v: 1 }
        },
        {
            new: true,
            runValidators: true
        }
    );

    if (!updatedItem) {
        const existingItem = await MenuItem.findOne({
            _id: id,
            restaurantId: req.restaurant._id
        })
            .select('_id isDeleted __v')
            .lean();

        if (!existingItem || existingItem.isDeleted) {
            return res.status(404).json({
                success: false,
                error: 'MENU_ITEM_NOT_FOUND',
                message: 'Menu item was not found for this restaurant.'
            });
        }

        return res.status(409).json({
            success: false,
            error: 'CONCURRENCY_CONFLICT',
            message: 'Menu item was changed by another request. Refresh the item and try again.'
        });
    }

    return res.status(200).json({
        success: true,
        message: 'Menu item successfully updated.',
        item: updatedItem
    });
}));

// 3. UPLOAD MENU ITEM IMAGE (POST /api/seller/menu/:id/image)
router.post(
    '/menu/:id/image',
    verifySeller,
    attachRestaurantContext,
    createImageUpload({
        fieldName: 'menuImage'
    }),
    asyncHandler(async (req, res) => {
        const { id } = req.params;
        const rawVersion = req.body.__v;
        const version = Number(rawVersion);

        if (!mongoose.Types.ObjectId.isValid(id)) {
            if (req.file) {
                await cleanupUploadedMenuFiles([req.file]);
            }

            return res.status(400).json({
                success: false,
                error: 'INVALID_MENU_ITEM_ID',
                message: 'Menu item ID is invalid.'
            });
        }

        if (
            rawVersion === undefined ||
            !Number.isInteger(version) ||
            version < 0
        ) {
            if (req.file) {
                await cleanupUploadedMenuFiles([req.file]);
            }

            return res.status(400).json({
                success: false,
                error: 'INVALID_MENU_ITEM_VERSION',
                message: 'A valid menu item version is required for image update.'
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'MENU_IMAGE_REQUIRED',
                message: 'Menu item image is required.'
            });
        }

        const currentItem = await MenuItem.findOne(
            buildMenuItemMutationFilter(
                req.restaurant._id,
                id,
                version
            )
        )
            .select('_id image __v')
            .lean();

        if (!currentItem) {
            await cleanupUploadedMenuFiles([req.file]);

            const existingItem = await MenuItem.findOne({
                _id: id,
                restaurantId: req.restaurant._id
            })
                .select('_id isDeleted __v')
                .lean();

            if (!existingItem || existingItem.isDeleted) {
                return res.status(404).json({
                    success: false,
                    error: 'MENU_ITEM_NOT_FOUND',
                    message: 'Menu item was not found for this restaurant.'
                });
            }

            return res.status(409).json({
                success: false,
                error: 'CONCURRENCY_CONFLICT',
                message: 'Menu item was changed by another request. Refresh the item and try again.'
            });
        }

        let storedFilename = null;

        try {
            storedFilename = await storeMenuImage(
                req.file,
                req.restaurant._id,
                id
            );

            const updatedItem = await MenuItem.findOneAndUpdate(
                buildMenuItemMutationFilter(
                    req.restaurant._id,
                    id,
                    version
                ),
                {
                    $set: {
                        image: storedFilename,
                        updatedBy: req.user.id
                    },
                    $inc: {
                        __v: 1
                    }
                },
                {
                    new: true,
                    runValidators: true
                }
            );

            if (!updatedItem) {
                await deleteMenuImage(
                    req.restaurant._id,
                    id,
                    storedFilename
                );

                return res.status(409).json({
                    success: false,
                    error: 'CONCURRENCY_CONFLICT',
                    message: 'Menu item was changed by another request. Refresh the item and try again.'
                });
            }

            if (
                currentItem.image &&
                currentItem.image !== storedFilename
            ) {
                try {
                    await deleteMenuImage(
                        req.restaurant._id,
                        id,
                        currentItem.image
                    );
                } catch (cleanupError) {
                    if (req.log) {
                        req.log.warn({
                            event: 'MENU_ITEM_OLD_IMAGE_DELETE_FAILED',
                            menuItemId: id,
                            restaurantId: req.restaurant._id,
                            filename: currentItem.image,
                            error: cleanupError.message
                        });
                    }
                }
            }

            req.file = null;

            return res.status(200).json({
                success: true,
                message: 'Menu item image successfully updated.',
                item: updatedItem
            });
        } catch (error) {
            if (req.file) {
                await cleanupUploadedMenuFiles([req.file]);
            } else if (storedFilename) {
                try {
                    await deleteMenuImage(
                        req.restaurant._id,
                        id,
                        storedFilename
                    );
                } catch (cleanupError) {
                    if (req.log) {
                        req.log.warn({
                            event: 'MENU_ITEM_NEW_IMAGE_CLEANUP_FAILED',
                            menuItemId: id,
                            restaurantId: req.restaurant._id,
                            filename: storedFilename,
                            error: cleanupError.message
                        });
                    }
                }
            }

            throw error;
        }
    })
);

// 4. SOFT DELETE SELLER MENU ITEM (DELETE /api/seller/menu/:id)
router.delete('/menu/:id', verifySeller, attachRestaurantContext, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const rawVersion = req.body?.__v;
    const version = Number(rawVersion);

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
            success: false,
            error: 'INVALID_MENU_ITEM_ID',
            message: 'Menu item ID is invalid.'
        });
    }

    if (
        rawVersion === undefined ||
        !Number.isInteger(version) ||
        version < 0
    ) {
        return res.status(400).json({
            success: false,
            error: 'INVALID_MENU_ITEM_VERSION',
            message: 'A valid menu item version is required for deletion.'
        });
    }

    const deletedItem = await MenuItem.findOneAndUpdate(
        buildMenuItemMutationFilter(
            req.restaurant._id,
            id,
            version
        ),
        {
            $set: {
                isDeleted: true,
                deletedAt: new Date(),
                isAvailable: false,
                updatedBy: req.user.id
            },
            $inc: {
                __v: 1
            }
        },
        {
            new: true,
            runValidators: true
        }
    );

    if (!deletedItem) {
        const existingItem = await MenuItem.findOne({
            _id: id,
            restaurantId: req.restaurant._id
        })
            .select('_id isDeleted __v')
            .lean();

        if (!existingItem || existingItem.isDeleted) {
            return res.status(404).json({
                success: false,
                error: 'MENU_ITEM_NOT_FOUND',
                message: 'Menu item was not found for this restaurant.'
            });
        }

        return res.status(409).json({
            success: false,
            error: 'CONCURRENCY_CONFLICT',
            message: 'Menu item was changed by another request. Refresh the item and try again.'
        });
    }

    if (deletedItem.image) {
        try {
            await deleteMenuImage(
                req.restaurant._id,
                id,
                deletedItem.image
            );
        } catch (cleanupError) {
            if (req.log) {
                req.log.warn({
                    event: 'MENU_ITEM_IMAGE_DELETE_FAILED',
                    menuItemId: id,
                    restaurantId: req.restaurant._id,
                    filename: deletedItem.image,
                    error: cleanupError.message
                });
            }
        }
    }

    return res.status(200).json({
        success: true,
        message: 'Menu item successfully deleted.',
        item: deletedItem
    });
}));

// 5. GET SELLER'S MENU (GET /api/seller/menu)
router.get('/menu', verifySeller, attachRestaurantContext, asyncHandler(async (req, res) => {
    const MAX_SELLER_MENU_ITEMS = 200;

const items = await MenuItem.find(
    buildActiveSellerMenuFilter(req.restaurant._id)
)
    .sort({ createdAt: -1 })
    .limit(MAX_SELLER_MENU_ITEMS)
    .lean();
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
    const { status, reason } = req.body;
const normalizedReason = typeof reason === 'string' ? reason.trim() : '';

if (status === 'Cancelled' && !normalizedReason) {
    return res.status(400).json({
        success: false,
        error: 'CANCELLATION_REASON_REQUIRED',
        message: 'A cancellation reason is required when rejecting an order.'
    });
}

if (normalizedReason.length > 300) {
    return res.status(400).json({
        success: false,
        error: 'CANCELLATION_REASON_TOO_LONG',
        message: 'Cancellation reason must not exceed 300 characters.'
    });
}

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
        reason: status === 'Cancelled' ? normalizedReason : null,
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
                statusUpdatedAt: historicalAuditNode.changedAt,
                cancellationReason: status === 'Cancelled' ? normalizedReason : null
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
// DYNAMIC ROUTES (MUST STAY AT THE BOTTOM)

router.get('/menu/:id/image', asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
            success: false,
            error: 'INVALID_MENU_ITEM_ID'
        });
    }

    const menuItem = await MenuItem.findOne({
        _id: id,
        isAvailable: true,
        isDeleted: false,
        image: { $ne: null }
    })
        .select('_id restaurantId image')
        .lean();

    if (!menuItem || !menuItem.image) {
        return res.status(404).json({
            success: false,
            error: 'MENU_ITEM_IMAGE_NOT_FOUND'
        });
    }

    const imagePath = await resolveMenuImagePath(
        menuItem.restaurantId,
        menuItem._id,
        menuItem.image
    );

    if (!imagePath) {
        return res.status(404).json({
            success: false,
            error: 'MENU_ITEM_IMAGE_NOT_FOUND'
        });
    }

    return res.sendFile(imagePath, (err) => {
        if (err && !res.headersSent) {
            return res.status(
                err.statusCode === 404 ? 404 : 500
            ).json({
                success: false,
                error: 'MENU_ITEM_IMAGE_NOT_FOUND'
            });
        }
    });
}));

router.get('/:id', asyncHandler(async (req, res) => {
    const restaurantId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
        return res.status(400).json({
            success: false,
            error: "INVALID_RESTAURANT_ID",
            message: "Target search parameters are not valid mongoose ObjectIds."
        });
    }

    const MAX_PUBLIC_MENU_ITEMS = 200;

    const items = await MenuItem.find({
        restaurantId: restaurantId,
        isAvailable: true,
        isDeleted: false
    })
        .sort({ createdAt: -1 })
        .limit(MAX_PUBLIC_MENU_ITEMS)
        .lean();

    return res.status(200).json(items);
}));

// PROBLEM 1 FIXED: Global Error handler boundary moved natively to server roots. 
// Route errors are seamlessly passed down via next(err) parameters.

module.exports = router;