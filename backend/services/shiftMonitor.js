const cron = require('node-cron');
const User = require('../models/User');

const startShiftMonitor = () => {
    // Monitor runs every 5 minutes (24/7 background process) to gracefully clean up expired shifts
    cron.schedule('*/5 * * * *', async () => {
        try {
            // Calculate the exact cutoff time (12 hours ago)
            const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
            
            // Find riders who have exceeded 12 hours AND are not currently on a delivery
            // NOTE: Replace 'currentActiveOrderId' with the exact field name you use in your User schema to track active orders
            const query = {
                role: 'Rider',
                isOnline: true,
                shiftStartTime: { $lte: twelveHoursAgo },
                currentActiveOrderId: null // Critical safety check: Only log out if the rider is entirely idle
            };

            const result = await User.updateMany(
                query,
                { $set: { isOnline: false, shiftStartTime: null } }
            );

            if (result.modifiedCount === 0) return;

            console.log(`[SHIFT MONITOR] ${result.modifiedCount} idle riders gracefully logged out after 12 hours of duty.`);

        } catch (error) {
            console.error('[SHIFT MONITOR ERROR]:', error.message);
        }
    });
};

module.exports = startShiftMonitor;