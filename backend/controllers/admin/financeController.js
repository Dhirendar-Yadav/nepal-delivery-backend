const mongoose = require('mongoose');
const Restaurant = require('../../models/Restaurant');
const LedgerEntry = require('../../models/LedgerEntry');

exports.processRestaurantSettlement = async (req, res) => {
    try {
        const { id } = req.params;
        const { settlementAmount, transactionReference } = req.body; 
        if (settlementAmount <= 0) return res.status(400).json({ success: false, error: 'Invalid amount' });

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const updatedRestaurant = await Restaurant.findOneAndUpdate(
                { _id: id, walletBalance: { $gte: settlementAmount } },
                { $inc: { walletBalance: -settlementAmount, totalSettled: settlementAmount, walletVersion: 1 }, $set: { lastSettlementId: transactionReference } },
                { session, new: true }
            );

            if (!updatedRestaurant) throw new Error('Insufficient balance');

            await LedgerEntry.create([{
                settlementId: transactionReference,
                entityType: 'RESTAURANT',
                entityId: id,
                type: 'DEBIT', 
                amount: settlementAmount,
                balanceAfter: updatedRestaurant.walletBalance,
                description: `Admin Payout Processed`
            }], { session });

            await session.commitTransaction();
            session.endSession();
            res.status(200).json({ success: true, data: updatedRestaurant });
        } catch (txnErr) {
            await session.abortTransaction();
            session.endSession();
            throw txnErr;
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};