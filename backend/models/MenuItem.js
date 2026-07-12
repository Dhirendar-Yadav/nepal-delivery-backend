const mongoose = require('mongoose');

/**
 * @description Menu Item Schema - Swiggy/Zomato Grade
 * Optimized for standalone indexing, tags search, and strict financial precision.
 */
const menuItemSchema = new mongoose.Schema({

    // 🔗 RELATION (Foreign Key)
    restaurantId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Restaurant', 
        required: true,
        index: true
    },

    // 🧾 CORE DETAILS
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 150
    },

    price: { 
        type: Number, 
        required: true,
        min: 0,
        validate: {
            validator: Number.isInteger,
            message: 'Price must be in Paisa (Integer) to avoid floating point fintech errors'
        }
    },

    // 🍽 CLASSIFICATION
    foodCategory: { 
        type: String, 
        enum: ['Veg', 'Non-Veg', 'Egg'], 
        default: 'Veg' 
    },

    itemType: {
        type: String,
        enum: ['Main Course', 'Starter', 'Snack', 'Dessert', 'Beverage', 'Combo'],
        default: 'Main Course'
    },

    // ✨ SEARCH TAGS (e.g., ["spicy", "cheese", "fast-food"])
    tags: [{ type: String, index: true }],

    // 📝 MEDIA & DESCRIPTION
    description: { type: String, trim: true },
    image: { type: String, default: null },

    // ⚙️ OPERATIONAL STATE
    isAvailable: { type: Boolean, default: true, index: true },
    isDeleted: { type: Boolean, default: false }, // Soft Delete for Order History consistency

    // 🛡️ AUDIT TRAILS
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }

}, { 
    timestamps: true 
});

// ==========================================
// ⚡ COMPOSITE INDEXING (For Aggregation Speed)
// ==========================================

menuItemSchema.index({ restaurantId: 1, isAvailable: 1 });
menuItemSchema.index({ restaurantId: 1, price: 1 });

// Ultra-fast text search across name, description, and tags
menuItemSchema.index({
    name: 'text',
    tags: 'text'
});

module.exports = mongoose.model('MenuItem', menuItemSchema);

