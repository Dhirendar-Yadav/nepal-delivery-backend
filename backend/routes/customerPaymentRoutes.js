const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/auth');

router.post('/initiate', authMiddleware, (req, res) => {
    return res.json({
        success: true,
        message: "Customer payment route ready."
    });
});

module.exports = router;
