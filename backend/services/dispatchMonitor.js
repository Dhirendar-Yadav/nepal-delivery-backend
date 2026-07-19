const cron = require('node-cron');
const dispatchService = require('./dispatchService');
const Order = require('../models/Order');

const startDispatchMonitor = (io) => {
    cron.schedule('*/5 * * * * *', async () => {
        try {
            const expiredOrders = await Order.find({
    status: "Ready for Pickup",
    assignedRiderId: null,
    offeredRiderId: { $ne: null },
    offerExpiresAt: { $lte: new Date() }
})
.select("_id")
.lean();

            for (const order of expiredOrders) {
                await dispatchService.advanceDispatchQueue(order._id, io);
            }

            if (expiredOrders.length) {
                console.log(`[DISPATCH MONITOR] Advanced ${expiredOrders.length} expired offer(s).`);
            }
        } catch (error) {
            console.error('[DISPATCH MONITOR ERROR]:', error.message);
        }
    });
};

module.exports = startDispatchMonitor;
