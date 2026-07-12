const mongoose = require('mongoose');
const settingsSchema = new mongoose.Schema({
    petrolPrice: {
        type: Number,
        default: 175,
        min: 0,
        validate: {
            validator: Number.isFinite,
            message: "Petrol price must be a valid number."
        }
    },
    platformCommission: {
        type: Number,
        default: 10,
        min: 0,
        max: 100,
        validate: {
            validator: Number.isFinite,
            message: "Platform commission must be a valid percentage."
        }
    }, 
    lastUpdated: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Settings', settingsSchema);
