const Order = require('../models/Order');
const User = require('../models/User');
const Order = require('../models/Order');

const dispatchService = {
    async triggerAutomatedRiderDispatch(orderId, restaurantLocation, appIoContext) {
        try {
            const existingOrder = await Order.findById(orderId)
    .select("assignedRiderId offeredRiderId status")
    .lean();

if (
    !existingOrder ||
    existingOrder.assignedRiderId ||
    existingOrder.offeredRiderId ||
    existingOrder.status !== "Ready for Pickup"
) {
    return null;
}
            const closestRiders = await User.find({
                role: 'Rider',
                isActive: true,
                isDeleted: false,
                kycStatus: 'VERIFIED',
                isOnline: true,
                $or: [
                    { currentActiveOrderId: null },
                    { currentActiveOrderId: { $exists: false } }
                ],
                currentLocation: {
    $near: {
        $geometry: restaurantLocation,
        $maxDistance: 3000 // 3 KM
    }
}
            })
            .select('_id name phone')
            .limit(10)
            .lean();

            if (closestRiders.length === 0) {
                return null;
            }

            const riderQueueIds = [
    ...new Set(
        closestRiders
            .map(r => r?._id?.toString())
            .filter(id => id && /^[a-f\d]{24}$/i.test(id))
    )
];

if (riderQueueIds.length === 0) {
    console.warn("[DISPATCH] No valid riders remained after queue sanitization.");
    return null;
}
            const firstRiderId = riderQueueIds[0];

            const updatedOrder = await Order.findOneAndUpdate(
                {
                    _id: orderId,
                    offeredRiderId: null,
                    assignedRiderId: null
                },
                {
                    $set: {
    dispatchQueue: riderQueueIds,
    currentDispatchIndex: 0,
    offeredRiderId: firstRiderId,
    offerExpiresAt: new Date(Date.now() + 60 * 1000)
},
$push: {
    dispatchHistory: {
        riderId: firstRiderId,
        action: "OFFERED"
    }
}
                },
                {
                    new: true,
                    runValidators: true
                }
            )
            .populate('customerId', 'name phone')
            .populate('restaurantId', 'name address phone');

            if (updatedOrder && appIoContext) {
                appIoContext
                    .to(firstRiderId)
                    .emit('newOrderOffer', updatedOrder);
            }

            return firstRiderId;
        } catch (error) {
            console.error(`[DISPATCH EXCEPTION] ${error.message}`);
            return null;
        }
    }
};
dispatchService.advanceDispatchQueue = async function (orderId, appIoContext) {
    try {
        const order = await Order.findById(orderId)
            .select('dispatchQueue currentDispatchIndex offeredRiderId assignedRiderId')
            .populate('customerId', 'name phone')
            .populate('restaurantId', 'name address phone');

        if (!order || order.assignedRiderId) {
            return null;
        }

        const payload = Order.buildNextDispatchPayload(
            order.dispatchQueue,
            order.currentDispatchIndex
        );

        const updatedOrder = await Order.findOneAndUpdate(
            {
    _id: orderId,
    status: "Ready for Pickup",
    assignedRiderId: null,
    offeredRiderId: order.offeredRiderId,
    currentDispatchIndex: order.currentDispatchIndex
},
            {
    ...payload,
    $push: {
        dispatchHistory: {
    riderId: order.offeredRiderId,
    action: "EXPIRED",
    createdAt: new Date()
}
    }
},
            {
                new: true,
                runValidators: true
            }
        )
        .populate('customerId', 'name phone')
        .populate('restaurantId', 'name address phone');

        if (!updatedOrder || !updatedOrder.offeredRiderId) {
            return null;
        }

        if (appIoContext) {
            appIoContext
                .to(updatedOrder.offeredRiderId.toString())
                .emit('newOrderOffer', updatedOrder);
        }

        return updatedOrder.offeredRiderId.toString();

    } catch (error) {
        console.error(`[DISPATCH ADVANCE] ${error.message}`);
        return null;
    }
};
module.exports = dispatchService;