const mongoose = require('mongoose');

/**
 * @description Menu Item Schema
 * Seller-managed food catalog with strict pricing, classification,
 * availability state, soft delete, audit fields and image reference.
 */
const menuItemSchema = new mongoose.Schema({

    restaurantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Restaurant',
        required: true,
        index: true
    },

    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 150
    },

    description: {
        type: String,
        trim: true,
        maxlength: 500,
        default: ''
    },

    price: {
        type: Number,
        required: true,
        min: 100,
        validate: {
            validator: Number.isInteger,
            message: 'Price must be an integer amount in NPR.'
        }
    },

    foodCategory: {
        type: String,
        enum: ['Veg', 'Non-Veg'],
        default: 'Veg'
    },

    tags: [{
        type: String,
        trim: true,
        maxlength: 50,
        index: true
    }],

    image: {
        type: String,
        trim: true,
        maxlength: 255,
        default: null
    },

    isAvailable: {
        type: Boolean,
        default: true,
        index: true
    },

    isDeleted: {
        type: Boolean,
        default: false,
        index: true
    },

    deletedAt: {
        type: Date,
        default: null,
        index: true
    },

    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },

    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }

}, {
    timestamps: true
});

menuItemSchema.index({ restaurantId: 1, createdAt: -1 });
menuItemSchema.index({ restaurantId: 1, isAvailable: 1, isDeleted: 1 });
menuItemSchema.index({ restaurantId: 1, price: 1 });

menuItemSchema.index({
    name: 'text',
    tags: 'text'
});

module.exports = mongoose.model('MenuItem', menuItemSchema);