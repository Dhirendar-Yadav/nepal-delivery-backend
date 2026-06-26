const Restaurant = require('../models/Restaurant');

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
            matchStage.foodTypes = { $in: catArray.map(c => new RegExp(`^${c.trim()}$`, 'i')) };
        }

        // 🎯 3. DEEP SEARCH (Restaurant Name, Category OR Menu Items)
        if (search) {
            const searchRegex = new RegExp(search, 'i');
            
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
        pipeline.push({ $limit: 50 });

        const restaurants = await Restaurant.aggregate(pipeline);
        res.status(200).json(restaurants);

    } catch (error) {
        console.error("Database Aggregation Error:", error);
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
};