const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose'); 

// Models
const Restaurant = require('../models/Restaurant');
const MenuItem = require('../models/MenuItem');
const Order = require('../models/Order');
const User = require('../models/User'); 

const restaurantController = require('../controllers/restaurantController');

// ==========================================
// 🛡️ SELLER SECURITY MIDDLEWARE
// ==========================================
const verifySeller = (req, res, next) => {
    const authHeader = req.header('Authorization');
    if (!authHeader) return res.status(401).json({ success: false, error: "Access Denied! Token Missing." });

    try {
        const token = authHeader.split(" ")[1];
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        
        if (verified.role !== 'Seller') {
            return res.status(403).json({ success: false, error: "Restricted! Only Sellers allowed." });
        }
        
        req.user = verified;
        // Universal ID handler
        req.user.id = verified.id || verified._id || verified.userId; 
        
        next();
    } catch (err) {
        res.status(403).json({ success: false, error: "Invalid or Expired Token!" });
    }
};

// ==========================================
// 🏢 CUSTOMER ROUTES (Public)
// ==========================================

// @route   GET /api/restaurants
// @desc    Get all restaurants with search, geo-location, and filters
router.get('/', restaurantController.getAllRestaurants);


// ==========================================
// 🏪 SELLER DASHBOARD ROUTES (Protected)
// ==========================================

