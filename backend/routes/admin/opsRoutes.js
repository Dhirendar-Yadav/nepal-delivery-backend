const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const crypto = require('crypto');

const User = require('../../models/User');
const Order = require('../../models/Order');
const RiderProfile = require('../../models/RiderProfile');
const AdminWallet = require('../../models/AdminWallet');

const { verifyAdmin, statsLimiter, orderLimiter, criticalLimiter } = require('../../middlewares/adminAuth');

const generateHash = (...args) => crypto.createHash('sha256').update(args.join('_')).digest('hex');

const AdminAuditLog = mongoose.models.AdminAuditLog || mongoose.model('AdminAuditLog', new mongoose.Schema({
    _id: String, adminId: String, action: String, targetType: String, batchId: String, cursor: String, 
    createdAt: { type: Date, default: Date.now, expires: 7776000 } 
}));

// ==========================================
// 📊 DASHBOARD STATS
// ==========================================
router.get('/full-stats', verifyAdmin, statsLimiter, async (req, res) => {
    try {
        const now = new Date();
        const todayString = now.toISOString().split('T')[0];
        const startOfTodayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        const wallet = await AdminWallet.findOne({ date: todayString }).lean();
        
        const dailyStats = await Order.aggregate([
            { $match: { createdAt: { $gte: startOfTodayUTC }, status: 'Delivered' } },
            { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: "$totalAmount" } } }
        ]);

        res.json({ success: true, data: {
            totalOrdersProcessed: wallet?.totalOrdersProcessed || 0,
            totalRevenue: ((wallet?.totalPlatformRevenue || 0) / 100).toFixed(2),
            netProfit: ((wallet?.netCompanyProfit || 0) / 100).toFixed(2),
            availableBalance: ((wallet?.totalPlatformRevenue || 0) / 100).toFixed(2),
            dailyOrders: dailyStats[0]?.count || 0,
            dailyRevenue: ((dailyStats[0]?.revenue || 0) / 100).toFixed(2)
        }});
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ==========================================
// 🛵 RIDERS & CUSTOMERS
// ==========================================
router.get('/all-riders', verifyAdmin, statsLimiter, async (req, res) => {
    try {
        // 🛡️ CEO FIX: Frontend expects nested "userId" object (r.userId.name). We map it properly here!
        const riders = await User.find({ role: 'Rider' }).select('-password').lean();
        
        // Fetch specific documents/bike data from Rider/RiderProfile model
        const RiderModel = mongoose.models.Rider || mongoose.models.RiderProfile || RiderProfile;
        const profiles = await RiderModel.find({}).lean();
        const profilesByUserId = new Map(profiles
            .filter(profile => profile.userId)
            .map(profile => [profile.userId.toString(), profile]));

        const formattedRiders = riders.map(user => {
            const profile = profilesByUserId.get(user._id.toString()) || {};
            return {
                ...user,      // Original flat user data
                ...profile,   // Extra KYC/Bike docs from profile (if any)
                _id: user._id, // Ensure primary ID is user ID
                userId: {     // This is exactly what your frontend filter (r.userId?.name) is looking for!
                    _id: user._id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    isActive: user.isActive,
                    isOnline: user.isOnline, // ✨ CEO UPDATE: Passing live online/offline status to Admin Dashboard
                    kycStatus: user.kycStatus
                }
            };
        });

        res.json({ success: true, data: formattedRiders });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ✨ NEW: RIDER APPROVAL & KYC GATEKEEPER (For your Admin Control)
router.patch('/riders/:id/status', verifyAdmin, criticalLimiter, async (req, res) => {
    try {
        const { status, isActive } = req.body;
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, error: "Rider not found." });

        if (status) user.kycStatus = status; // e.g., 'VERIFIED' or 'REJECTED'
        if (typeof isActive === 'boolean') user.isActive = isActive; // true or false

        await user.save();
        res.json({ success: true, message: `Rider successfully updated!` });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.get('/all-customers', verifyAdmin, statsLimiter, async (req, res) => {
    try {
        const customers = await User.find({ role: 'Customer' }).select('-password').lean();
        res.json({ success: true, data: customers });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.get('/live-rider-shifts', verifyAdmin, statsLimiter, async (req, res) => {
    try {
        const riders = await User.find({ role: 'Rider', isOnline: true }).select('name phone shiftStartTime currentActiveOrderId').lean();
        const riderData = riders.map(rider => {
            const shiftDuration = rider.shiftStartTime ? Math.floor((Date.now() - new Date(rider.shiftStartTime)) / (1000 * 60)) : 0;
            return { ...rider, shiftDurationMinutes: shiftDuration, isOvertime: shiftDuration >= 720, isInBuffer: shiftDuration >= 700 && shiftDuration < 720, isBusy: !!rider.currentActiveOrderId };
        });
        res.json({ success: true, data: riderData });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.post('/reset-rider-shift', verifyAdmin, criticalLimiter, async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { riderId, clearCOD } = req.body;
        const user = await User.findById(riderId).session(session);
        if (!user) throw new Error("Rider not found");
        if (user.currentActiveOrderId) throw new Error("Cannot reset shift during active delivery!");

        user.shiftStartTime = new Date(); user.isOnline = true;
        await user.save({ session });

        if (clearCOD) {
            const riderProfile = await RiderProfile.findOne({ userId: riderId })
                .session(session)
                .select('wallet.balance');
            const walletBalance = riderProfile?.wallet?.balance || 0;

            await RiderProfile.findOneAndUpdate(
                { userId: riderId, "wallet.balance": walletBalance },
                { $inc: { "wallet.balance": -walletBalance } },
                { session, upsert: true }
            );
        }

        await session.commitTransaction(); res.json({ success: true, message: `Rider ${user.name} settled and shift restarted.` });
    } catch (err) {
        await session.abortTransaction(); res.status(400).json({ success: false, message: err.message });
    } finally { session.endSession(); }
});

// ==========================================
// 🛡️ ORDERS & MAINTENANCE
// ==========================================
router.get('/all-orders', verifyAdmin, orderLimiter, async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const { search, status, lastId } = req.query;
        let query = {};
        if (status) query.status = status;
        
        if (search && mongoose.Types.ObjectId.isValid(search)) {
            query._id = new mongoose.Types.ObjectId(search);
        } else if (lastId && mongoose.Types.ObjectId.isValid(lastId)) {
            query._id = { $lt: new mongoose.Types.ObjectId(lastId) };
        }

        const orders = await Order.find(query).populate('customerId', 'name phone').populate('restaurantId', 'name').sort({ _id: -1 }).limit(limit).lean(); 
        res.json({ success: true, data: orders });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.get('/active-tracking-orders', verifyAdmin, orderLimiter, async (req, res) => {
    try {
        const activeOrders = await Order.find({ status: { $in: ['Confirmed', 'Preparing', 'Out for Delivery'] } }).populate('restaurantId assignedRiderId').lean();
        res.json({ success: true, data: activeOrders });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// Deprecated: Delivery settlement handled only via riderController.completeOrder

router.delete('/purge/:type/:id', verifyAdmin, criticalLimiter, async (req, res) => {
    try {
        await AdminAuditLog.create({ _id: crypto.randomUUID(), adminId: req.user.id, action: `SOFT_DELETE_${req.params.type.toUpperCase()}`, targetId: req.params.id });
        res.json({ success: true, message: `Resource marked for deletion.` });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

module.exports = router;
