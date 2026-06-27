const mongoose = require('mongoose');

const walletLedgerSchema = new mongoose.Schema(
    {
        orderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Order',
            required: true,
            unique: true,
            index: true
        },

        type: {
            type: String,
            required: true,
            trim: true,
            index: true
        },

        riderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },

        restaurantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Restaurant',
            required: true,
            index: true
        },

        adminWalletId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'AdminWallet',
            default: null
        },

        transactionId: {
            type: String,
            required: true,
            unique: true,
            index: true,
            trim: true
        },

        amount: {
            type: Number,
            required: true,
            min: 0
        },

        riderCredit: {
            type: Number,
            default: 0,
            min: 0
        },

        restaurantCredit: {
            type: Number,
            default: 0,
            min: 0
        },

        platformCredit: {
            type: Number,
            default: 0,
            min: 0
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

walletLedgerSchema.index({ riderId: 1, createdAt: -1 });
walletLedgerSchema.index({ restaurantId: 1, createdAt: -1 });

module.exports = mongoose.model('WalletLedger', walletLedgerSchema);