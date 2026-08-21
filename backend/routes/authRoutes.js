const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer'); // 🛡️ ADDED: For parsing FormData & Images
const path = require('path');
const fs = require('fs');

const User = require('../models/User');
const Restaurant = require('../models/Restaurant');
// NOTE: Make sure you have a Rider model created in models/Rider.js
// If not, you will need to create one to store rider-specific details.
const Rider = require('../models/Rider'); // Added this, assuming you have or will create it
const { authMiddleware } = require('../middlewares/auth');

// ==========================================
// 🛡️ MULTER CONFIGURATION (Handles FormData)
// ==========================================
const uploadRoot = path.resolve(__dirname, '..', 'uploads');
const stagingRoot = path.join(uploadRoot, '.staging');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        try {
            if (!req.uploadStagingDirectory) {
                req.uploadStagingDirectory = path.join(stagingRoot, uuidv4());
                fs.mkdirSync(req.uploadStagingDirectory, { recursive: true });
            }

            cb(null, req.uploadStagingDirectory);
        } catch (err) {
            cb(err);
        }
    },
    filename: function (req, file, cb) {
    const extensionByMimeType = {
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'image/webp': '.webp'
    };

    const extension = extensionByMimeType[file.mimetype];

    if (!extension) {
        return cb(new Error('Unsupported image type.'));
    }

    cb(null, `${uuidv4()}${extension}`);
}
});
// KYC documents are stored as private filenames and served through /api/kyc.

const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5 MB
    },
    fileFilter: (req, file, cb) => {
        const allowedMimeTypes = [
            "image/jpeg",
            "image/png",
            "image/webp"
        ];

        if (!allowedMimeTypes.includes(file.mimetype)) {
            return cb(new Error("Only JPEG, PNG and WEBP images are allowed."));
        }

        cb(null, true);
    }
});

// 🛡️ Elite Brute-Force Protection
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { success: false, message: "Too many login attempts. System locked for 15 minutes." }
});

const DUMMY_HASH = '$2a$12$C6UzMDM.H6dfI/f/IKcEeO6GZ5z6uGq5t1k8Kp1l9z0h9fQp7q9aW';


const moveUploadedFile = async (file, entityType, entityId, documentType) => {
    const destinationDirectory = path.join(
        uploadRoot,
        entityType,
        entityId.toString(),
        documentType
    );

    await fs.promises.mkdir(destinationDirectory, { recursive: true });

    const destinationPath = path.join(destinationDirectory, file.filename);

    await fs.promises.rename(file.path, destinationPath);

    file.finalPath = destinationPath;

    return file.filename;
};

const cleanupUploadedFiles = async (files = []) => {
    for (const file of files) {
        for (const candidate of [file?.path, file?.finalPath]) {
            if (!candidate) continue;

            try {
                await fs.promises.unlink(candidate);
            } catch (err) {
                if (err.code !== 'ENOENT') {
                    // Ignore cleanup failures
                }
            }
        }
    }
};

const cleanupUploadStaging = async (req) => {
    if (!req?.uploadStagingDirectory) return;

    try {
        await fs.promises.rm(req.uploadStagingDirectory, {
            recursive: true,
            force: true
        });
    } catch (_) {
        // Ignore staging cleanup failures after transaction outcome is known
    }
};

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
        phone = String(phone).trim().replace(/^\+977/, "");
        const role = businessName ? 'Seller' : 'Customer';

        const isActive = role === 'Seller' ? false : true;
        const kycStatus = role === 'Seller' ? 'PENDING' : 'VERIFIED';

        const lng = Number(longitude);
const lat = Number(latitude);

const hasValidCoordinates =
    Number.isFinite(lng) &&
    Number.isFinite(lat) &&
    lng >= -180 && lng <= 180 &&
    lat >= -90 && lat <= 90;

const userCoordinates = hasValidCoordinates
    ? [lng, lat]
    : [0, 0];

        session = await mongoose.startSession();
        session.startTransaction();
        const existingUser = await User.findOne({
    $or: [{ email }, { phone }]
}).session(session);

if (existingUser) {
    throw {
        status: 400,
        message: existingUser.email === email
            ? "Email already registered."
            : "Phone number already registered."
    };
}
        const newUser = new User({
            name: fullName,
            email,
            password: password,
            phone,
            role,
            businessName,
            isActive,
            kycStatus,
            currentLocation: { type: 'Point', coordinates: userCoordinates }
        });
        await newUser.save({ session });

        if (role === 'Seller') {
            const imageFile = req.files?.find(file => file.fieldname === 'image');
            const registrationDocFile = req.files?.find(file => file.fieldname === 'registrationDoc');

            if (!imageFile || !registrationDocFile) {
                throw {
                    status: 400,
                    message: 'Restaurant image and registration document are required.'
                };
            }

            const unexpectedFile = req.files?.find(
                file => !['image', 'registrationDoc'].includes(file.fieldname)
            );

            if (unexpectedFile) {
                throw {
                    status: 400,
                    message: 'Unsupported seller upload field.'
                };
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
                image: null,
                registrationDoc: null,
                location: safeLocationString,
                currentLocation: {
                    type: 'Point',
                    coordinates: userCoordinates
                },
                latitude: hasValidCoordinates ? lat : null,
                longitude: hasValidCoordinates ? lng : null,
                panVatNumber: panVatNumber || null
            });

            newRestaurant.image = await moveUploadedFile(
                imageFile,
                'restaurants',
                newRestaurant._id,
                'image'
            );

            newRestaurant.registrationDoc = await moveUploadedFile(
                registrationDocFile,
                'restaurants',
                newRestaurant._id,
                'registrationDoc'
            );

            await newRestaurant.save({ session });
        }

        await session.commitTransaction();
        session.endSession();
        await cleanupUploadStaging(req);

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

        await cleanupUploadedFiles(req.files);
        await cleanupUploadStaging(req);

        if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0];

    return res.status(400).json({
        success: false,
        message: field === 'email'
            ? "Email already registered."
            : field === 'phone'
                ? "Phone number already registered."
                : "Duplicate data."
    });
}

        const status = err.status || 500;
