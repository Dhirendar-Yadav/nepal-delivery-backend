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

    const normalizeStoredFilename = (value) => {
        if (typeof value !== 'string') return null;

        const normalized = value
            .split('?')[0]
            .replace(/\\/g, '/')
            .trim();

        return normalized.split('/').filter(Boolean).pop() || null;
    };

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
        }).select('userId documents').lean();

        let ownerId = null;
        let managedDocumentPath = null;

        if (rider) {
            ownerId = rider.userId;

            const riderDocumentField = [
                'citizenshipFront',
                'citizenshipBack',
                'licenseFront',
                'bluebookImage',
                'nidDoc'
            ].find((field) => normalizeStoredFilename(rider.documents?.[field]) === filename);

            if (riderDocumentField) {
                managedDocumentPath = path.resolve(
                    uploadDirectory,
                    'riders',
                    rider._id.toString(),
                    riderDocumentField,
                    filename
                );
            }
        } else {
            const restaurant = await Restaurant.findOne({
                $or: [
                    { image: documentValues },
                    { registrationDoc: documentValues }
                ]
            }).select('ownerId image registrationDoc').lean();

            ownerId = restaurant?.ownerId || null;

            if (restaurant) {
                const documentType = normalizeStoredFilename(restaurant.registrationDoc) === filename
                    ? 'registrationDoc'
                    : normalizeStoredFilename(restaurant.image) === filename
                        ? 'image'
                        : null;

                if (documentType) {
                    managedDocumentPath = path.resolve(
                        uploadDirectory,
                        'restaurants',
                        restaurant._id.toString(),
                        documentType,
                        filename
                    );
                }
            }
        }

        if (!ownerId) {
            log.warn({ event: 'KYC_DOCUMENT_ACCESS_DENIED', userId: req.user.id, reason: 'DOCUMENT_NOT_FOUND' });
            return res.status(404).json({ success: false, error: 'DOCUMENT_NOT_FOUND' });
        }

        if (req.user.role !== 'Admin' && ownerId.toString() !== req.user.id) {
            log.warn({ event: 'KYC_DOCUMENT_ACCESS_DENIED', userId: req.user.id, reason: 'UNAUTHORIZED' });
            return res.status(403).json({ success: false, error: 'UNAUTHORIZED_DOCUMENT_ACCESS' });
        }

        const legacyDocumentPath = path.resolve(uploadDirectory, filename);
        const candidatePaths = [
            managedDocumentPath,
            legacyDocumentPath
        ].filter(Boolean);

        let documentPath = null;

        for (const candidatePath of candidatePaths) {
            if (!candidatePath.startsWith(`${uploadDirectory}${path.sep}`)) {
                continue;
            }

            try {
                await fs.promises.access(candidatePath, fs.constants.R_OK);
                documentPath = candidatePath;
                break;
            } catch {
                // Try the next compatible storage location.
            }
        }

        if (!documentPath) {
            log.warn({ event: 'KYC_DOCUMENT_ACCESS_DENIED', userId: req.user.id, reason: 'FILE_NOT_FOUND' });
            return res.status(404).json({ success: false, error: 'DOCUMENT_NOT_FOUND' });
        }

        log.info({
            event: 'KYC_DOCUMENT_ACCESS_GRANTED',
            userId: req.user.id,
            ownerId: ownerId.toString(),
            filename
        });

        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

        return res.sendFile(documentPath, (err) => {
            if (err && !res.headersSent) next(err);
        });
    } catch (err) {
        return next(err);
    }
});

module.exports = router;
