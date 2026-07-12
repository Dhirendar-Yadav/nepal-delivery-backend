const mongoose = require('mongoose');

const adminAuditSchema = new mongoose.Schema(
    {
        admin: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },

        action: {
            type: String,
            required: true,
            trim: true,
            uppercase: true,
            index: true
        },

        entityType: {
            type: String,
            required: true,
            trim: true,
            index: true
        },

        entityId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            index: true
        },

        oldData: {
            type: mongoose.Schema.Types.Mixed,
            default: null
        },

        newData: {
            type: mongoose.Schema.Types.Mixed,
            default: null
        },

        reason: {
            type: String,
            trim: true,
            maxlength: 500,
            default: null
        },

        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        },

        ipAddress: {
            type: String,
            trim: true,
            maxlength: 45,
            default: null
        },

        userAgent: {
            type: String,
            trim: true,
            maxlength: 1024,
            default: null
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

// =============================
// INDEXES
// =============================

adminAuditSchema.index({ admin: 1, createdAt: -1 });

adminAuditSchema.index({ entityType: 1, entityId: 1 });

adminAuditSchema.index({ action: 1, createdAt: -1 });

module.exports = mongoose.model('AdminAudit', adminAuditSchema);
