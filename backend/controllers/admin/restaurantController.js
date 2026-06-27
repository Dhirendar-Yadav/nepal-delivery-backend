const mongoose = require('mongoose');
const Restaurant = require('../../models/Restaurant');
const User = require('../../models/User');
const AdminAudit = require('../../models/AdminAudit'); // Schema-backed enterprise auditing model

// Strict State Machine Lifecycle Boundaries
const ALLOWED_STATUSES = ['PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED'];

const STATUS_TRANSITIONS = {
    'PENDING': ['ACTIVE', 'REJECTED'],
    'ACTIVE': ['SUSPENDED', 'REJECTED'],
    'SUSPENDED': ['ACTIVE', 'REJECTED'],
    'REJECTED': [] // Terminal state: Block all manual/accidental reactivations
};

/**
 * Helper to compute valid initial source states before a state transition.
 * Drives the Optimistic Concurrency Control mapping engine directly inside atomic DB mutations.
 */
const getValidSourceStates = (targetStatus) => {
    return Object.keys(STATUS_TRANSITIONS).filter(sourceState => 
        STATUS_TRANSITIONS[sourceState].includes(targetStatus)
    );
};

/**
 * 🛰️ FETCH ALL RESTAURANTS FOR ADMIN
 * High-performance composite engine running pure Cursor Pagination without performance-degrading table counts.
 * Implements strict MongoDB Text Search query capabilities.
 */
exports.getAllRestaurantsForAdmin = async (req, res, next) => {
    try {
        const { status, isDeleted, limit = 50, search, lastId, lastSortValue } = req.query;
        let query = {};
        
        if (status) {
            if (typeof status !== 'string') {
                return res.status(400).json({ success: false, error: "Status parameter query attribute must be a valid string format" });
            }
            const upperStatus = status.toUpperCase();
            if (!ALLOWED_STATUSES.includes(upperStatus)) {
                return res.status(400).json({ success: false, error: "Invalid status filter attribute provided" });
            }
            query.status = upperStatus;
        }
        
        if (isDeleted !== undefined) {
            if (isDeleted !== 'true' && isDeleted !== 'false') {
                return res.status(400).json({ success: false, error: "isDeleted parameter attribute value must be exactly 'true' or 'false'" });
            }
            query.isDeleted = isDeleted === 'true';
        }
        
        // 🚀 ISSUE 4 FIXED: Complete elimination of regex COLLSCAN vectors via native MongoDB Text Index queries
        if (search) {
            if (typeof search !== 'string') {
                return res.status(400).json({ success: false, error: "Search query query parameter value must be a valid string primitive" });
            }
            if (search.length > 100) {
                return res.status(400).json({ success: false, error: "Search query string parameter length limit exceeded max 100 characters" });
            }
            query.$text = { $search: search };
        }

        // High-Availability Composite Cursor Pagination Decoupling Architecture
        if (lastId) {
            if (!mongoose.Types.ObjectId.isValid(lastId)) {
                return res.status(400).json({ success: false, error: "Invalid lastId cursor format signature" });
            }
            
            if (lastSortValue) {
                query.$or = [
                    { createdAt: { $lt: new Date(lastSortValue) } },
                    { createdAt: new Date(lastSortValue), _id: { $lt: new mongoose.Types.ObjectId(lastId) } }
                ];
            } else {
                query._id = { $lt: new mongoose.Types.ObjectId(lastId) };
            }
        }

        const limitValue = Math.min(Math.max(1, parseInt(limit) || 50), 100);
        
        const restaurants = await Restaurant.find(query)
            .select('_id name status ownerId location foodType rating isOpen isDeleted isVerifiedByAdmin createdAt __v')
            .sort({ createdAt: -1, _id: -1 })
            .limit(limitValue)
            .lean();

        const hasNextDataPayload = restaurants.length === limitValue;
        const nextCursorId = hasNextDataPayload ? restaurants[restaurants.length - 1]._id : null;
        const nextCursorSortValue = hasNextDataPayload ? restaurants[restaurants.length - 1].createdAt : null;
        
        return res.status(200).json({ 
            success: true, 
            count: restaurants.length,
            nextCursor: nextCursorId,
            nextSortValue: nextCursorSortValue,
            data: restaurants 
        });
    } catch (error) {
        console.error("Critical error inside getAllRestaurantsForAdmin database read engine:", error);
        return res.status(500).json({ success: false, error: "Internal server error during data retrieval pipeline processing" });
    }
};

