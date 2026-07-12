// ==========================================
// 1. INITIALIZATION & CORE CONFIG
// ==========================================
require('dotenv').config();
const PORT = process.env.PORT || 5005;
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const crypto = require('crypto'); 
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const helmet = require('helmet'); 
const hpp = require('hpp');
const pino = require('pino');
const path = require('path'); // ✨ ADDED: Path module for image uploads
const paymentWebhookRoutes = require('./routes/paymentWebhookRoutes');

// Models
const Restaurant = require('./models/Restaurant');
const MenuItem = require('./models/MenuItem');
const Order = require('./models/Order');
const RiderProfile = require('./models/RiderProfile');
const AdminWallet = require('./models/AdminWallet');
const LedgerEntry = require('./models/LedgerEntry');
const startShiftMonitor = require('./services/shiftMonitor');
const startDispatchMonitor = require('./services/dispatchMonitor');
const { VALID_TRANSITIONS } = require('./constants/orderConstants');

const app = express();
app.disable('x-powered-by'); 
const server = http.createServer(app);

const requiredEnv = [
    "MONGO_URI",
    "JWT_SECRET",
    "PAYMENT_WEBHOOK_SECRET"
];

const missingEnv = requiredEnv.filter(
    key => !process.env[key]?.trim()
);

if (missingEnv.length) {
    throw new Error(
        `Missing required environment variables: ${missingEnv.join(", ")}`
    );
}
const isProd = process.env.NODE_ENV === 'production';
app.set('trust proxy', 1);

// 📊 CEO Structured Logger (Pino Core)
const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    redact: ['req.headers.authorization', 'req.body.password'],
    transport: !isProd ? { target: 'pino-pretty', options: { colorize: true } } : undefined
});

// ==========================================
// 2. SECURITY & CONTEXT MIDDLEWARES
// ==========================================
// 🛡️ FIX: Security Headers (Adjusted to allow Cross-Origin Images for frontend)
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// 📁 FIX: Expose the uploads folder to the frontend so images don't get blocked
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(
    '/api/payment',
    paymentWebhookRoutes
);
// ✅ Data Parsers
app.use(express.json({ limit: '10kb' })); 
app.use(express.urlencoded({ extended: true, limit: '10kb' })); 

// ✅ Parameter Pollution Guard
app.use(hpp()); 

// 🛡️ FIX: Added localhost:5173 to allow frontend connections
const allowedOrigins = [process.env.FRONTEND_URL, 'http://localhost:3000', 'http://localhost:5173']; 
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin) || !isProd) callback(null, true);
        else callback(new Error('CORS blocked by CEO Firewall.'));
    },
    credentials: true
}));

// 🛡️ Request Context Binding
app.use((req, res, next) => {
    req.requestId = req.header('x-request-id') || uuidv4();
    req.log = logger.child({ requestId: req.requestId }); 
    
    const start = Date.now();
    res.on('finish', () => {
        req.log.info({
            event: 'REQUEST_COMPLETE',
            path: req.originalUrl,
            status: res.statusCode,
            duration: `${Date.now() - start}ms`
        });
    });
    next();
});

// 🛡️ Hardened Auth Middleware
const authMiddleware = (req, res, next) => {
    const authHeader = req.header('Authorization');
    if (!authHeader) return res.status(401).json({ success: false, error: 'AUTH_REQUIRED' });
    try {
        const token = authHeader.split(' ')[1];
        req.user = jwt.verify(token, process.env.JWT_SECRET, {
            algorithms: ['HS256'],
            issuer: 'food-samundar',
            audience: 'user-app'
        });
        next();
    } catch (err) {
        return res.status(403).json({ success: false, error: 'INVALID_TOKEN' });
    }
};

const orderLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 15,
    message: { success: false, error: 'RATE_LIMIT_EXCEEDED' }
});

// ==========================================
// 3. CORE ORDER LOGIC (Apex Grade)
// ==========================================

