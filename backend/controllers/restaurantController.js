const Restaurant = require('../models/Restaurant');
const mongoose = require('mongoose');

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const MAX_LIMIT = 50;

/**
 * @description Fetch all discoverable restaurants with Geo-sorting, filtering, and deep menu search.
 * @route GET /api/restaurants
 */
exports.getAllRestaurants = async (req, res) => {
    try {
        const { search, lat, lng, isPureVeg, categories, sort } = req.query;

        let pipeline = [];

        // 📍 1. GEO-LOCATION (MUST be the absolute first stage in MongoDB)
        // Only trigger geo-search if valid coordinates are provided by the user
        if (lat && lng && lat !== 'null' && lng !== 'null') {
            pipeline.push({
                $geoNear: {
                    near: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
                    distanceField: 'distance', 
                    spherical: true,
                    distanceMultiplier: 0.001, // Convert meters to kilometers
                    query: { isDiscoverable: true } // Use partial index efficiently
                }
            });
        } else {
            // If no location, we still only want to show discoverable restaurants
            pipeline.push({ $match: { isDiscoverable: true } });
        }

        // 🔍 2. SMART FILTERING
        let matchStage = {}; 

        if (isPureVeg === 'true') {
            matchStage.isPureVeg = true;
        }

        if (categories) {
            const catArray = categories.split(',');
            matchStage.foodTypes = { $in: catArray.map(c => new RegExp(`^${escapeRegex(c.trim())}$`, 'i')) };
        }

        // 🎯 3. DEEP SEARCH (Restaurant Name, Category OR Menu Items)
        if (search) {
            const searchRegex = new RegExp(escapeRegex(search), 'i');
            
            // We do a fast lookup ONLY if the user is searching for something
            pipeline.push({
                $lookup: {
                    from: 'menuitems', 
                    localField: '_id',
                    foreignField: 'restaurantId',
                    as: 'menuElements'
                }
            });

            matchStage.$or = [
                { name: searchRegex },
                { foodTypes: searchRegex },
                { 'menuElements.name': searchRegex },
                { 'menuElements.tags': searchRegex } 
            ];
        }

        // Apply all text and category filters
        if (Object.keys(matchStage).length > 0) {
            pipeline.push({ $match: matchStage });
        }

        // ⭐ 4. RANKING & SORTING (The Zomato Algorithm)
        let sortStage = {};
        if (sort === 'Rating') {
            sortStage.rating = -1; 
            sortStage.popularityScore = -1; // Tie-breaker
        } else if (sort === 'Nearest' && lat && lng) {
            sortStage.distance = 1; 
        } else {
            // Default Sort: Most popular and highest rated first
            sortStage.popularityScore = -1;
            sortStage.rating = -1;
        }
        
        pipeline.push({ $sort: sortStage });

        // 🗑️ 5. CLEANUP & PROJECTION (Optimize Bandwidth)
        let projection = {
            name: 1, 
            image: 1, 
            rating: 1, 
            foodType: 1, 
            foodTypes: 1, 
            currentLocation: 1, 
            distance: 1,
            offerTag: 1,
            isOpen: 1
        };

        pipeline.push({ $project: projection });

        // ⚡ 6. LIMIT FOR FAST LOAD (Pagination Base)
        // We limit to 50 for now. Real infinite scroll will use a cursor later.
        const limit = Math.min(
    parseInt(req.query.limit) || 20,
    MAX_LIMIT
);

pipeline.push({
    $limit: limit
});

        const restaurants = await Restaurant.aggregate(pipeline);
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const restaurantsWithImageUrls = restaurants.map((restaurant) => ({
            ...restaurant,
            image: restaurant.image ? `${baseUrl}/api/restaurants/${restaurant._id}/image` : null
        }));
        res.status(200).json(restaurantsWithImageUrls);

    } catch (error) {
        console.error("Database Aggregation Error:", error);
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
};
/**
 * @description Seller Store Open / Close
 * @route PATCH /api/restaurants/store/status
 */
exports.updateStoreStatus = async (req, res) => {
    try {

        const { isOpen } = req.body;

        if (typeof isOpen !== "boolean") {
            return res.status(400).json({
                success: false,
                message: "isOpen must be boolean"
            });
        }

        const restaurant = await Restaurant.findOneAndUpdate(
            {
                ownerId: new mongoose.Types.ObjectId(req.user.id),
                status: "ACTIVE",
                isDeleted: false
            },
            {
                $set: {
                    isOpen,
                    lastActiveAt: new Date()
                }
            },
            {
                new: true,
                runValidators: true
            }
        );

        if (!restaurant) {
            return res.status(404).json({
                success: false,
                message: "Restaurant not found"
            });
        }

        return res.json({
    success: true,
    message: isOpen
        ? "Restaurant opened successfully."
        : "Restaurant closed successfully.",

    restaurant: {
        _id: restaurant._id,
        name: restaurant.name,
        isOpen: restaurant.isOpen,
        status: restaurant.status,
        isDiscoverable: restaurant.isDiscoverable
    }
});

    } catch (err) {

        console.error(err);

        return res.status(500).json({
            success: false,
            message: "Failed to update restaurant status."
        });

    }
};