/**
 * 🔒 UPDATE RESTAURANT STATUS
 * Core transaction manager implementing high-isolation versioned updates and synchronous ACID schema auditing.
 */
exports.updateRestaurantStatus = async (req, res, next) => {
    const { id } = req.params;
    const { status, isVerifiedByAdmin, version } = req.body; // Expect version tag parameter context inputs from front-ends

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, error: "Invalid Restaurant ID format structure reference" });
    }

    const updateFields = {};
    let targetStatusScope = null;
    
    if (status !== undefined) {
        if (typeof status !== 'string') {
            return res.status(400).json({ success: false, error: "Status mutation parameter attribute must evaluate to a valid string primitive" });
        }
        targetStatusScope = status.toUpperCase();
        if (!ALLOWED_STATUSES.includes(targetStatusScope)) {
            return res.status(400).json({ success: false, error: `Invalid status setup configuration state parameter. Scopes allowed: ${ALLOWED_STATUSES.join(', ')}` });
        }
        updateFields.status = targetStatusScope;
    }

    if (isVerifiedByAdmin !== undefined) {
        if (typeof isVerifiedByAdmin !== 'boolean') {
            return res.status(400).json({ success: false, error: "isVerifiedByAdmin parameters must map to a raw native boolean primitive flag" });
        }
        updateFields.isVerifiedByAdmin = isVerifiedByAdmin;
    }

    if (Object.keys(updateFields).length === 0) {
        return res.status(400).json({ success: false, error: 'No valid structural update parameter metrics supplied' });
    }

    const session = await mongoose.startSession();
    
    try {
        session.startTransaction();

        // 🚀 ISSUE 1 & 7 FIXED: Version-Based Optimistic Locking Enforcement Guard
        // Intercepts serial stale data race conditions entirely, tracking double-click submission states
        let matchQueryCriteria = { _id: id };
        
        if (version !== undefined) {
            const parsedVersion = parseInt(version, 10);
            if (!Number.isNaN(parsedVersion)) {
                matchQueryCriteria.__v = parsedVersion; // Strict lock comparison checkpoint match mapping
            }
        }

        if (targetStatusScope) {
            const validSourceStates = getValidSourceStates(targetStatusScope);
            matchQueryCriteria.status = { $in: validSourceStates };
        }

        // Increments internal version counter atomically on document adjustments
        const updatedRestaurant = await Restaurant.findOneAndUpdate(
            matchQueryCriteria,
            { $set: updateFields, $inc: { __v: 1 } },
            { session, new: true, runValidators: true }
        );

        // Verifies presence of mutation execution context targets
        if (!updatedRestaurant) {
            const errorInstance = new Error('Concurrency Lock Failure: Target record state modified or client data stale. Operation aborted safely.');
            errorInstance.statusCode = 409;
            throw errorInstance;
        }

        // Defensive verification asserting parent model ownership structure continuity
        const ownerAccount = await User.findById(updatedRestaurant.ownerId).session(session);
        if (!ownerAccount) {
            const errorInstance = new Error('Dangling Integrity Refusal: Associated restaurant owner account structure missing or purged');
            errorInstance.statusCode = 412;
            throw errorInstance;
        }

        // Execute conditional schema update states cascades across collections safely
        if (updateFields.status) {
            switch (updateFields.status) {
                case 'ACTIVE':
                    await User.findByIdAndUpdate(updatedRestaurant.ownerId, { $set: { isActive: true, kycStatus: 'VERIFIED' } }, { session, runValidators: true });
                    break;
                case 'SUSPENDED':
                    await User.findByIdAndUpdate(updatedRestaurant.ownerId, { $set: { isActive: false } }, { session, runValidators: true });
                    break;
                case 'REJECTED':
                    await User.findByIdAndUpdate(updatedRestaurant.ownerId, { $set: { isActive: false, kycStatus: 'REJECTED' } }, { session, runValidators: true });
                    break;
                case 'PENDING':
                    await User.findByIdAndUpdate(updatedRestaurant.ownerId, { $set: { kycStatus: 'PENDING' } }, { session, runValidators: true });
                    break;
                default:
                    break;
            }
        }

        const operatorId = req.user?._id || req.admin?._id || "SYSTEM_AUTOMATION_ENGINE";
        const requestIp = req.ip || "UNKNOWN_PROXIED_IP";
        const userAgent = req.headers['user-agent'] || "UNKNOWN_AGENT";

        // 🚀 ISSUE 3 FIXED: Explicit Schema-Backed Transactional Audit Log Mutation Write Layer
        // Automatically rolls back if database connection pipelines or operations cascade loops drop out
        await AdminAudit.create([{
            adminId: operatorId,
            action: 'UPDATE_RESTAURANT_STATUS',
            restaurantId: id,
            mutatedKeys: Object.keys(updateFields), // Protects structural properties masking from logging layers leaks
            ipAddress: requestIp,
            browserAgent: userAgent,
            executionTimestamp: new Date()
        }], { session });

        await session.commitTransaction();
        return res.status(200).json({ success: true, data: updatedRestaurant });
    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        console.error("Administrative update transaction cluster execution aborted and state changes rolled back safely:", error);
        return res.status(error.statusCode || 500).json({ success: false, error: error.message || "Internal server error during modification cascade execution" });
    } finally {
        session.endSession();
    }
};

