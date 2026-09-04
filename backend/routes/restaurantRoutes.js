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
const LedgerEntry = require('../models/LedgerEntry');

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

const PAYMENT_METHODS = Object.freeze(['Bank', 'eSewa']);

const normalizePaymentText = (value, maxLength = 120) => {
    if (typeof value !== 'string') {
        return '';
    }

    return value.trim().replace(/\s+/g, ' ').slice(0, maxLength);
};

const normalizeAccountNumber = (value) => {
    if (typeof value !== 'string') {
        return '';
    }

    return value.trim().replace(/[\s-]/g, '');
};

const maskSensitiveValue = (value, visibleStart = 0, visibleEnd = 4) => {
    const normalized = typeof value === 'string' ? value : '';

    if (!normalized) {
        return null;
    }

    if (normalized.length <= visibleEnd + visibleStart) {
        return '*'.repeat(normalized.length);
    }

    const prefix = visibleStart > 0
        ? normalized.slice(0, visibleStart)
        : '';

    const suffix = normalized.slice(-visibleEnd);

    return `${prefix}${'*'.repeat(
        Math.max(2, normalized.length - visibleStart - visibleEnd)
    )}${suffix}`;
};

const buildSafePayoutSettings = (payoutSettings = {}) => {
    const method = PAYMENT_METHODS.includes(payoutSettings.method)
        ? payoutSettings.method
        : null;

    const bankDetails = payoutSettings.bankDetails || {};

    return {
        method,
        eSewaId: method === 'eSewa'
            ? maskSensitiveValue(payoutSettings.eSewaId, 2, 2)
            : null,
        eSewaAccountName: method === 'eSewa'
            ? payoutSettings.eSewaAccountName || null
            : null,
        bankDetails: method === 'Bank'
            ? {
                accountName: bankDetails.accountName || null,
                bankName: bankDetails.bankName || null,
                accountNumber: maskSensitiveValue(
                    bankDetails.accountNumber,
                    0,
                    4
                )
            }
            : null
    };
};

const validatePaymentMethodPayload = (method, payload) => {
    if (!PAYMENT_METHODS.includes(method)) {
        return {
            valid: false,
            error: 'INVALID_PAYMENT_METHOD',
            message: 'Only Bank and eSewa payment methods are currently supported.'
        };
    }

    if (method === 'Bank') {
        const accountName = normalizePaymentText(payload.accountName, 100);
        const bankName = normalizePaymentText(payload.bankName, 100);
        const accountNumber = normalizeAccountNumber(payload.accountNumber);

        if (!accountName || accountName.length < 2) {
            return {
                valid: false,
                error: 'INVALID_ACCOUNT_NAME',
                message: 'A valid bank account holder name is required.'
            };
        }

        if (!bankName || bankName.length < 2) {
            return {
                valid: false,
                error: 'INVALID_BANK_NAME',
                message: 'A valid bank name is required.'
            };
        }

        if (!/^[A-Za-z0-9]{6,34}$/.test(accountNumber)) {
            return {
                valid: false,
                error: 'INVALID_ACCOUNT_NUMBER',
                message: 'Bank account number must contain 6 to 34 letters or digits.'
            };
        }

        return {
            valid: true,
            data: {
                method: 'Bank',
                eSewaId: null,
                eSewaAccountName: null,
                bankDetails: {
                    accountName,
                    bankName,
                    accountNumber
                }
            }
        };
    }

    const accountName = normalizePaymentText(payload.accountName, 100);
    const rawESewaId = normalizePaymentText(payload.eSewaId, 40);
    const eSewaId = rawESewaId.replace(/\D/g, '');

    if (!accountName || accountName.length < 2) {
        return {
            valid: false,
            error: 'INVALID_ACCOUNT_NAME',
            message: 'A valid eSewa account holder name is required.'
        };
    }

    if (!eSewaId || eSewaId.length < 7 || eSewaId.length > 40) {
        return {
            valid: false,
            error: 'INVALID_ESEWA_ID',
            message: 'A valid eSewa ID or mobile number is required.'
        };
    }

    return {
        valid: true,
        data: {
            method: 'eSewa',
            eSewaId,
            eSewaAccountName: accountName,
            bankDetails: {
                accountName: null,
                bankName: null,
                accountNumber: null
            }
        }
    };
};

