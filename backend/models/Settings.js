const mongoose = require('mongoose');
const settingsSchema = new mongoose.Schema({
    petrolPrice: { type: Number, default: 175 },
    platformCommission: { type: Number, default: 10 }, 
    lastUpdated: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Settings', settingsSchema);