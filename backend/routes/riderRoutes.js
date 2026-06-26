const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose'); 
const crypto = require('crypto'); // 🚀 CHATGPT FIX: Added for Atomic OTP Generation

const User = require('../models/User');
const RiderProfile = require('../models/RiderProfile');
const Order = require('../models/Order');
const Restaurant = require('../models/Restaurant'); 
const AdminWallet = require('../models/AdminWallet'); 

// 🛡️ Middleware: Verify Token (Upgraded Security)
const verifyToken = (req, res, next) => {
    const authHeader = req.header('Authorization');
    // 🚀 CHATGPT FIX: Strict Token Parsing Guard
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ message: "Access Denied! Invalid authorization format." });
    }
    try {
        const token = authHeader.split(" ")[1];
        const verified = jwt.verify(token, process.env.JWT_SECRET || 'nepaldelivery_super_secret_key');
        req.user = verified;
        req.user.id = verified.id || verified._id || verified.userId;
        next();
    } catch (err) { res.status(403).json({ message: "Invalid Token!" }); }
};

// 1. ✨ RIDER SIGNUP (Preserved)
router.post('/signup', async (req, res) => {
    try {
        const { fullName, email, password, phone, licenseNumber, bikeNumber, citizenshipNo, nidNumber } = req.body;
        
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ message: "Email already registered!" });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({ 
            name: fullName, email, password: hashedPassword, phone, role: 'Rider'
        });
        await newUser.save();

        const files = req.files || {};
        const getUrl = (fieldname) => {
          return files[fieldname] ? `http://localhost:5005/uploads/${files[fieldname][0].filename}` : null;
        };

        const newRider = new RiderProfile({
            userId: newUser._id,
            licenseNumber,
            bikeNumber,
            citizenshipNo,
            nidNumber,
            citizenshipFront: getUrl('citizenshipFront'),
            citizenshipBack: getUrl('citizenshipBack'),
            licenseFront: getUrl('licenseFront'),
            nidDoc: getUrl('nidDoc'),
            bluebookDoc: getUrl('bluebookImage'),
            isVerified: false 
        });
        
        await newRider.save();
        res.status(201).json({ message: "Rider Account created. Pending Admin Approval!" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 2. ✨ RIDER PROFILE & BIKE UPDATE (Preserved)
router.get('/profile', verifyToken, async (req, res) => {
    try {
        let profile = await RiderProfile.findOne({ userId: new mongoose.Types.ObjectId(req.user.id) }).lean();
        
        if (!profile) {
            profile = await mongoose.connection.collection('riders').findOne({ userId: new mongoose.Types.ObjectId(req.user.id) });
        }

        const user = await User.findById(req.user.id).lean();

        if (!user) return res.status(404).json({ message: "User account not found!" });

        const mergedData = {
            ...(profile || {}), 
            bikeNumber: profile?.bikeNumber || user?.bikeNumber || 'Not Set',
            licenseNumber: profile?.licenseNumber || user?.licenseNumber || 'Not Set',
            citizenshipNo: profile?.citizenshipNo || user?.citizenshipNo || 'Not Set',
            phone: user?.phone || profile?.phone || 'Not Set',
            email: user?.email || profile?.email || 'Not Set',
            isOnline: user?.isOnline || false,
            shiftStartTime: user?.shiftStartTime || null,
            walletBalance: profile?.wallet?.balance || user?.walletBalance || 0,
            
            citizenshipFront: profile?.documents?.citizenshipFront || profile?.citizenshipFront || null,
            citizenshipBack: profile?.documents?.citizenshipBack || profile?.citizenshipBack || null,
            licenseFront: profile?.documents?.licenseFront || profile?.licenseFront || null,
            bluebookDoc: profile?.documents?.bluebookDoc || profile?.documents?.bluebookImage || profile?.bluebookDoc || profile?.bluebookImage || null,
            
            isVerified: profile?.isVerified === true || user?.kycStatus === 'VERIFIED'
        };

        res.status(200).json(mergedData);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/bike', verifyToken, async (req, res) => {
    try {
        const updatedProfile = await RiderProfile.findOneAndUpdate(
            { userId: req.user.id },
            { bikeNumber: req.body.bikeNumber },
            { new: true } 
        );
        res.status(200).json({ message: "Bike updated successfully!", profile: updatedProfile });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 2.5 ✨ GET AVAILABLE ORDERS FOR LIVE RADAR (Preserved)
router.get('/orders/available', verifyToken, async (req, res) => {
    try {
        const now = new Date();
        const userId = new mongoose.Types.ObjectId(req.user.id);
        
        const availableOrders = await Order.find({
            status: { $in: ['Confirmed', 'Cooking', 'Preparing', 'Accepted'] }, 
            offeredRiderId: userId,
            offerExpiresAt: { $gt: now }, 
            assignedRiderId: null 
        })
        .populate('restaurantId', 'name location latitude longitude phone') 
        .lean();

        res.status(200).json(availableOrders);
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

// ✨ Auto-Resume Logic (Check for Ongoing Orders)
router.get('/orders/active', verifyToken, async (req, res) => {
    try {
        const activeOrder = await Order.findOne({
            assignedRiderId: req.user.id,
            status: 'Out for Delivery'
        })
        .populate('restaurantId', 'name location latitude longitude address phone') 
        .populate('customerId', 'name phone') 
        .lean();

        if (activeOrder) {
            res.status(200).json({ success: true, order: activeOrder });
        } else {
            res.status(200).json({ success: false, message: "No active orders found." });
        }
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

// 3. ✨ DISPATCH LOGIC (ACCEPT ORDER) - 🚀 CHATGPT FIX: Fully Atomic Concurrency Lock
router.put('/orders/:id/accept', verifyToken, async (req, res) => {
    try {
        const now = new Date();
        
        // 🚀 THE MAGIC: Generate OTP before update to insert atomically
        const generatedOTP = Math.floor(1000 + Math.random() * 9000).toString();
        const hashedOTP = crypto.createHash('sha256').update(generatedOTP).digest('hex');

        // 🚀 CHATGPT FIX: Atomic Order Accept (No Race Conditions)
        const order = await Order.findOneAndUpdate(
            {
                _id: req.params.id,
                offeredRiderId: req.user.id,
                offerExpiresAt: { $gt: now },
                assignedRiderId: null
            },
            {
                $set: {
                    assignedRiderId: req.user.id,
                    status: 'Out for Delivery',
                    offeredRiderId: null, 
                    offerExpiresAt: null,
                    deliveryOTP: hashedOTP,
                    otpUsed: false,
                    deliveryOTPExpiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000)
                }
            },
            { new: true }
        );

        if (!order) {
            return res.status(400).json({ message: "Order no longer available, timer expired, or already accepted!" });
        }

        // 🟢 Mark rider as busy
        const riderDetails = await User.findByIdAndUpdate(
            req.user.id, 
            { currentActiveOrderId: order._id },
            { new: true } 
        );

        // SEND LIVE WEBSOCKET ALERT TO SELLER
        const io = req.app.get('io');
        if (io && order.restaurantId) {
            io.to(order.restaurantId.toString()).emit('orderAssignedToRider', {
                orderId: order._id,
                riderName: riderDetails.name,
                riderPhone: riderDetails.phone,
                riderBike: riderDetails.bikeNumber || 'N/A'
            });
        }

        const populatedOrder = await Order.findById(order._id)
            .populate('restaurantId', 'name location latitude longitude address phone')
            .populate('customerId', 'name phone')
            .lean();

        res.status(200).json({ 
            message: "Order Accepted Successfully!", 
            order: populatedOrder,
            deliveryOTP: generatedOTP 
        });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

// 4. ✨ LIVE LOCATION UPDATE (Upgraded Security)
router.post('/update-location', verifyToken, async (req, res) => {
    try {
        const { orderId, latitude, longitude } = req.body;
        
        // 🚀 CHATGPT FIX: GPS Validation & Bounds Check
        if (typeof latitude !== 'number' || typeof longitude !== 'number' || 
            latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            return res.status(400).json({ message: "Invalid GPS Coordinates!" });
        }

        const updatedOrder = await Order.findOneAndUpdate(
            { _id: orderId, assignedRiderId: req.user.id, status: 'Out for Delivery' },
            { riderLocation: { lat: latitude, lng: longitude }, lastLocationUpdate: Date.now() },
            { new: true }
        );
        
        if (!updatedOrder) {
            return res.status(404).json({ message: "Active Order not found for tracking!" });
        }
        res.status(200).json({ message: "Location Synchronized", coords: updatedOrder.riderLocation });
    } catch (err) { res.status(500).json({ message: "Tracking Sync Failed", error: err.message }); }
});

// 5. ✨ ORDER COMPLETION & AUTOMATED WALLET SETTLEMENT (🚀 CHATGPT FIX: Fintech-Grade Transactions)
router.put('/orders/:id/complete', verifyToken, async (req, res) => {
    // 🚀 THE FIX: MongoDB Session for strict Financial Consistency
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { otp } = req.body;
        const order = await Order.findById(req.params.id).session(session);

        if (!order) throw new Error("Order not found!");
        if (order.assignedRiderId.toString() !== req.user.id) throw new Error("Unauthorized Rider!");
        
        // 🚀 CHATGPT FIX: Idempotency Check
        if (order.status === 'Delivered') throw new Error("Order has already been completed!");

        // Use our hardened OTP verification method
        order.verifyOTP(otp); 

        const riderBonus = order.riderIncentive || Math.round(order.totalAmount * 0.02);
        const netAdminProfit = order.platformFee - riderBonus;

        // A. Update Rider Wallet
        await RiderProfile.findOneAndUpdate(
            { userId: req.user.id },
            { $inc: { 
                "wallet.balance": (order.deliveryFee + riderBonus), 
                "wallet.incentiveEarnings": riderBonus 
            } },
            { session }
        );

        // B. Update Seller Wallet
        await Restaurant.findByIdAndUpdate(
            order.restaurantId,
            { $inc: { "wallet.balance": order.foodCost, "wallet.totalEarnings": order.foodCost } },
            { session }
        );

        // C. Update Admin Master Wallet
        await AdminWallet.findOneAndUpdate(
            {}, 
            { $inc: { 
                totalPlatformRevenue: order.platformFee, 
                totalRiderBonusesPaid: riderBonus, 
                netCompanyProfit: netAdminProfit,
                totalOrdersProcessed: 1
            } },
            { upsert: true, session }
        );

        // D. Mark Order Delivered
        order.status = 'Delivered';
        await order.save({ session }); // Important to save with session

        // E. The 11:40 Buffer Check & Active Order Cleanup
        const user = await User.findById(req.user.id).session(session);
        let shiftEndedMsg = "";
        let isForcedOffline = false;

        if (user && user.shiftStartTime) {
            const shiftDurationMinutes = (Date.now() - new Date(user.shiftStartTime).getTime()) / (1000 * 60);
            
            // 🚀 CHATGPT FIX: Use Configurable Max Duration (Defaults to 700)
            const maxDuration = process.env.MAX_SHIFT_DURATION_MINUTES || 700;

            if (shiftDurationMinutes >= maxDuration) {
                user.isOnline = false;
                user.shiftStartTime = null;
                isForcedOffline = true;
                shiftEndedMsg = " 🛑 Shift limit reached. You are now offline. Please settle pending COD to start a new shift.";
            }
            
            user.currentActiveOrderId = null;
            await user.save({ session });
        }

        // 🚀 COMMIT TRANSACTION: Agar yahan tak sab theek hai, toh hi DB me save hoga
        await session.commitTransaction();
        session.endSession();

        res.status(200).json({ 
            message: "Order Delivered! Funds split successfully. 💰" + shiftEndedMsg,
            forcedOffline: isForcedOffline 
        });
    } catch (err) {
        // 🚀 ABORT TRANSACTION: Agar crash hua toh saare wallets purani state me wapas aa jayenge!
        await session.abortTransaction();
        session.endSession();
        res.status(400).json({ error: "Settlement Engine Error", details: err.message });
    }
});

// 6. ✨ TOGGLE ONLINE/OFFLINE STATUS (Preserved)
router.put('/toggle-status', verifyToken, async (req, res) => {
    try {
        const { targetStatus } = req.body; 
        const user = await User.findById(req.user.id);
        
        if (!user) return res.status(404).json({ message: "User not found!" });

        let profile = await RiderProfile.findOne({ userId: new mongoose.Types.ObjectId(req.user.id) });
        if (!profile) {
            profile = await mongoose.connection.collection('riders').findOne({ userId: new mongoose.Types.ObjectId(req.user.id) });
        }

        if (targetStatus === true) {
            const pendingCOD = profile?.wallet?.codPending || 0; 
            
            if (pendingCOD > 0) {
                return res.status(403).json({ 
                    success: false, 
                    requiresSettlement: true,
                    message: `Pichli shift ka NPR ${pendingCOD} COD cash pending hai. Nayi shift shuru karne ke liye pehle pay karein.`
                });
            }

            user.isOnline = true;
            user.shiftStartTime = new Date(); 
            await user.save();
            
            return res.status(200).json({ success: true, message: "Shift Started! You are now ONLINE." });
        } else {
            user.isOnline = false;
            user.shiftStartTime = null; 
            await user.save();
            
            return res.status(200).json({ success: true, message: "You are now OFFLINE." });
        }
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;