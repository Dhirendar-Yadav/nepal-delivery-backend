// 1. Load Environment Variables
require('dotenv').config();

// 2. DNS Bypass for MongoDB Connection
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(express.json()); 
app.use(cors());

// 3. Database Connection
const dbURI = process.env.MONGO_URI;
mongoose.connect(dbURI)
.then(() => console.log("✅ SYSTEM ONLINE: MongoDB Connected"))
.catch(err => console.error("❌ DB ERROR:", err.message));

// ==========================================
// 4. DATABASE SCHEMAS (The Business Logic)
// ==========================================

// A. Restaurant Schema
const restaurantSchema = new mongoose.Schema({
    name: { type: String, required: true },
    location: { type: String, required: true },
    foodType: { type: String, required: true }
});
const Restaurant = mongoose.model('Restaurant', restaurantSchema);

// B. Menu Schema (For Sellers to manage their products)
const menuItemSchema = new mongoose.Schema({
    restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    category: { type: String, enum: ['Veg', 'Non-Veg'], default: 'Veg' },
    description: { type: String }
});
const MenuItem = mongoose.model('MenuItem', menuItemSchema);

// C. Order Schema (The Bridge between Customer & Seller)
const orderSchema = new mongoose.Schema({
    restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
    items: [{
        menuItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' },
        name: String,
        quantity: Number,
        price: Number
    }],
    totalAmount: { type: Number, required: true },
    customerInfo: {
        name: String,
        address: String,
        phone: String
    },
    status: { 
        type: String, 
        enum: ['Pending', 'Accepted', 'Cooking', 'Out for Delivery', 'Delivered'], 
        default: 'Pending' 
    },
    createdAt: { type: Date, default: Date.now }
});
const Order = mongoose.model('Order', orderSchema);

// ==========================================
// 5. API ROUTES
// ==========================================

// --- SELLER ROUTES (Management) ---

// 1. Add Restaurant
app.post('/api/add-restaurant', async (req, res) => {
    try {
        const newRest = new Restaurant(req.body);
        await newRest.save();
        res.status(201).json(newRest);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 2. Seller Adds Menu Items
app.post('/api/add-menu-item', async (req, res) => {
    try {
        const newItem = new MenuItem(req.body);
        await newItem.save();
        res.status(201).json({ message: "Item added to your shop!", data: newItem });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 3. Seller Updates Item (Price change, etc.)
app.put('/api/update-item/:id', async (req, res) => {
    try {
        const updatedItem = await MenuItem.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.status(200).json(updatedItem);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 4. Seller Deletes Item
app.delete('/api/delete-item/:id', async (req, res) => {
    try {
        await MenuItem.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: "Item removed from menu." });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- CUSTOMER & ORDER ROUTES ---

// 5. Customer places an Order
app.post('/api/place-order', async (req, res) => {
    try {
        const newOrder = new Order(req.body);
        await newOrder.save();
        console.log("🔔 New Order Received for Restaurant:", req.body.restaurantId);
        res.status(201).json({ message: "Order placed successfully!", order: newOrder });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 6. Seller checks their Orders
app.get('/api/orders/:restaurantId', async (req, res) => {
    try {
        const orders = await Order.find({ restaurantId: req.params.restaurantId });
        res.status(200).json(orders);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 6. Get All Restaurants (For Customer App)
app.get('/api/restaurants', async (req, res) => {
    const list = await Restaurant.find();
    res.json(list);
});

// ==========================================
// 6. START SERVER
// ==========================================
const PORT = 5000;
app.listen(PORT, () => {
    console.log(`🚀 Nepal Delivery Engine Running on Port ${PORT}`);
});