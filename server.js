// 1. Load Environment Variables
require('dotenv').config();

// 2. DNS Bypass & Security Packages
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs'); 
const jwt = require('jsonwebtoken'); 

const app = express();
app.use(express.json()); 
app.use(cors());

// 3. Database Connection
const dbURI = process.env.MONGO_URI;
mongoose.connect(dbURI)
.then(() => console.log("✅ SYSTEM ONLINE: MongoDB Connected"))
.catch(err => console.error("❌ DB ERROR:", err.message));

// ==========================================
// 4. DATABASE SCHEMAS
// ==========================================
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true }, 
    password: { type: String, required: true }, 
    role: { type: String, enum: ['Customer', 'Seller'], default: 'Customer' }
});
const User = mongoose.model('User', userSchema);

const restaurantSchema = new mongoose.Schema({
    name: { type: String, required: true },
    location: { type: String, required: true },
    foodType: { type: String, required: true }
});
const Restaurant = mongoose.model('Restaurant', restaurantSchema);

const menuItemSchema = new mongoose.Schema({
    restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    category: { type: String, enum: ['Veg', 'Non-Veg'], default: 'Veg' },
    description: { type: String }
});
const MenuItem = mongoose.model('MenuItem', menuItemSchema);

const orderSchema = new mongoose.Schema({
    restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
    items: [{
        menuItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' },
        name: String,
        quantity: Number,
        price: Number
    }],
    totalAmount: { type: Number, required: true },
    customerInfo: { name: String, address: String, phone: String },
    status: { type: String, enum: ['Pending', 'Accepted', 'Cooking', 'Out for Delivery', 'Delivered'], default: 'Pending' },
    createdAt: { type: Date, default: Date.now }
});
const Order = mongoose.model('Order', orderSchema);

// ==========================================
// 5. SECURITY BOUNCER (Middleware) 🛡️
// ==========================================
const verifyToken = (req, res, next) => {
    // Check karo ki header mein pass (token) hai ya nahi
    const authHeader = req.header('Authorization');
    if (!authHeader) return res.status(401).json({ message: "Access Denied! VIP Pass (Token) missing." });

    try {
        // "Bearer eyJhb..." se sirf token nikalna
        const token = authHeader.split(" ")[1]; 
        const verified = jwt.verify(token, process.env.JWT_SECRET || 'nepaldelivery_super_secret_key');
        req.user = verified; // User ki detail request mein daal do
        next(); // Sab theek hai, aage jaane do!
    } catch (err) {
        res.status(400).json({ message: "Invalid Token! Pass galat hai." });
    }
};

// ==========================================
// 6. API ROUTES
// ==========================================

// --- SECURITY ROUTES ---
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ message: "Email already exists!" });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({ name, email, password: hashedPassword, role });
        await newUser.save();
        
        console.log(`👤 New ${role} registered: ${name}`);
        res.status(201).json({ message: "Account created successfully!" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: "Account nahi mila! Pehle register karein." });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: "Password galat hai bhai!" });

        const token = jwt.sign(
            { id: user._id, role: user.role }, 
            process.env.JWT_SECRET || 'nepaldelivery_super_secret_key', 
            { expiresIn: '1d' } 
        );

        console.log(`🔑 Login successful for: ${user.name}`);
        res.status(200).json({ message: "Login Successful!", token: token, role: user.role });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- PROTECTED SELLER ROUTES (Bouncer lag gaya yahan) 🛡️ ---

// Dhyan de: URL ke baad 'verifyToken' likha hai
app.post('/api/add-menu-item', verifyToken, async (req, res) => {
    try {
        // Sirf Seller hi menu add kar sakta hai
        if (req.user.role !== 'Seller') return res.status(403).json({ message: "Sirf Sellers menu add kar sakte hain!" });

        const newItem = new MenuItem(req.body);
        await newItem.save();
        res.status(201).json({ message: "Item added securely!", data: newItem });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Update aur Delete par bhi bouncer lagaya hai
app.put('/api/update-item/:id', verifyToken, async (req, res) => {
    try {
        if (req.user.role !== 'Seller') return res.status(403).json({ message: "Access Denied!" });
        const updatedItem = await MenuItem.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.status(200).json(updatedItem);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- PUBLIC ROUTES (Inke liye pass nahi chahiye) ---
app.get('/api/restaurants', async (req, res) => {
    const list = await Restaurant.find();
    res.json(list);
});

// ==========================================
// 7. START SERVER
// ==========================================
const PORT = 5000;
app.listen(PORT, () => console.log(`🚀 Nepal Delivery Engine Running on Port ${PORT}`));