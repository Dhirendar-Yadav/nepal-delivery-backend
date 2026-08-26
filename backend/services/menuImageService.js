const fs = require('fs');
const path = require('path');
const { fileTypeFromFile } = require('file-type');

const UPLOAD_ROOT = path.resolve(__dirname, '..', 'uploads');
const ALLOWED_MIME_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp'
]);
const ALLOWED_EXTENSION_PATTERN = /\.(?:jpe?g|png|webp)$/i;

const assertSafeIdentifier = (value, fieldName) => {
    const normalized = String(value ?? '').trim();

    if (!/^[A-Za-z0-9_-]+$/.test(normalized)) {
        throw new Error(`INVALID_${fieldName.toUpperCase()}`);
    }

    return normalized;
};

const sanitizeStoredFilename = (filename) => {
    const normalized = String(filename ?? '').replace(/\\/g, '/');
    const baseName = path.basename(normalized);

    if (
        !baseName ||
        baseName.includes('..') ||
        baseName.includes('/') ||
        baseName.includes('\\') ||
        !/^[A-Za-z0-9._-]+$/.test(baseName) ||
        !ALLOWED_EXTENSION_PATTERN.test(baseName)
    ) {
        throw new Error('INVALID_MENU_IMAGE_FILENAME');
    }

    return baseName;
};

const validateMenuImageFile = async (file) => {
    if (!file?.path) {
        throw new Error('MENU_IMAGE_REQUIRED');
    }

    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
        throw new Error('INVALID_MENU_IMAGE_MIME_TYPE');
    }

    const detectedType = await fileTypeFromFile(file.path);

    if (
        !detectedType ||
        !ALLOWED_MIME_TYPES.has(detectedType.mime) ||
        detectedType.mime !== file.mimetype
    ) {
        throw new Error('INVALID_MENU_IMAGE_CONTENT');
    }

    return detectedType;
};

const buildMenuImageDirectory = (restaurantId, menuItemId) => {
    const safeRestaurantId = assertSafeIdentifier(
        restaurantId,
        'restaurant_id'
    );
    const safeMenuItemId = assertSafeIdentifier(
        menuItemId,
        'menu_item_id'
    );

    return path.resolve(
        UPLOAD_ROOT,
        'restaurants',
        safeRestaurantId,
        'menu',
        safeMenuItemId
    );
};

const buildMenuImagePath = (restaurantId, menuItemId, filename) => {
    const directory = buildMenuImageDirectory(
        restaurantId,
        menuItemId
    );
    const safeFilename = sanitizeStoredFilename(filename);
    const resolvedPath = path.resolve(directory, safeFilename);

    if (!resolvedPath.startsWith(`${directory}${path.sep}`)) {
        throw new Error('INVALID_MENU_IMAGE_PATH');
    }

    return resolvedPath;
};

const storeMenuImage = async (file, restaurantId, menuItemId) => {
    await validateMenuImageFile(file);

    const directory = buildMenuImageDirectory(
        restaurantId,
        menuItemId
    );

    await fs.promises.mkdir(directory, { recursive: true });

    const filename = sanitizeStoredFilename(file.filename);
    const destinationPath = buildMenuImagePath(
        restaurantId,
        menuItemId,
        filename
    );

    await fs.promises.rename(file.path, destinationPath);

    file.finalPath = destinationPath;

    return filename;
};

const deleteMenuImage = async (restaurantId, menuItemId, filename) => {
    if (!filename) {
        return;
    }

    let imagePath;

    try {
        imagePath = buildMenuImagePath(
            restaurantId,
            menuItemId,
            filename
        );
    } catch {
        return;
    }

    try {
        await fs.promises.unlink(imagePath);
    } catch (error) {
        if (error.code !== 'ENOENT') {
            throw error;
        }
    }
};

const cleanupUploadedMenuFiles = async (files = []) => {
    for (const file of files) {
        for (const candidate of [file?.path, file?.finalPath]) {
            if (!candidate) {
                continue;
            }

            try {
                await fs.promises.unlink(candidate);
            } catch (error) {
                if (error.code !== 'ENOENT') {
                    throw error;
                }
            }
        }
    }
};

const resolveMenuImagePath = async (restaurantId, menuItemId, filename) => {
    const imagePath = buildMenuImagePath(
        restaurantId,
        menuItemId,
        filename
    );

    try {
        await fs.promises.access(imagePath, fs.constants.R_OK);
        return imagePath;
    } catch {
        return null;
    }
};

module.exports = {
    UPLOAD_ROOT,
    ALLOWED_MIME_TYPES,
    validateMenuImageFile,
    buildMenuImageDirectory,
    buildMenuImagePath,
    storeMenuImage,
    deleteMenuImage,
    cleanupUploadedMenuFiles,
    resolveMenuImagePath
};