// 🚀 SECURE ORDER STATUS UPDATE (State Machine Enforcement)
app.patch('/api/admin/orders/:id/status', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'Admin') return res.status(403).json({ success: false, error: 'UNAUTHORIZED_ACCESS' });

        const { id } = req.params;
        const { status: nextStatus } = req.body;

        const order = await Order.findById(id);
        if (!order) return res.status(404).json({ success: false, error: 'ORDER_NOT_FOUND' });

        const currentStatus = order.status;

        // Verify if the transition is allowed by the CEO Guard
        if (!VALID_TRANSITIONS[currentStatus].includes(nextStatus)) {
            return res.status(400).json({ 
                success: false, 
                error: 'INVALID_STATUS_TRANSITION',
                message: `Error: Cannot move from ${currentStatus} to ${nextStatus}. System protocol violation.` 
            });
        }

        order.status = nextStatus;
        await order.save();

        req.log.info({ event: 'ORDER_STATUS_LOCKED', orderId: id, from: currentStatus, to: nextStatus });
        res.status(200).json({ success: true, message: `Status updated to ${nextStatus}` });

    } catch (err) {
        req.log.error({ event: 'STATUS_UPDATE_FAILED', error: err.message });
        res.status(500).json({ success: false, error: 'INTERNAL_SERVER_ERROR' });
    }
});

app.post('/api/orders', authMiddleware, orderLimiter, async (req, res, next) => {
    const MAX_RETRIES = 3;
    // ✨ FIX: Accept deliveryFee and totalAmount strictly from the frontend Checkout
    const { restaurantId, items, deliveryDetails, clientOrderId, deliveryFee, totalAmount } = req.body;

    if (!clientOrderId) return res.status(400).json({ success: false, error: 'IDEMPOTENCY_KEY_REQUIRED' });

    const existingOrder = await Order.findOne({ customerId: req.user.id, clientOrderId }).lean();
    if (existingOrder) {
        return res.json({ success: true, orderId: existingOrder._id, message: "Idempotent replay detected." });
    }

    req.log.info({ event: 'ORDER_CREATE_ATTEMPT', customerId: req.user.id });

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        const session = await mongoose.startSession();
        try {
            session.startTransaction({ readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });

            if (!restaurantId || !Array.isArray(items) || items.length === 0 || !deliveryDetails?.address) {
                throw { status: 400, code: 'INVALID_SCHEMA' };
            }

            const itemMap = new Map();
            for (const i of items) {
                if (!mongoose.Types.ObjectId.isValid(i.menuItemId)) throw { status: 400, code: 'INVALID_ITEM_ID' };
                if (!Number.isInteger(i.quantity) || i.quantity <= 0 || i.quantity > 50) throw { status: 400, code: 'INVALID_QUANTITY' };
                itemMap.set(i.menuItemId, (itemMap.get(i.menuItemId) || 0) + i.quantity);
            }

            const restaurant = await Restaurant.findById(restaurantId).session(session).select('status');
            if (!restaurant || restaurant.status !== 'ACTIVE') throw { status: 400, code: 'RESTAURANT_UNAVAILABLE' };

            const dbItems = await MenuItem.find({ 
                _id: { $in: Array.from(itemMap.keys()) }, 
                restaurantId 
            }).session(session).maxTimeMS(2000);

            if (dbItems.length !== itemMap.size) throw { status: 400, code: 'ITEM_MISMATCH' };

            let computedFoodCost = 0;
            const normalizedItems = dbItems.map(dbItem => {
                const qty = itemMap.get(dbItem._id.toString());
                const itemPriceInteger = Math.round(dbItem.price); // Ensure integer format for strict schema
                computedFoodCost += itemPriceInteger * qty;
                
                // ✨ FIX: Sending price directly inside items array to stop Mongoose crash
                return { 
                    menuItemId: dbItem._id, 
                    name: dbItem.name, 
                    price: itemPriceInteger, 
                    quantity: qty 
                };
            });

            // ✨ FIX: Use frontend values directly and ensure they are integers for safety
            const finalDeliveryFee = deliveryFee ? Math.round(Number(deliveryFee)) : 0;
            const finalTotalAmount = totalAmount ? Number(totalAmount) : computedFoodCost + finalDeliveryFee; 

            const newOrder = new Order({
                customerId: req.user.id, 
                restaurantId, 
                items: normalizedItems,
                totalAmount: finalTotalAmount, // Frontend's Grand Total (Fixed integer)
                foodCost: computedFoodCost, 
                deliveryFee: finalDeliveryFee, // Frontend's Calculated Fee (Fixed integer)
                platformFee: Math.round(computedFoodCost * 0.10),
                deliveryDetails, 
                clientOrderId, 
                status: 'Pending', 
                paymentStatus: 'PENDING'
            });

            await newOrder.save({ session, maxTimeMS: 2000 });
            await session.commitTransaction(); 
            session.endSession();

            // ✨ CEO LIVE ORDER FEATURE: Emit to restaurant's socket room
            try {
                const liveOrderData = await Order.findById(newOrder._id).populate('customerId', 'name phone').lean();
                req.app.get('io').to(restaurantId.toString()).emit('newLiveOrder', liveOrderData);
            } catch (socketErr) {
                req.log.error({ event: 'SOCKET_EMIT_FAILED', error: socketErr.message });
            }

            req.log.info({ event: 'ORDER_CREATED', orderId: newOrder._id });
            return res.status(201).json({ success: true, orderId: newOrder._id });

        } catch (err) {
            await session.abortTransaction();
            session.endSession();
            if (err.hasErrorLabel && err.hasErrorLabel('TransientTransactionError') && attempt < MAX_RETRIES) {
                req.log.warn({ event: 'TRANSACTION_RETRY', attempt });
                continue;
            }
            if (err.code === 11000) {
                const existing = await Order.findOne({ customerId: req.user.id, clientOrderId }).lean();
                return res.json({ success: true, orderId: existing._id, message: "Handled duplicate." });
            }
            return next(err);
        }
    }
});

