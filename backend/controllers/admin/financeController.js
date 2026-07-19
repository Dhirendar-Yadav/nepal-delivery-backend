const mongoose = require('mongoose');
const Restaurant = require('../../models/Restaurant');
const LedgerEntry = require('../../models/LedgerEntry');

exports.processRestaurantSettlement = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
        success: false,
        error: "INVALID_RESTAURANT_ID"
    });
}
        const { settlementAmount, transactionReference } = req.body; 
        if (
    !Number.isFinite(settlementAmount) ||
    settlementAmount <= 0
) {
    return res.status(400).json({
        success: false,
        error: "INVALID_SETTLEMENT_AMOUNT"
    });
}
if (
    typeof transactionReference !== "string" ||
    transactionReference.trim().length < 3
) {
    return res.status(400).json({
        success: false,
        error: "INVALID_TRANSACTION_REFERENCE"
    });
}
        const existingSettlement = await LedgerEntry.findOne({
    settlementId: transactionReference
});

if (existingSettlement) {
    return res.status(409).json({
        success: false,
        error: "DUPLICATE_SETTLEMENT_REFERENCE"
    });
}
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