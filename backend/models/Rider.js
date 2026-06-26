const mongoose = require('mongoose');

// Define the Rider Schema to store specific details like vehicle and KYC documents
const riderSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    licenseNumber: {
        type: String,
        required: true
    },
    citizenshipNo: {
        type: String,
        required: true
    },
    bikeNumber: {
        type: String,
        required: true
    },
    documents: {
        citizenshipFront: { type: String },
        citizenshipBack: { type: String },
        licenseFront: { type: String },
        bluebookImage: { type: String },
        nidDoc: { type: String }
    },
    isAvailable: {
        type: Boolean,
        default: false
    },
    currentLocation: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number], // Format: [longitude, latitude]
            default: [0, 0]
        }
    }
}, { timestamps: true });

// Create a geospatial index for efficient nearby rider searches later
riderSchema.index({ currentLocation: '2dsphere' });

module.exports = mongoose.model('Rider', riderSchema);