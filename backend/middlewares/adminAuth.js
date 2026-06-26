const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

// 🛡️ CEO Rate Limiting Strategy
const statsLimiter = rateLimit({ windowMs: 60 * 1000, max: 60 }); 
const orderLimiter = rateLimit({ windowMs: 60 * 1000, max: 100 }); 
const criticalLimiter = rateLimit({ windowMs: 60 * 1000, max: 30 }); 

// 🛡️ CEO Security Middleware (Unified Auth Supported)
const verifyAdmin = (req, res, next) => {
    const authHeader = req.header('Authorization');
    if (!authHeader) return res.status(401).json({ success: false, message: "CEO Access Denied!" });
    
    if (!process.env.JWT_SECRET) {
        console.error("FATAL ERROR: JWT_SECRET is not defined!");
        return res.status(500).json({ success: false, message: "Internal Security Error." });
    }

    try {
        const token = authHeader.split(" ")[1];
        // 🛡️ Audience check removed to support Unified Auth
        const verified = jwt.verify(token, process.env.JWT_SECRET, { 
            algorithms: ['HS256'],
            issuer: 'food-samundar'
        });
        
        if (verified.role !== 'Admin') {
            return res.status(403).json({ success: false, message: "Restricted to CEO level!" });
        }
        req.user = verified;
        next();
    } catch (err) { 
        res.status(403).json({ success: false, message: "Invalid/Expired CEO Token!" }); 
    }
};

module.exports = { verifyAdmin, statsLimiter, orderLimiter, criticalLimiter };