const cron = require('node-cron');
const Order = require('../models/Order');
const { emitToUser } = require('./socketService');

const PREPARATION_WINDOW_MS = 5 * 60 * 1000;

const startPreparationMonitor = () => {
    cron.schedule('*/5 * * * * *', async () => {
        try {
            const preparationCutoff = new Date(Date.now() - PREPARATION_WINDOW_MS);

            const preparingOrders = await Order.find({
                status: 'Preparing',
                processingStartedAt: {
                    $ne: null,
                    $lte: preparationCutoff
                },
                assignedRiderId: {
                    $ne: null
                }
            })
                .sort({ processingStartedAt: 1, _id: 1 })
                .limit(100)
                .select('_id restaurantId assignedRiderId processingStartedAt')
                .lean();

            for (const candidateOrder of preparingOrders) {
                const statusUpdatePayload = Order.buildStatusUpdatePayload(
                    'Preparing',
                    'Ready for Pickup',
                    'SYSTEM'
                );

                const order = await Order.findOneAndUpdate(
                    {
                        _id: candidateOrder._id,
                        status: 'Preparing',
                        processingStartedAt: {
                            $ne: null,
                            $lte: preparationCutoff
                        },
                        assignedRiderId: {
                            $ne: null
                        }
                    },
                    statusUpdatePayload,
                    {
                        new: true,
                        runValidators: true
                    }
                )
                    .select('_id restaurantId assignedRiderId status statusUpdatedAt')
                    .lean();

                if (!order) {
                    continue;
                }

                try {
                    if (order.assignedRiderId) {
                        emitToUser(
                            order.assignedRiderId,
                            'foodReadyForPickup',
                            {
                                orderId: order._id,
                                restaurantId: order.restaurantId,
                                status: order.status,
                                readyAt: order.statusUpdatedAt
                            }
                        );
                    }
                } catch (socketErr) {
                    console.error(
                        'Food ready socket emission failed:',
                        socketErr.message
                    );
                }

                console.log(
                    `[PREPARATION MONITOR] Order ${order._id} moved to Ready for Pickup after 5 minutes.`
                );
            }
        } catch (error) {
            console.error('[PREPARATION MONITOR ERROR]:', error.message);
        }
    });
};

module.exports = startPreparationMonitor;