/**
 * 🛠️ UPDATE OPERATIONAL STATE
 */
exports.updateOperationalState = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { isOpen, isDeleted } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, error: "Invalid Restaurant ID format structure" });
        }

        let updateFields = {};
        
        if (isOpen !== undefined) {
            if (typeof isOpen !== 'boolean') {
                return res.status(400).json({ success: false, error: 'isOpen target parameter parameter field input must evaluate to a strict primitive boolean value' });
            }
            updateFields.isOpen = isOpen;
        }
        
        if (isDeleted !== undefined) {
            if (typeof isDeleted !== 'boolean') {
                return res.status(400).json({ success: false, error: 'isDeleted target parameter parameter field input must evaluate to a strict primitive boolean value' });
            }
            updateFields.isDeleted = isDeleted;
            updateFields.deletedAt = isDeleted ? new Date() : null;
        }

        if (Object.keys(updateFields).length === 0) {
            return res.status(400).json({ success: false, error: 'No valid operational modification parameters specified' });
        }

        const updatedRestaurant = await Restaurant.findOneAndUpdate(
            { _id: id }, 
            { $set: updateFields }, 
            { new: true, runValidators: true }
        );
        
        if (!updatedRestaurant) {
            return res.status(404).json({ success: false, error: 'Restaurant record not located' });
        }
        
        return res.status(200).json({ success: true, data: updatedRestaurant });
    } catch (error) {
        console.error("Error tracked inside updateOperationalState execution block context:", error);
        return res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * 📊 UPDATE RANKING METRICS
 */
exports.updateRankingMetrics = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { avgDeliveryTime, offerTag, commissionRate } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, error: "Invalid Restaurant ID format structure reference" });
        }

        let updateFields = {};
        
        const validateStrictNumber = (value, attributeName) => {
            if (value !== undefined) {
                if (typeof value === 'boolean') {
                    throw new Error(`${attributeName} parameter configuration layer cannot evaluate to a raw boolean value primitive`);
                }
                if (typeof value === 'string' && value.trim() === '') {
                    throw new Error(`${attributeName} input token data sequence cannot evaluate to empty space matrix fields`);
                }
                const parsedValue = Number(value);
                if (!Number.isFinite(parsedValue)) {
                    throw new Error(`${attributeName} attributes parameters configurations must map to finite numeric representations`);
                }
                return parsedValue;
            }
            return undefined;
        };

        const checkedDeliveryTime = validateStrictNumber(avgDeliveryTime, 'avgDeliveryTime');
        if (checkedDeliveryTime !== undefined) {
            if (checkedDeliveryTime < 0) {
                return res.status(400).json({ success: false, error: "Logical Error: avgDeliveryTime metric parameter fields cannot fall below zero metrics boundaries" });
            }
            updateFields.avgDeliveryTime = checkedDeliveryTime;
        }

        const checkedCommissionRate = validateStrictNumber(commissionRate, 'commissionRate');
        if (checkedCommissionRate !== undefined) {
            if (checkedCommissionRate < 0 || checkedCommissionRate > 100) {
                return res.status(400).json({ success: false, error: "Logical Error: commissionRate parameters constraints must reside bounded tightly inside 0 to 100 percentage parameters" });
            }
            updateFields.commissionRate = checkedCommissionRate;
        }

        if (offerTag !== undefined) {
            if (typeof offerTag !== 'string') {
                return res.status(400).json({ success: false, error: "offerTag configuration parameters input must evaluate to a strict primitive string format" });
            }
            updateFields.offerTag = offerTag;
        }

        if (Object.keys(updateFields).length === 0) {
            return res.status(400).json({ success: false, error: 'No valid intentional parameter updates configured inside metrics data execution matrix' });
        }

        const updatedRestaurant = await Restaurant.findOneAndUpdate(
            { _id: id }, 
            { $set: updateFields }, 
            { new: true, runValidators: true }
        );
        
        if (!updatedRestaurant) {
            return res.status(404).json({ success: false, error: 'Restaurant record not located' });
        }
        
        return res.status(200).json({ success: true, data: updatedRestaurant });
    } catch (error) {
        console.error("Error tracked inside updateRankingMetrics execution block context:", error);
        return res.status(400).json({ success: false, error: error.message });
    }
};

