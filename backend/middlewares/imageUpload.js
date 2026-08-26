const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const uploadRoot = path.resolve(__dirname, '..', 'uploads');
const stagingRoot = path.join(uploadRoot, '.staging');

const IMAGE_MIME_TO_EXTENSION = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp'
};

const createImageUpload = ({
    fieldName,
    maxFileSize = 5 * 1024 * 1024
}) => {
    if (
        typeof fieldName !== 'string' ||
        !/^[A-Za-z0-9_-]+$/.test(fieldName)
    ) {
        throw new Error('INVALID_UPLOAD_FIELD_NAME');
    }

    const storage = multer.diskStorage({
        destination: (req, file, cb) => {
            try {
                if (!req.uploadStagingDirectory) {
                    req.uploadStagingDirectory = path.join(
                        stagingRoot,
                        uuidv4()
                    );

                    fs.mkdirSync(
                        req.uploadStagingDirectory,
                        { recursive: true }
                    );
                }

                cb(null, req.uploadStagingDirectory);
            } catch (error) {
                cb(error);
            }
        },

        filename: (req, file, cb) => {
            const extension = IMAGE_MIME_TO_EXTENSION[file.mimetype];

            if (!extension) {
                return cb(new Error('UNSUPPORTED_IMAGE_TYPE'));
            }

            cb(null, `${uuidv4()}${extension}`);
        }
    });

    return multer({
        storage,
        limits: {
            fileSize: maxFileSize,
            files: 1
        },
        fileFilter: (req, file, cb) => {
            if (!Object.prototype.hasOwnProperty.call(
                IMAGE_MIME_TO_EXTENSION,
                file.mimetype
            )) {
                return cb(new Error('UNSUPPORTED_IMAGE_TYPE'));
            }

            cb(null, true);
        }
    }).single(fieldName);
};

module.exports = {
    uploadRoot,
    stagingRoot,
    createImageUpload
};
