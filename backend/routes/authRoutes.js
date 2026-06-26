const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit'); 
const { v4: uuidv4 } = require('uuid'); 
const multer = require('multer'); // 🛡️ ADDED: For parsing FormData & Images
const path = require('path');

const User = require('../models/User');
const Restaurant = require('../models/Restaurant');
// NOTE: Make sure you have a Rider model created in models/Rider.js
// If not, you will need to create one to store rider-specific details.
const Rider = require('../models/Rider'); // Added this, assuming you have or will create it

// ==========================================
// 🛡️ MULTER CONFIGURATION (Handles FormData)
// ==========================================
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/'); // Ensure an 'uploads' folder exists in your backend root
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// 🛡️ Elite Brute-Force Protection
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 10, 
    message: { success: false, message: "Too many login attempts. System locked for 15 minutes." }
});

const DUMMY_HASH = '$2a$12$C6UzMDM.H6dfI/f/IKcEeO6GZ5z6uGq5t1k8Kp1l9z0h9fQp7q9aW';

// ==========================================
// 1. ✨ CUSTOMER / SELLER SIGNUP (Fraud-Proof)
// ==========================================
router.post('/signup', upload.any(), async (req, res) => {
    let session;
    try {
        let { fullName, email, password, phone, businessName, latitude, longitude, location, panVatNumber } = req.body;

        if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw { status: 400, message: "Valid email is required." };
        if (!phone || !/^\d{10,15}$/.test(phone)) throw { status: 400, message: "Valid phone number (10-15 digits) is required." };
        
        if (!password || password.length < 8) throw { status: 400, message: "Password must be at least 8 characters long." };
        if (!fullName) throw { status: 400, message: "Full name is required." };
        
        email = email.toLowerCase().trim();

        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(password, salt);
        const role = businessName ? 'Seller' : 'Customer';

        const isActive = role === 'Seller' ? false : true;
        const kycStatus = role === 'Seller' ? 'PENDING' : 'VERIFIED';

        const userCoordinates = (longitude && latitude) ? [parseFloat(longitude), parseFloat(latitude)] : [0, 0];

        session = await mongoose.startSession();
        session.startTransaction();

        const newUser = new User({ 
            name: fullName, 
            email, 
            password: hashedPassword, 
            phone, 
            role, 
            businessName,
            isActive, 
            kycStatus, 
            currentLocation: { type: 'Point', coordinates: userCoordinates } 
        });
        await newUser.save({ session });

        if (role === 'Seller') {
            let imagePath = null;
            if (req.files && req.files.length > 0) {
                // Taking the first uploaded image as the profile photo
                imagePath = `http://localhost:5005/uploads/${req.files[0].filename}`;
            }

            let safeLocationString = 'Nepal';
            if (typeof location === 'string') {
                safeLocationString = location;
            } else if (req.body.address && typeof req.body.address === 'string') {
                safeLocationString = req.body.address;
            } else {
                safeLocationString = 'Auto-Pinned Location';
            }

            const newRestaurant = new Restaurant({ 
                ownerId: newUser._id, 
                name: businessName, 
                image: imagePath, 
                location: safeLocationString, 
                currentLocation: {
                    type: 'Point',
                    coordinates: userCoordinates
                },
                latitude: parseFloat(latitude) || null, 
                longitude: parseFloat(longitude) || null, 
                panVatNumber: panVatNumber || null 
            });
            await newRestaurant.save({ session });
        }
        
        await session.commitTransaction();
        session.endSession();
        
        if (req.log) req.log.info({ event: 'USER_SIGNUP_SUCCESS', userId: newUser._id, role });
        
        if (role === 'Seller') {
            return res.status(201).json({ success: true, message: "Seller account created! Please wait for Admin approval." });
        }
        res.status(201).json({ success: true, message: "Account created successfully!" });

    } catch (err) { 
        if (session && session.inTransaction()) {
            await session.abortTransaction();
            session.endSession();
        }

        if (err.code === 11000) {
            return res.status(400).json({ success: false, message: "Email or Phone already registered!" });
        }
        
        const status = err.status || 500;
        if (req.log) req.log.error({ event: 'USER_SIGNUP_FAILED', error: err.message });
        res.status(status).json({ success: false, error: err.message }); 
    }
});

