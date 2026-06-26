const mongoose = require('mongoose');
const Restaurant = require('../../models/Restaurant');
const User = require('../../models/User');

exports.getAllRestaurantsForAdmin = async (req, res) => {
    try {
        const { status, isDeleted, page = 1, limit = 50, search } = req.query;
        let query = {};
        if (status) query.status = status;
        if (isDeleted) query.isDeleted = isDeleted === 'true';
        if (search) query.name = new RegExp(search, 'i');

        const skip = (page - 1) * limit;
        const restaurants = await Restaurant.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        const total = await Restaurant.countDocuments(query);
        res.status(200).json({ success: true, total, data: restaurants });
    } catch (error) {
        res.status(500).json({ success: false, error: "Fetch failed" });
    }
};

exports.updateRestaurantStatus = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { id } = req.params;
        const { status, isVerifiedByAdmin } = req.body;

        const updatedRestaurant = await Restaurant.findOneAndUpdate(
            { _id: id },
            { $set: { status, isVerifiedByAdmin } },
            { session, new: true }
        );

        if (!updatedRestaurant) throw new Error('Restaurant not found');

        // ⚡ THE FIX: Sync User Status
        if (status === 'ACTIVE') {
            await User.findByIdAndUpdate(
                updatedRestaurant.ownerId, 
                { $set: { isActive: true, kycStatus: 'VERIFIED' } },
                { session }
            );
        } else if (status === 'SUSPENDED') {
            await User.findByIdAndUpdate(updatedRestaurant.ownerId, { $set: { isActive: false } }, { session });
        }

        await session.commitTransaction();
        session.endSession();
        res.status(200).json({ success: true, data: updatedRestaurant });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.updateOperationalState = async (req, res) => {
    try {
        const { id } = req.params;
        const { isOpen, isDeleted } = req.body;
        let updateFields = {};
        if (isOpen !== undefined) updateFields.isOpen = isOpen;
        if (isDeleted !== undefined) {
            updateFields.isDeleted = isDeleted;
            updateFields.deletedAt = isDeleted ? new Date() : null;
        }
        const updatedRestaurant = await Restaurant.findOneAndUpdate({ _id: id }, { $set: updateFields }, { new: true });
        res.status(200).json({ success: true, data: updatedRestaurant });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.updateRankingMetrics = async (req, res) => {
    try {
        const { id } = req.params;
        const { avgDeliveryTime, offerTag, commissionRate } = req.body;
        let updateFields = {};
        if (avgDeliveryTime !== undefined) updateFields.avgDeliveryTime = avgDeliveryTime;
        if (offerTag !== undefined) updateFields.offerTag = offerTag;
        if (commissionRate !== undefined) updateFields.commissionRate = commissionRate;
        const updatedRestaurant = await Restaurant.findOneAndUpdate({ _id: id }, { $set: updateFields }, { new: true });
        res.status(200).json({ success: true, data: updatedRestaurant });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// 🛠️ THE SYSTEM AUTO-HEALER (Migrates old data to new logic)
exports.syncLegacyData = async (req, res) => {
    try {
        // 1. Un saare restaurants ko pakdo jo ACTIVE hain
        const activeRestaurants = await Restaurant.find({ status: 'ACTIVE' });
        let fixedCount = 0;

        for (let rest of activeRestaurants) {
            // 2. Unka User account check karo
            const user = await User.findById(rest.ownerId);
            
            // 3. Agar User inactive pada hai purane bug ki wajah se, toh use fix karo!
            if (user && !user.isActive) {
                user.isActive = true;
                user.kycStatus = 'VERIFIED';
                await user.save();
                fixedCount++;
            }
        }
        res.status(200).json({ 
            success: true, 
            message: `SYSTEM SYNC COMPLETE! 🚀 Fixed ${fixedCount} old seller accounts.` 
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};