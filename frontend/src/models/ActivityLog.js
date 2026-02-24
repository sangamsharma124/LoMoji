/**
 * Activity Log Model - Production-Ready MongoDB Schema
 * Tracks all user activities for analytics and auditing
 */

import mongoose from 'mongoose';

const ActivityLogSchema = new mongoose.Schema(
  {
    // User identification
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Project identification (optional, some actions don't relate to projects)
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CanvasProject',
      index: true,
    },

    // Action type - categorized for easy filtering
    actionType: {
      type: String,
      required: true,
      enum: [
        // Authentication
        'LOGIN',
        'LOGOUT',
        'SIGNUP',
        'PASSWORD_RESET',
        'TOKEN_REFRESH',

        // Project management
        'PROJECT_CREATE',
        'PROJECT_OPEN',
        'PROJECT_SAVE',
        'PROJECT_RENAME',
        'PROJECT_DELETE',
        'PROJECT_EXPORT',
        'PROJECT_DUPLICATE',
        'PROJECT_SHARE',

        // Canvas operations
        'CANVAS_DRAW',
        'CANVAS_ERASE',
        'CANVAS_CLEAR',
        'CANVAS_RESIZE',
        'OBJECT_ADD',
        'OBJECT_DELETE',
        'OBJECT_MOVE',
        'OBJECT_RESIZE',
        'OBJECT_ROTATE',
        'LAYER_ADD',
        'LAYER_DELETE',
        'LAYER_REORDER',

        // Animation operations
        'KEYFRAME_ADD',
        'KEYFRAME_DELETE',
        'KEYFRAME_MOVE',
        'ANIMATION_PLAY',
        'ANIMATION_STOP',
        'TIMELINE_MODIFY',

        // Export/Download
        'EXPORT_PNG',
        'EXPORT_SVG',
        'EXPORT_JSON',
        'EXPORT_GIF',
        'EXPORT_VIDEO',

        // Settings
        'SETTINGS_UPDATE',
        'PROFILE_UPDATE',

        // Other
        'PAGE_VIEW',
        'ERROR',
      ],
      index: true,
    },

    // Action description (human-readable)
    description: {
      type: String,
      maxlength: 500,
    },

    // Metadata - flexible JSON for action-specific data
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Device information
    deviceInfo: {
      userAgent: String,
      browser: String,
      os: String,
      device: String,
      isMobile: Boolean,
      screenResolution: String,
    },

    // Network information
    ipAddress: {
      type: String,
      index: true,
    },

    geolocation: {
      country: String,
      region: String,
      city: String,
      coordinates: {
        lat: Number,
        lng: Number,
      },
    },

    // Session information
    sessionId: {
      type: String,
      index: true,
    },

    // Performance metrics (optional)
    performanceMetrics: {
      duration: Number, // milliseconds
      loadTime: Number,
      renderTime: Number,
    },

    // Error details (if actionType is 'ERROR')
    errorDetails: {
      message: String,
      stack: String,
      code: String,
    },

    // Status
    status: {
      type: String,
      enum: ['SUCCESS', 'FAILED', 'PENDING'],
      default: 'SUCCESS',
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
    collection: 'activity_logs',
  }
);

// Indexes for performance
ActivityLogSchema.index({ userId: 1, createdAt: -1 });
ActivityLogSchema.index({ projectId: 1, createdAt: -1 });
ActivityLogSchema.index({ actionType: 1, createdAt: -1 });
ActivityLogSchema.index({ sessionId: 1 });
ActivityLogSchema.index({ ipAddress: 1 });

// Compound index for common queries
ActivityLogSchema.index({ userId: 1, actionType: 1, createdAt: -1 });

// TTL index - automatically delete logs older than 90 days (optional)
// Uncomment if you want automatic cleanup:
// ActivityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 }); // 90 days

// Virtual for formatted timestamp
ActivityLogSchema.virtual('formattedTime').get(function () {
  return this.createdAt.toLocaleString();
});

// Method to get activity summary
ActivityLogSchema.statics.getActivitySummary = async function (
  userId,
  startDate,
  endDate
) {
  return this.aggregate([
    {
      $match: {
        userId: mongoose.Types.ObjectId(userId),
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        },
      },
    },
    {
      $group: {
        _id: '$actionType',
        count: { $sum: 1 },
        lastAction: { $max: '$createdAt' },
      },
    },
    {
      $sort: { count: -1 },
    },
  ]);
};

// Method to get user statistics
ActivityLogSchema.statics.getUserStats = async function (userId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return this.aggregate([
    {
      $match: {
        userId: mongoose.Types.ObjectId(userId),
        createdAt: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
        },
        totalActions: { $sum: 1 },
        uniqueProjects: { $addToSet: '$projectId' },
      },
    },
    {
      $project: {
        date: '$_id',
        totalActions: 1,
        projectCount: { $size: '$uniqueProjects' },
        _id: 0,
      },
    },
    {
      $sort: { date: 1 },
    },
  ]);
};

// Method to get recent activities
ActivityLogSchema.statics.getRecentActivities = async function (
  userId,
  limit = 20
) {
  return this.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('projectId', 'name thumbnail')
    .lean();
};

// Pre-save hook - add any automated data processing
ActivityLogSchema.pre('save', function (next) {
  // Add any pre-processing here
  next();
});

// Ensure JSON includes virtuals
ActivityLogSchema.set('toJSON', { virtuals: true });
ActivityLogSchema.set('toObject', { virtuals: true });

const ActivityLog =
  mongoose.models.ActivityLog ||
  mongoose.model('ActivityLog', ActivityLogSchema);

export default ActivityLog;
