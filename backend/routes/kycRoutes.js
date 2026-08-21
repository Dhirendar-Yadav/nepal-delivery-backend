const express = require('express');
const fs = require('fs');
const path = require('path');
const { authMiddleware } = require('../middlewares/auth');
const Rider = require('../models/Rider');
const Restaurant = require('../models/Restaurant');

const router = express.Router();
const uploadDirectory = path.resolve(__dirname, '..', 'uploads');

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

router.get('/documents/:filename', authMiddleware, async (req, res, next) => {
    const { filename } = req.params;
    const log = req.log || console;

    log.info({ event: 'KYC_DOCUMENT_ACCESS_ATTEMPT', userId: req.user.id, filename });

    if (!filename || path.basename(filename) !== filename || !/^[A-Za-z0-9._-]+$/.test(filename)) {
        log.warn({ event: 'KYC_DOCUMENT_ACCESS_DENIED', userId: req.user.id, reason: 'INVALID_FILENAME' });
        return res.status(400).json({ success: false, error: 'INVALID_DOCUMENT_PATH' });
    }

    try {
        const legacyDocumentPattern = new RegExp(`${escapeRegex(`/uploads/${filename}`)}$`);
        const documentValues = { $in: [filename, legacyDocumentPattern] };

        const rider = await Rider.findOne({
            $or: [
                { 'documents.citizenshipFront': documentValues },
                { 'documents.citizenshipBack': documentValues },
                { 'documents.licenseFront': documentValues },
                { 'documents.bluebookImage': documentValues },
                { 'documents.nidDoc': documentValues }
            ]
        }).select('userId').lean();

        const restaurant = rider
    ? null
    : await Restaurant.findOne({
        $or: [
            { image: documentValues },
            { registrationDoc: documentValues }
        ]
    }).select('ownerId').lean();
        const ownerId = rider?.userId || restaurant?.ownerId;

        if (!ownerId) {
            log.warn({ event: 'KYC_DOCUMENT_ACCESS_DENIED', userId: req.user.id, reason: 'DOCUMENT_NOT_FOUND' });
            return res.status(404).json({ success: false, error: 'DOCUMENT_NOT_FOUND' });
        }

        if (req.user.role !== 'Admin' && ownerId.toString() !== req.user.id) {
            log.warn({ event: 'KYC_DOCUMENT_ACCESS_DENIED', userId: req.user.id, reason: 'UNAUTHORIZED' });
            return res.status(403).json({ success: false, error: 'UNAUTHORIZED_DOCUMENT_ACCESS' });
        }

        const documentPath = path.resolve(uploadDirectory, filename);
        if (!documentPath.startsWith(`${uploadDirectory}${path.sep}`)) {
            log.warn({ event: 'KYC_DOCUMENT_ACCESS_DENIED', userId: req.user.id, reason: 'FILE_NOT_FOUND' });
            return res.status(404).json({ success: false, error: 'DOCUMENT_NOT_FOUND' });
        }

        try {
            await fs.promises.access(documentPath, fs.constants.R_OK);
        } catch {
            log.warn({ event: 'KYC_DOCUMENT_ACCESS_DENIED', userId: req.user.id, reason: 'FILE_NOT_FOUND' });
            return res.status(404).json({ success: false, error: 'DOCUMENT_NOT_FOUND' });
        }

        log.info({ event: 'KYC_DOCUMENT_ACCESS_GRANTED', userId: req.user.id, ownerId: ownerId.toString(), filename });
        return res.download(documentPath, filename, (err) => {
            if (err && !res.headersSent) next(err);
        });
    } catch (err) {
        return next(err);
    }
});

module.exports = router;