// ==========================================
// 4. SOCKET ENGINE (DoS Protected)
// ==========================================
const io = new Server(server, { cors: { origin: allowedOrigins } });
app.set('io', io); // ✨ NEW: Expose IO to routes

const riderThrottle = new Map(); 

const gcThrottle = setInterval(() => {
    const now = Date.now();
    for (const [key, value] of riderThrottle.entries()) {
        if (now - value > 60000) riderThrottle.delete(key);
    }
}, 60000);

io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('No token provided'));
    try {
        socket.user = jwt.verify(token, process.env.JWT_SECRET, { issuer: 'food-samundar', audience: 'user-app' });
        socket.joinCount = 0;
        next();
    } catch { next(new Error('Auth failed')); }
});

io.on('connection', (socket) => {
    // 🚀 CEO INJECTION: Automatically join EVERY authenticated user to their own personal room.
    // This makes io.to(rider._id).emit() work instantly without the frontend needing to request a room join!
    if (socket.user && socket.user.id) {
        socket.join(socket.user.id.toString());
        logger.info({ event: 'PRIVATE_ROOM_JOINED', userId: socket.user.id, role: socket.user.role });
    }

    // ✨ NEW: Seller dashboard room join
    socket.on('joinRestaurantDashboard', async (restaurantId) => {
        if (!mongoose.Types.ObjectId.isValid(restaurantId)) return;

        const restaurant = socket.user.role === 'Admin'
            ? await Restaurant.findById(restaurantId).select('_id').lean()
            : socket.user.role === 'Seller'
                ? await Restaurant.findOne({ _id: restaurantId, ownerId: socket.user.id }).select('_id').lean()
                : null;

        if (!restaurant) return;

        socket.join(restaurantId.toString());
        logger.info({ event: 'SELLER_LIVE_DASHBOARD_CONNECTED', restaurantId });
    });

    socket.on('joinOrderTrack', async (orderId) => {
        if (++socket.joinCount > 15 || !mongoose.Types.ObjectId.isValid(orderId)) return;

        const isAdmin = socket.user.role === 'Admin';
        const userId = new mongoose.Types.ObjectId(socket.user.id);
        const order = await Order.findOne({ _id: orderId, ...(isAdmin ? {} : { $or: [{ customerId: userId }, { assignedRiderId: userId }] }) }).select('_id').lean();
        if (order) {
            socket.join(orderId);
            logger.info({ event: 'SOCKET_ROOM_JOINED', userId: socket.user.id, orderId });
        }
    });

    socket.on('updateRiderLocation', async (data) => {
        if (socket.user.role !== 'Rider' || !mongoose.Types.ObjectId.isValid(data.orderId)) return;
        const now = Date.now();
        if (now - (riderThrottle.get(socket.user.id) || 0) < 2000) return;
        riderThrottle.set(socket.user.id, now);

        if (typeof data.lat !== 'number' || typeof data.lng !== 'number' || Math.abs(data.lat) > 90 || Math.abs(data.lng) > 180) return;
        try {
            await Order.updateOne({ _id: data.orderId, assignedRiderId: socket.user.id, status: 'Out for Delivery' }, { $set: { riderLocation: { type: 'Point', coordinates: [data.lng, data.lat] }, lastLocationUpdate: new Date() }});
            io.to(data.orderId).emit('riderMoved', { lat: data.lat, lng: data.lng });
        } catch (err) { logger.error({ event: 'SOCKET_UPDATE_ERROR', error: err.message }); }
    });
});