if (req.log) req.log.error({ event: 'USER_SIGNUP_FAILED', error: err.message });

res.status(status).json({
    success: false,
    error: status >= 500 ? 'INTERNAL_SERVER_ERROR' : 'REGISTRATION_FAILED',
    message: status >= 500
        ? 'Unable to complete registration.'
        : 'Registration failed.'
});
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
        phone = String(phone).trim().replace(/^\+977/, "");

        const allowedRiderDocumentFields = new Set([
            'citizenshipFront',
            'citizenshipBack',
            'licenseFront',
            'bluebookImage',
            'nidDoc'
        ]);

        const docs = {};

        for (const file of req.files || []) {
            if (!allowedRiderDocumentFields.has(file.fieldname)) {
                throw {
                    status: 400,
                    message: `Unsupported rider upload field: ${file.fieldname}`
                };
            }
        }

        session = await mongoose.startSession();
        session.startTransaction();

        const existingUser = await User.findOne({
            $or: [{ email: formattedEmail }, { phone }]
        }).session(session);

        if (existingUser) {
            throw {
                status: 400,
                message: existingUser.email === formattedEmail
                    ? "Email already registered."
                    : "Phone number already registered."
            };
        }
// 1. Create Base User Account
        const newUser = new User({
            name: fullName,
            email: formattedEmail,
            password: password,
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
                documents: {}
            });

            for (const file of req.files || []) {
                docs[file.fieldname] = await moveUploadedFile(
                    file,
                    'riders',
                    newRider._id,
                    file.fieldname
                );
            }

            newRider.documents = docs;

            await newRider.save({ session });
        } else {
             console.warn("⚠️ Rider model not imported/created. Rider specific details not saved.");
        }

        await session.commitTransaction();
        session.endSession();
        await cleanupUploadStaging(req);

        if (req.log) req.log.info({ event: 'RIDER_SIGNUP_SUCCESS', userId: newUser._id });

        res.status(201).json({ success: true, message: "Rider application submitted! Please wait for Admin approval." });

    } catch (err) {
        if (session && session.inTransaction()) {
            await session.abortTransaction();
            session.endSession();
        }

        await cleanupUploadedFiles(req.files);
        await cleanupUploadStaging(req);

        // 🚨 FIX 4: Explicitly log the exact MongoDB error to the terminal so we aren't guessing
        console.error("🚨 MONGODB REJECTED RIDER SIGNUP:", err.message);

        if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0];

    return res.status(400).json({
        success: false,
        message: field === 'email'
            ? "Email already registered."
            : field === 'phone'
                ? "Phone number already registered."
                : "Duplicate data."
    });
}

        if (req.log) req.log.error({ event: 'RIDER_SIGNUP_FAILED', error: err.message });

res.status(500).json({
    success: false,
    error: 'INTERNAL_SERVER_ERROR',
    message: 'Registration failed. Please try again.'
});
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

    res.cookie('access_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 24 * 60 * 60 * 1000,
        path: '/'
    });

    res.status(200).json({
    success: true,
    message: "Login successful!",
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
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .select('_id name email phone role isActive isBlocked isDeleted kycStatus');

        if (!user || user.isDeleted || user.isBlocked || !user.isActive) {
            return res.status(401).json({
                success: false,
                error: 'AUTH_REQUIRED',
                message: 'User account is not available.'
            });
        }

        res.json({
            success: true,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                isActive: user.isActive,
                kycStatus: user.kycStatus
            }
        });
    } catch (err) {
        if (req.log) req.log.error({
            event: 'AUTH_SESSION_ERROR',
            error: err.message
        });

        res.status(500).json({
            success: false,
            error: 'INTERNAL_SERVER_ERROR'
        });
    }
});
router.post('/logout', (req, res) => {
    res.clearCookie('access_token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/'
    });

    res.json({
        success: true,
        message: 'Logout successful.'
    });
});
// ==========================================
// ✨ NEW: RIDER ONLINE/OFFLINE TOGGLE
// ==========================================
// Rider calls this when flipping the "Go Online" switch
router.put('/rider/status', loginLimiter, authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'Rider') {
    return res.status(403).json({
        success: false,
        error: "Unauthorized"
    });
}

        const { isOnline } = req.body; // Expecting { isOnline: true/false }

        const user = await User.findByIdAndUpdate(
            req.user.id,
            { isOnline: isOnline, shiftStartTime: isOnline ? new Date() : null },
            { new: true }
        );

        if (!user) return res.status(404).json({ success: false, message: "Rider not found" });

        res.json({ success: true, isOnline: user.isOnline, message: `Rider is now ${user.isOnline ? 'ONLINE' : 'OFFLINE'}` });
    } catch (err) {
    if (req.log) {
        req.log.error({
            event: 'RIDER_STATUS_UPDATE_FAILED',
            error: err.message,
            stack: err.stack
        });
    }

    res.status(500).json({
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Unable to update rider status.'
    });
}
});

module.exports = router;
