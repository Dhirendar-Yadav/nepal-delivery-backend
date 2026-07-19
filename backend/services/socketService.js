let ioInstance = null;

/**
 * Initialize Socket.IO instance
 */
function initializeSocket(io) {
    ioInstance = io;
}

/**
 * Get Socket.IO instance
 */
function getIO() {
    if (!ioInstance) {
        throw new Error("Socket.IO has not been initialized.");
    }
    return ioInstance;
}

/**
 * Emit to a specific user
 */
function emitToUser(userId, event, payload) {
    if (!ioInstance || !userId) return;
    ioInstance.to(userId.toString()).emit(event, payload);
}

/**
 * Emit to a specific order room
 */
function emitToOrder(orderId, event, payload) {
    if (!ioInstance || !orderId) return;
    ioInstance.to(orderId.toString()).emit(event, payload);
}

/**
 * Emit to a restaurant dashboard
 */
function emitToRestaurant(restaurantId, event, payload) {
    if (!ioInstance || !restaurantId) return;
    ioInstance.to(restaurantId.toString()).emit(event, payload);
}

/**
 * Broadcast
 */
function broadcast(event, payload) {
    if (!ioInstance) return;
    ioInstance.emit(event, payload);
}

module.exports = {
    initializeSocket,
    getIO,
    emitToUser,
    emitToOrder,
    emitToRestaurant,
    broadcast
};