// ==========================================
// 1.5 ✨ NEW: RIDER SIGNUP (Handles Images & KYC)
// ==========================================
// Using upload.any() because the frontend sends multiple distinct files (citizenshipFront, licenseFront, etc.)
router.post('/rider/signup', upload.any(), async (req, res) => {
    let session;
    try {
        // 🛡️ FIX 1: Changed const to let because we need to modify phone if it's an array
        let { fullName, email, password, phone, licenseNumber, citizenshipNo, bikeNumber } = req.body;

        // 🛡️ FIX 2: If FormData appends phone twice, it becomes an array. Extract the last one (+977...)
        if (Array.isArray(phone)) {
            phone = phone[phone.length - 1]; 
        }

        // Basic Validation
        if (!email || !password || !fullName || !phone) {
            return res.status(400).json({ success: false, message: "All basic fields are required." });
        }
        
        const formattedEmail = email.toLowerCase().trim();

        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Map uploaded files to URLs
        const docs = {};
        if (req.files && req.files.length > 0) {
            req.files.forEach(file => {
                // file.fieldname matches what you appended in frontend: 'citizenshipFront', 'licenseFront', etc.
                docs[file.fieldname] = `http://localhost:5005/uploads/${file.filename}`;
            });
        }

        session = await mongoose.startSession();
        session.startTransaction();

        // 1. Create Base User Account
        const newUser = new User({ 
            name: fullName, 
            email: formattedEmail, 
            password: hashedPassword, 
            phone, 
            role: 'Rider', 
            isActive: false, // Riders need admin approval
            kycStatus: 'PENDING',
            // 🛡️ FIX 3: Added currentLocation to prevent MongoDB validation crashes for Rider accounts
            currentLocation: { type: 'Point', coordinates: [0, 0] } 
        });
        await newUser.save({ session });

        // 2. Create Rider Specific Profile
        // Ensure you have a Rider.js model with these fields!
        if(Rider) {
             const newRider = new Rider({
                userId: newUser._id,
                licenseNumber,
                citizenshipNo,
                bikeNumber,
                documents: docs // Stores all the image URLs
            });
            await newRider.save({ session });
        } else {
             console.warn("⚠️ Rider model not imported/created. Rider specific details not saved.");
        }

        await session.commitTransaction();
        session.endSession();

        if (req.log) req.log.info({ event: 'RIDER_SIGNUP_SUCCESS', userId: newUser._id });
        
        res.status(201).json({ success: true, message: "Rider application submitted! Please wait for Admin approval." });

    } catch (err) {
        if (session && session.inTransaction()) {
            await session.abortTransaction();
            session.endSession();
        }

        // 🚨 FIX 4: Explicitly log the exact MongoDB error to the terminal so we aren't guessing
        console.error("🚨 MONGODB REJECTED RIDER SIGNUP:", err.message);

        if (err.code === 11000) {
            return res.status(400).json({ success: false, message: "Email or Phone already registered!" });
        }

        if (req.log) req.log.error({ event: 'RIDER_SIGNUP_FAILED', error: err.message });
        // 🛡️ FIX 5: Send the actual error message back to the frontend alert
        res.status(500).json({ success: false, message: `Registration Failed: ${err.message}` });
    }
});

// ==========================================
// 2. ✨ SECURE LOGIN LOGIC (Anti-Timing Attack Grade)
// ==========================================
router.post('/login', loginLimiter, async (req, res) => {
    try {
        let { email, password } = req.body;
        
        if (!email || !password) return res.status(400).json({ success: false, message: "Email and password required." });
        email = email.toLowerCase().trim();

        const user = await User.findOne({ email }).select('+password +isActive +isBlocked +kycStatus +role +name +phone');
        
        const passwordToCheck = user ? user.password : DUMMY_HASH;
        const isMatch = await bcrypt.compare(password, passwordToCheck);

        await new Promise(resolve => setTimeout(resolve, Math.random() * 50));

        if (!user || !isMatch) {
            if (req.log) req.log.warn({ event: 'LOGIN_FAILED', reason: 'INVALID_CREDENTIALS', email });
            return res.status(400).json({ success: false, message: "Invalid credentials!" }); 
        }

        if (!user.isActive || user.isBlocked) {
            if (req.log) req.log.warn({ event: 'LOGIN_FAILED', reason: 'ACCOUNT_DISABLED', userId: user._id });
            return res.status(403).json({ success: false, message: "Account is disabled or pending Admin approval." });
        }

        if (!process.env.JWT_SECRET) {
            throw new Error("CRITICAL: JWT_SECRET is missing from environment variables.");
        }

        const token = jwt.sign(
            { id: user._id, role: user.role, name: user.name }, 
            process.env.JWT_SECRET, 
            { 
                expiresIn: '1d',
                issuer: 'food-samundar', 
                audience: 'user-app',
                jwtid: uuidv4() 
            }
        );

        if (req.log) req.log.info({ event: 'USER_LOGIN_SUCCESS', userId: user._id, role: user.role });

        res.status(200).json({ 
            success: true,
            message: "Login successful!",
            token, 
            user: {
                id: user._id,
                name: user.name, 
                role: user.role, 
                phone: user.phone
            }
        });
    } catch (err) { 
        if (req.log) req.log.error({ event: 'LOGIN_SYSTEM_ERROR', error: err.message });
        res.status(500).json({ success: false, error: "Internal Server Error" }); 
    }
});

// ==========================================
// ✨ NEW: RIDER ONLINE/OFFLINE TOGGLE
// ==========================================
// Rider calls this when flipping the "Go Online" switch
router.put('/rider/status', loginLimiter, async (req, res) => {
    try {
        const authHeader = req.header('Authorization');
        if (!authHeader) return res.status(401).json({ success: false, error: "Unauthorized" });

        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        const { isOnline } = req.body; // Expecting { isOnline: true/false }

        const user = await User.findByIdAndUpdate(
            decoded.id, 
            { isOnline: isOnline, shiftStartTime: isOnline ? new Date() : null }, 
            { new: true }
        );

        if (!user) return res.status(404).json({ success: false, message: "Rider not found" });

        res.json({ success: true, isOnline: user.isOnline, message: `Rider is now ${user.isOnline ? 'ONLINE' : 'OFFLINE'}` });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;