const ORDER_STATUS_TRANSITIONS = {
    'Pending': ['Accepted', 'Cancelled'],
    'Accepted': ['Preparing', 'Cancelled'],
    'Preparing': ['Ready for Pickup', 'Cancelled'],
    'Ready for Pickup': [],
    'Out for Delivery': ['Delivered'],
    'Delivered': [], 
    'Cancelled': []  
};

//CENTRALIZED UTILITY MIDDLEWARES


//Centralized Express Async Error Handler Wrapper
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

//Hardened Seller Security Middleware
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

//Centralized Restaurant Context Attachment Middleware
const attachRestaurantContext = asyncHandler(async (req, res, next) => {
    const restaurant = await Restaurant.findOne({ ownerId: req.user.id })
        .select('_id currentLocation name isOpen status image registrationDoc panVatNumber')
        .lean();

    //FIX: Removed non-standard HTTP 444 code to comply with native gateway proxies contracts
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

//SELLER DASHBOARD ROUTES
router.get('/store', verifySeller, attachRestaurantContext, asyncHandler(async (req, res) => {
    res.set('Cache-Control', 'no-store, private, max-age=0');
    res.set('ETag', `"seller-store-${req.restaurant._id}-${Date.now()}"`);

    const restaurant = await Restaurant.findOne({
        _id: req.restaurant._id,
        ownerId: req.user.id
    })
        .select(
            '_id name panVatNumber isOpen status isDiscoverable image registrationDoc ' +
            'walletBalance totalSettled ' +
            'payoutSettings.method payoutSettings.eSewaId ' +
            'payoutSettings.eSewaAccountName ' +
            'payoutSettings.bankDetails.accountName ' +
            'payoutSettings.bankDetails.bankName'
        )
        .select('+payoutSettings.bankDetails.accountNumber')
        .lean();

    if (!restaurant) {
        return res.status(404).json({
            success: false,
            error: 'RESTAURANT_PROFILE_NOT_FOUND'
        });
    }

    return res.json({
        success: true,
        restaurant: {
            _id: restaurant._id,
            name: restaurant.name,
            panVatNumber: restaurant.panVatNumber,
            isOpen: restaurant.isOpen,
            status: restaurant.status,
            isDiscoverable: restaurant.isDiscoverable,
            image: restaurant.image,
            registrationDoc: restaurant.registrationDoc,
            walletBalance: restaurant.walletBalance,
            totalSettled: restaurant.totalSettled,
            payoutSettings: buildSafePayoutSettings(
                restaurant.payoutSettings
            )
        }
    });
}));

router.patch(
    '/store/payment-method',
    verifySeller,
    attachRestaurantContext,
    asyncHandler(async (req, res) => {
        const method = normalizePaymentText(req.body?.method, 20);
        const validation = validatePaymentMethodPayload(
            method,
            req.body || {}
        );

        if (!validation.valid) {
            return res.status(400).json({
                success: false,
                error: validation.error,
                message: validation.message
            });
        }

        const restaurant = await Restaurant.findOne({
            _id: req.restaurant._id,
            ownerId: req.user.id
        }).select('+payoutSettings.bankDetails.accountNumber');

        if (!restaurant) {
            return res.status(404).json({
                success: false,
                error: 'RESTAURANT_PROFILE_NOT_FOUND',
                message: 'Restaurant profile was not found.'
            });
        }

        const currentPayoutSettings = restaurant.payoutSettings || {};

        if (
            validation.data.method === 'eSewa' &&
            currentPayoutSettings.method === 'eSewa' &&
            currentPayoutSettings.eSewaId &&
            currentPayoutSettings.eSewaId === validation.data.eSewaId
        ) {
            return res.status(409).json({
                success: false,
                error: 'PAYMENT_METHOD_ALREADY_ADDED',
                message: 'This eSewa account is already added.'
            });
        }

        if (
            validation.data.method === 'Bank' &&
            currentPayoutSettings.method === 'Bank' &&
            currentPayoutSettings.bankDetails?.accountNumber &&
            currentPayoutSettings.bankDetails.accountNumber ===
                validation.data.bankDetails.accountNumber
        ) {
            return res.status(409).json({
                success: false,
                error: 'PAYMENT_METHOD_ALREADY_ADDED',
                message: 'This bank account is already added.'
            });
        }

        restaurant.payoutSettings = validation.data;

        await restaurant.save();

        return res.status(200).json({
            success: true,
            message: 'Payment method saved successfully.',
            payoutSettings: buildSafePayoutSettings(
                restaurant.payoutSettings
            )
        });
    })
);

router.get(
    '/store/statement',
    verifySeller,
    attachRestaurantContext,
    asyncHandler(async (req, res) => {
        const page = Number.parseInt(req.query.page, 10);
        const limit = Number.parseInt(req.query.limit, 10);

        const safePage = Number.isInteger(page) && page > 0 ? page : 1;
        const safeLimit = Number.isInteger(limit)
            ? Math.min(Math.max(limit, 1), 50)
            : 20;

        const skip = (safePage - 1) * safeLimit;

        const fromDate = typeof req.query.from === 'string'
            ? req.query.from.trim()
            : '';

        const toDate = typeof req.query.to === 'string'
            ? req.query.to.trim()
            : '';

        const createdAt = {};

        if (fromDate) {
            const parsedFrom = new Date(`${fromDate}T00:00:00.000Z`);

            if (Number.isNaN(parsedFrom.getTime())) {
                return res.status(400).json({
                    success: false,
                    error: 'INVALID_STATEMENT_FROM_DATE'
                });
            }

            createdAt.$gte = parsedFrom;
        }

        if (toDate) {
            const parsedTo = new Date(`${toDate}T23:59:59.999Z`);

            if (Number.isNaN(parsedTo.getTime())) {
                return res.status(400).json({
                    success: false,
                    error: 'INVALID_STATEMENT_TO_DATE'
                });
            }

            createdAt.$lte = parsedTo;
        }

        if (
            createdAt.$gte &&
            createdAt.$lte &&
            createdAt.$gte > createdAt.$lte
        ) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_STATEMENT_DATE_RANGE'
            });
        }

        const ledgerFilter = {
            entityType: 'RESTAURANT',
            entityId: req.restaurant._id,
            ...(Object.keys(createdAt).length > 0 ? { createdAt } : {})
        };

        const lifetimeLedgerFilter = {
            entityType: 'RESTAURANT',
            entityId: req.restaurant._id
        };

        const [
            entries,
            totalCount,
            financialSummary,
            lifetimeFinancialSummary,
            currentRestaurant
        ] = await Promise.all([
            LedgerEntry.find(ledgerFilter)
                .sort({ createdAt: -1, _id: -1 })
                .skip(skip)
                .limit(safeLimit)
                .select(
                    '_id settlementId orderId type amount currency balanceAfter description createdAt'
                )
                .lean(),
            LedgerEntry.countDocuments(ledgerFilter),
            LedgerEntry.aggregate([
                {
                    $match: ledgerFilter
                },
                {
                    $group: {
                        _id: null,
                        totalEarned: {
                            $sum: {
                                $cond: [
                                    {
                                        $and: [
                                            { $eq: ['$type', 'CREDIT'] },
                                            { $ne: ['$orderId', null] }
                                        ]
                                    },
                                    '$amount',
                                    0
                                ]
                            }
                        },
                        totalReceived: {
                            $sum: {
                                $cond: [
                                    {
                                        $and: [
                                            { $eq: ['$type', 'DEBIT'] },
                                            { $eq: ['$orderId', null] }
                                        ]
                                    },
                                    '$amount',
                                    0
                                ]
                            }
                        }
                    }
                }
            ]),
            LedgerEntry.aggregate([
                {
                    $match: lifetimeLedgerFilter
                },
                {
                    $group: {
                        _id: null,
                        totalEarned: {
                            $sum: {
                                $cond: [
                                    {
                                        $and: [
                                            { $eq: ['$type', 'CREDIT'] },
                                            { $ne: ['$orderId', null] }
                                        ]
                                    },
                                    '$amount',
                                    0
                                ]
                            }
                        },
                        totalReceived: {
                            $sum: {
                                $cond: [
                                    {
                                        $and: [
                                            { $eq: ['$type', 'DEBIT'] },
                                            { $eq: ['$orderId', null] }
                                        ]
                                    },
                                    '$amount',
                                    0
                                ]
                            }
                        }
                    }
                }
            ]),
            Restaurant.findOne({
                _id: req.restaurant._id,
                ownerId: req.user.id
            })
                .select('walletBalance totalSettled')
                .lean()
        ]);

        const orderIds = entries
            .map((entry) => entry.orderId)
            .filter(Boolean);

        const orders = orderIds.length > 0
            ? await Order.find({
                _id: { $in: orderIds },
                restaurantId: req.restaurant._id
            })
                .select(
                    '_id clientOrderId foodCost deliveryFee platformFee sellerEarning totalAmount status settlementStatus settlementId createdAt completedAt'
                )
                .lean()
            : [];

        const orderMap = new Map(
            orders.map((order) => [order._id.toString(), order])
        );

        const transactions = entries.map((entry) => {
            const order = entry.orderId
                ? orderMap.get(entry.orderId.toString()) || null
                : null;

            let transactionType;

            if (entry.type === 'CREDIT' && entry.orderId) {
                transactionType = 'ORDER_EARNING';
            } else if (entry.type === 'DEBIT' && !entry.orderId) {
                transactionType = 'SETTLEMENT_PAID';
            } else {
                req.log.error({
                    event: 'SELLER_STATEMENT_UNKNOWN_LEDGER_DIRECTION',
                    restaurantId: req.restaurant._id.toString(),
                    ledgerEntryId: entry._id.toString(),
                    settlementId: entry.settlementId,
                    orderId: entry.orderId,
                    type: entry.type
                });

                return res.status(500).json({
                    success: false,
                    error: 'FINANCIAL_INTEGRITY_FAILURE'
                });
            }

            return {
                transactionId: entry._id,
                transactionType,
                orderId: entry.orderId,
                clientOrderId: order?.clientOrderId || null,
                settlementId: entry.settlementId,
                amount: entry.amount,
                currency: entry.currency,
                balanceAfter: entry.balanceAfter,
                description: entry.description,
                order: order
                    ? {
                        foodCost: order.foodCost,
                        deliveryFee: order.deliveryFee,
                        platformFee: order.platformFee,
                        sellerEarning: entry.amount,
                        totalAmount: order.totalAmount,
                        status: order.status,
                        settlementStatus: order.settlementStatus
                    }
                    : null,
                createdAt: entry.createdAt
            };
        });

        const summaryData = financialSummary[0] || {
            totalEarned: 0,
            totalReceived: 0
        };

        const lifetimeSummaryData = lifetimeFinancialSummary[0] || {
            totalEarned: 0,
            totalReceived: 0
        };

        const currentPendingBalance = Number(currentRestaurant?.walletBalance || 0);
        const totalSettled = Number(currentRestaurant?.totalSettled || 0);
        const totalEarned = Number(summaryData.totalEarned || 0);
        const totalReceived = Number(summaryData.totalReceived || 0);
        const lifetimeTotalEarned = Number(lifetimeSummaryData.totalEarned || 0);
        const lifetimeLedgerReceived = Number(lifetimeSummaryData.totalReceived || 0);

        if (
            !Number.isSafeInteger(currentPendingBalance) ||
            !Number.isSafeInteger(totalSettled) ||
            !Number.isSafeInteger(totalEarned) ||
            !Number.isSafeInteger(lifetimeLedgerReceived)
        ) {
            req.log.error({
                event: 'SELLER_STATEMENT_FINANCIAL_INTEGRITY_FAILURE',
                restaurantId: req.restaurant._id.toString()
            });

            return res.status(500).json({
                success: false,
                error: 'FINANCIAL_INTEGRITY_FAILURE'
            });
        }

        const expectedPendingBalance =
            lifetimeTotalEarned - totalSettled;
        const ledgerWalletDifference =
            currentPendingBalance - expectedPendingBalance;

        const financialIntegrity = {
            valid:
                currentPendingBalance === expectedPendingBalance &&
                totalSettled === lifetimeLedgerReceived,
            expectedPendingBalance,
            actualPendingBalance: currentPendingBalance,
            ledgerReceived: lifetimeLedgerReceived,
            recordedReceived: totalSettled,
            ledgerWalletDifference
        };

        if (!financialIntegrity.valid) {
            req.log.error({
                event: 'SELLER_STATEMENT_RECONCILIATION_FAILURE',
                restaurantId: req.restaurant._id.toString(),
                expectedPendingBalance,
                actualPendingBalance: currentPendingBalance,
                ledgerReceived: lifetimeLedgerReceived,
                recordedReceived: totalSettled,
                ledgerWalletDifference
            });

            return res.status(500).json({
                success: false,
                error: 'FINANCIAL_RECONCILIATION_FAILED',
                statement: {
                    financialIntegrity
                }
            });
        }

        return res.status(200).json({
            success: true,
            statement: {
                summary: {
                    currentPendingBalance,
                    totalEarned,
                    totalReceived
                },
                financialIntegrity,
                transactions,
                pagination: {
                    page: safePage,
                    limit: safeLimit,
                    totalCount,
                    totalPages: Math.ceil(totalCount / safeLimit),
                    hasNextPage: skip + entries.length < totalCount
                }
            }
        });
    })
);