// 1. ADD NEW MENU ITEM (POST /api/seller/menu)
router.post('/menu', verifySeller, async (req, res) => {
    try {
        const { name, price, description } = req.body;

        // 🚀 CHATGPT FIX: Basic Input Validation (Prevents Crash)
        if (!name || typeof name !== 'string') return res.status(400).json({ success: false, error: "Invalid item name" });
        if (typeof price !== 'number' || price <= 0) return res.status(400).json({ success: false, error: "Invalid price" });

        // Find the restaurant owned by this logged-in seller
        const restaurant = await Restaurant.findOne({ ownerId: req.user.id });
        if (!restaurant) {
            return res.status(404).json({ success: false, error: "Restaurant profile not found. Please contact Admin." });
        }

        // Create and save the new menu item
        const newItem = new MenuItem({
            restaurantId: restaurant._id,
            name,
            price,
            description,
            isAvailable: true
        });

        await newItem.save();
        res.status(201).json({ success: true, message: "Item added successfully", item: newItem });

    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 2. GET SELLER'S MENU (GET /api/seller/menu)
router.get('/menu', verifySeller, async (req, res) => {
    try {
        const restaurant = await Restaurant.findOne({ ownerId: req.user.id });
        if (!restaurant) return res.json([]); // Return empty array if no restaurant yet

        const items = await MenuItem.find({ restaurantId: restaurant._id }).sort({ createdAt: -1 });
        res.json(items);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 3. GET SELLER'S ORDERS (GET /api/seller/orders)
router.get('/orders', verifySeller, async (req, res) => {
    try {
        const restaurant = await Restaurant.findOne({ ownerId: req.user.id });
        if (!restaurant) return res.json([]);

        const orders = await Order.find({ restaurantId: restaurant._id })
            .populate('customerId', 'name phone') // Fetch customer details
            .populate('assignedRiderId', 'name phone bikeNumber') // Load Rider details so Seller can see who picked it up
            .sort({ createdAt: -1 });
            
        res.json(orders);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 4. UPDATE ORDER STATUS (PUT /api/seller/orders/:id/status)
router.put('/orders/:id/status', verifySeller, async (req, res) => {
    try {
        const { status } = req.body;
        const orderId = req.params.id;

        const restaurant = await Restaurant.findOne({ ownerId: req.user.id });
        if (!restaurant) return res.status(404).json({ success: false, error: "Restaurant not found." });

        let updatePayload = { status };
        let firstRiderId = null;

        // 🚀 CHATGPT FIX: Configured Status triggers securely
        const DISPATCH_TRIGGER_STATUSES = ['Preparing', 'Accepted', 'Cooking', 'Confirmed'];

        // 🚀 STARTUP-PHASE RIDER DISPATCH (SEQUENTIAL NEAREST NEIGHBOR ALGORITHM)
        if (DISPATCH_TRIGGER_STATUSES.includes(status)) {
            console.log(`[DISPATCH] Executing Sequential Nearest-Neighbor Algorithm for Order: ${orderId}...`);
            
            // Check if order hasn't been offered yet
            const existingOrder = await Order.findById(orderId).lean();
            
            if (existingOrder && !existingOrder.offeredRiderId && !existingOrder.assignedRiderId) {
                // Step 1: Find up to 10 nearest ONLINE and FREE riders
                const closestRiders = await User.find({
                    role: 'Rider',
                    isActive: true, 
                    isOnline: true, 
                    $or: [{ currentActiveOrderId: null }, { currentActiveOrderId: { $exists: false } }], 
                    currentLocation: {
                        $near: {
                            $geometry: restaurant.currentLocation
                        }
                    }
                }).limit(10).lean(); 

                if (closestRiders.length > 0) {
                    const riderQueueIds = closestRiders.map(rider => rider._id.toString());
                    firstRiderId = riderQueueIds[0];

                    updatePayload.dispatchQueue = riderQueueIds;
                    updatePayload.currentDispatchIndex = 0;
                    updatePayload.offeredRiderId = firstRiderId;
                    updatePayload.offerExpiresAt = new Date(Date.now() + 60 * 1000); // 60s timer

                    console.log(`[DISPATCH SUCCESS] Queue built. Order will be offered to Rider ID: ${firstRiderId}`);
                } else {
                    console.log(`[NOTICE] ⚠️ No free Active & Online riders available near the restaurant right now!`);
                }
            }
        }

        // 🚀 CHATGPT FIX: Atomic Guard Condition (Prevents double dispatching race condition)
        let queryCondition = { _id: orderId, restaurantId: restaurant._id };
        if (updatePayload.offeredRiderId) {
            queryCondition.offeredRiderId = null;
            queryCondition.assignedRiderId = null;
        }

        // Single Atomic Save
        const order = await Order.findOneAndUpdate(
            queryCondition,
            { $set: updatePayload },
            { new: true }
        ).populate('customerId', 'name phone')
         .populate('restaurantId', 'name address phone'); 

        // If order is not found here, it means either wrong ID, or another request already dispatched it.
        if (!order) return res.status(409).json({ success: false, error: "Order status update conflict or unauthorized." });

        // Fire WebSocket alert to Rider 1
        if (firstRiderId) {
            const io = req.app.get('io');
            if (io) {
                // 🚀 CHATGPT FIX: Guaranteed string format for Socket Room emit
                io.to(firstRiderId.toString()).emit('newOrderOffer', order);
                console.log(`[SOCKET] 🔔 Alert sent to Rider ID: ${firstRiderId}`);
            }
        }

        res.json({ success: true, order });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==========================================
// ⚠️ DYNAMIC ROUTES (MUST STAY AT THE BOTTOM)
// ==========================================

// ✨ GET MENU FOR CUSTOMER (GET /api/menu/:id)
// @route   GET /api/menu/:id
// @desc    Get all menu items for a specific restaurant (Customer View)
router.get('/:id', async (req, res) => {
    try {
        const restaurantId = req.params.id;

        // Validation: Check if it's a valid MongoDB ID
        if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
            return res.status(400).json({ success: false, error: "Invalid Restaurant ID" });
        }

        // Database se is restaurant ke saare items nikalo (Sirf wo jo available hain)
        const items = await MenuItem.find({ restaurantId: restaurantId, isAvailable: true }).sort({ createdAt: -1 });
        
        // Customer ko list bhej do
        res.json(items);
    } catch (err) {
        console.error("Fetch Menu Error:", err);
        res.status(500).json({ success: false, error: "Internal Server Error" });
    }
});

module.exports = router;