/**
 * 🛠️ THE SYSTEM AUTO-HEALER (HIGH-SCALE BATCH STREAMING WORKER)
 * Micro-optimized using Mongoose Streams Cursors to mitigate RAM heap exhaustion entirely.
 * Evaluates across multi-store chains to protect against activation logic discrepancies.
 */
exports.syncLegacyData = async (req, res, next) => {
    try {
        // 🚀 ISSUE 6 FIXED: Pre-fetch owners with alternate problematic status fields to prevent incorrect state assignments
        const restrictedPartners = await Restaurant.find(
            { status: { $in: ['SUSPENDED', 'REJECTED'] } }, 
            'ownerId'
        ).lean();
        
        const restrictedOwnerIdSet = new Set(
            restrictedPartners.map(p => p.ownerId ? p.ownerId.toString() : null).filter(Boolean)
        );

        const restaurantCursor = Restaurant.find({ status: 'ACTIVE' }, 'ownerId').lean().cursor();
        
        let batchOwnerIds = [];
        let totalProcessedAccountsCount = 0;
        const BATCH_PROCESSING_LIMIT_SIZE = 1000;

        const flushBatchProcessStream = async (idsArray) => {
            if (idsArray.length === 0) return 0;
            
            // Deduplicate batch parameters arrays safely
            const uniqueOwnerIds = [...new Set(idsArray)];
            
            // Filters out identity fields possessing restrictions from getting globally verified incorrectly
            const eligibleOwnerIds = uniqueOwnerIds.filter(ownerId => !restrictedOwnerIdSet.has(ownerId));
            
            if (eligibleOwnerIds.length === 0) return 0;

            const results = await User.updateMany(
                {
                    _id: { $in: eligibleOwnerIds },
                    isActive: false,
                    kycStatus: 'PENDING'
                },
                {
                    $set: {
                        isActive: true,
                        kycStatus: 'VERIFIED'
                    }
                }
            );
            return results.modifiedCount;
        };

        for (let restDoc = await restaurantCursor.next(); restDoc != null; restDoc = await restaurantCursor.next()) {
            if (restDoc.ownerId) {
                batchOwnerIds.push(restDoc.ownerId.toString());
            }

            if (batchOwnerIds.length >= BATCH_PROCESSING_LIMIT_SIZE) {
                totalProcessedAccountsCount += await flushBatchProcessStream(batchOwnerIds);
                batchOwnerIds = []; 
            }
        }

        if (batchOwnerIds.length > 0) {
            totalProcessedAccountsCount += await flushBatchProcessStream(batchOwnerIds);
        }

        return res.status(200).json({ 
            success: true, 
            message: `STREAM DATA RESYNC DATA PIPELINE ENGINE LIFECYCLE COMPLETED! 🚀 Memory heap allocation stable. Total old legacy seller records successfully repaired: ${totalProcessedAccountsCount}` 
        });
    } catch (error) {
        console.error("Critical crash tracked inside syncLegacyData background batch processing streaming execution layer:", error);
        return res.status(500).json({ success: false, error: "Internal server error occurred inside background data stream processing engines" });
    }
};