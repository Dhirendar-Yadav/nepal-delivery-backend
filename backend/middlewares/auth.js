const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    const authHeader = req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
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
        const token = authHeader.split(' ')[1];

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