// ==========================================
// ✅ ROUTES INTEGRATION
// ==========================================
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));

// 🚀 FIX APPLIED HERE: The Rider Routes were entirely missing!
app.use('/api/rider', require('./routes/riderRoutes')); 

// ✨ ADDED: Seller route integration pointing to your existing restaurantRoutes file
app.use('/api/seller', require('./routes/restaurantRoutes')); 

// ✨ Integrated the Zomato-grade Restaurant & Search API (For Customer app)
app.use('/api/restaurants', require('./routes/restaurantRoutes')); 

// ✨ FIX: Routed the customer menu request to the same restaurant routes file
app.use('/api/menu', require('./routes/restaurantRoutes'));

// ?? Payment Gateway Routes
app.use('/api/payment', require('./routes/paymentRoutes'));

// Centralized Error Handler
app.use((err, req, res, next) => {
    const status = err.status || 500;
    const code = err.code || 'INTERNAL_SERVER_ERROR';
    const log = req.log || logger;
    log.error({ event: 'GLOBAL_EXCEPTION', error: err.message, code, stack: !isProd ? err.stack : undefined });
    res.status(status).json({ success: false, error: code, message: isProd ? "Internal Engine Error" : err.message });
});

// Database & Index Sync
mongoose.connect(process.env.MONGO_URI, { maxPoolSize: 50, serverSelectionTimeoutMS: 5000 })
.then(async () => {
    logger.info({ event: 'DB_CONNECTED', detail: 'Apex V17 Ready' });
    if (isProd) {
        await Order.syncIndexes();
        await MenuItem.syncIndexes();
        // ✨ NEW: Enforce syncing of our new High-Performance Geo & Text Indexes
        await Restaurant.syncIndexes();
        await RiderProfile.syncIndexes();
        await AdminWallet.syncIndexes();
        await LedgerEntry.syncIndexes();
    }
    server.listen(PORT, () => {
        startShiftMonitor();
        startDispatchMonitor(io);
        logger.info({ event: 'SERVER_UP', port: PORT });
    });
})
.catch(err => { logger.error({ event: 'DB_CONNECTION_FAILED', error: err.message }); process.exit(1); });

// 🛡️ PERFECTED GRACEFUL SHUTDOWN
const shutdown = async () => {
    logger.info({ event: 'SHUTDOWN_INITIATED' });
    clearInterval(gcThrottle);
    await new Promise(resolve => io.close(resolve)); 
    server.close(async () => {
        await mongoose.connection.close();
        logger.info({ event: 'SHUTDOWN_COMPLETE' });
        process.exit(0);
    });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);



