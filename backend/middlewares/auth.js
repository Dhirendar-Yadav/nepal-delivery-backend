const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
const authHeader = req.header('Authorization');
const bearerToken = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : null;
const cookieToken = req.cookies?.access_token;
const token = bearerToken || cookieToken;

if (!token) {
    return res.status(401).json({
        success: false,
        error: 'AUTH_REQUIRED',
        message: 'Authentication required.'
    });
}

if (!process.env.JWT_SECRET) {
        console.error('FATAL: JWT_SECRET missing.');
        return res.status(500).json({
            success: false,
            error: 'SERVER_CONFIGURATION_ERROR'
        });
    }

    try {
    req.user = jwt.verify(token, process.env.JWT_SECRET, {
        algorithms: ['HS256'],
        issuer: 'food-samundar',
        audience: 'user-app'
    });

    next();
} catch (err) {
        return res.status(401).json({
            success: false,
            error: 'INVALID_TOKEN',
            message: 'Invalid or expired token.'
        });
    }
};

module.exports = { authMiddleware };