router.patch(
    '/store/status',
    verifySeller,
    restaurantController.updateStoreStatus
);
//ADD NEW MENU ITEM (POST /api/seller/menu)
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

//UPDATE SELLER MENU ITEM (PATCH /api/seller/menu/:id)
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

//UPLOAD MENU ITEM IMAGE (POST /api/seller/menu/:id/image)
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

//SOFT DELETE SELLER MENU ITEM (DELETE /api/seller/menu/:id)
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

//GET SELLER'S MENU (GET /api/seller/menu)
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

//GET SELLER'S ORDERS (GET /api/seller/orders)
router.get('/orders', verifySeller, attachRestaurantContext, asyncHandler(async (req, res) => {
    //FIX: Guard against memory saturation vulnerabilities via strict pagination bounds limits
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

//UPDATE ORDER STATUS (PUT /api/seller/orders/:id/status)
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

    //FIX: Enriched Audit node tracking payload boundaries to track cross-platform transitions context securely
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

    if (status === 'Ready for Pickup' && order.assignedRiderId) {
        try {
            const appIoContext = req.app.get('io');

            if (appIoContext) {
                appIoContext
                    .to(order.assignedRiderId.toString())
                    .emit('foodReadyForPickup', {
                        orderId: order._id,
                        restaurantId: order.restaurantId?._id || order.restaurantId,
                        restaurantName: order.restaurantId?.name || req.restaurant.name || 'Restaurant',
                        status: order.status,
                        readyAt: order.statusUpdatedAt
                    });
            }
        } catch (socketErr) {
            console.error('Food ready socket emission failed:', socketErr);
        }
    }

    if (DISPATCH_TRIGGER_STATUSES.includes(status)) {
        //NOTE ON PROBLEM: Switch from immediate asynchronous loops to persistent memory tasks queue
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

// Global Error handler boundary moved natively to server roots.
// Route errors are seamlessly passed down via next(err) parameters.

module.exports = router;
