import mongoose from 'mongoose';

/**
 * Comprehensive User Activity Tracking Schema
 * Tracks every action a user takes in the application
 * Similar to Lottielab's activity tracking system
 */

const userActionActivitySchema = new mongoose.Schema({
  // User identification
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
    index: true
  },
  email: {
    type: String,
    required: true,
    index: true
  },

  // Activity details
  actionType: {
    type: String,
    required: true,
    enum: [
      // Project actions
      'project_created',
      'project_opened',
      'project_saved',
      'project_deleted',
      'project_renamed',
      'project_duplicated',

      // Canvas actions
      'element_added',
      'element_deleted',
      'element_modified',
      'element_moved',
      'element_resized',
      'element_rotated',
      'element_duplicated',

      // Layer actions
      'layer_renamed',
      'layer_visibility_toggled',
      'layer_locked',
      'layer_unlocked',
      'layer_reordered',

      // Animation actions
      'keyframe_added',
      'keyframe_deleted',
      'keyframe_modified',
      'animation_played',
      'animation_paused',
      'animation_preset_applied',

      // File actions
      'file_uploaded',
      'image_added',
      'background_removed',

      // Drawing actions
      'drawing_started',
      'drawing_completed',
      'path_created',

      // Text actions
      'text_added',
      'text_edited',
      'font_changed',

      // Timeline actions
      'timeline_zoomed',
      'playhead_moved',
      'frame_changed',

      // Export actions
      'project_exported',
      'export_format_selected',

      // Session actions
      'session_started',
      'session_ended',
      'page_viewed',

      // Settings actions
      'settings_changed',
      'theme_changed',
      'preferences_updated',

      // Collaboration actions (future)
      'project_shared',
      'comment_added',
      'feedback_given'
    ]
  },

  // Activity metadata
  actionData: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
    // Examples:
    // - element_added: { elementType: 'rectangle', elementId: '...', position: {x, y} }
    // - project_saved: { projectId: '...', projectName: '...', elementCount: 5 }
    // - keyframe_added: { objectId: '...', property: 'x', frame: 30, value: 100 }
  },

  // Project context
  projectId: {
    type: String,
    index: true
  },
  projectName: {
    type: String
  },

  // Session context
  sessionId: {
    type: String,
    index: true
  },

  // Technical details
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },

  // Browser/Device info
  userAgent: { type: String },
  browser: { type: String },
  device: { type: String },
  platform: { type: String },

  // Location (optional)
  ipAddress: { type: String },
  location: {
    country: String,
    city: String
  },

  // Performance metrics (optional)
  duration: { type: Number }, // How long the action took in ms

  // Undo/Redo tracking
  undoable: { type: Boolean, default: true },
  undone: { type: Boolean, default: false },

  // Grouping related actions
  batchId: { type: String }, // For grouping multiple actions together
});

// Compound indexes for efficient queries
userActionActivitySchema.index({ userId: 1, timestamp: -1 });
userActionActivitySchema.index({ email: 1, timestamp: -1 });
userActionActivitySchema.index({ projectId: 1, timestamp: -1 });
userActionActivitySchema.index({ sessionId: 1, timestamp: -1 });
userActionActivitySchema.index({ actionType: 1, timestamp: -1 });

// Methods
userActionActivitySchema.methods.toSummary = function() {
  return {
    action: this.actionType,
    data: this.actionData,
    timestamp: this.timestamp,
    project: this.projectName
  };
};

// Static methods
userActionActivitySchema.statics.logActivity = async function(activityData) {
  try {
    const activity = new this(activityData);
    await activity.save();
    return activity;
  } catch (error) {
    console.error('Error logging activity:', error);
    throw error;
  }
};

userActionActivitySchema.statics.getUserTimeline = async function(userId, limit = 50) {
  return this.find({ userId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();
};

userActionActivitySchema.statics.getProjectTimeline = async function(projectId, limit = 100) {
  return this.find({ projectId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();
};

userActionActivitySchema.statics.getSessionActivities = async function(sessionId) {
  return this.find({ sessionId })
    .sort({ timestamp: 1 })
    .lean();
};

const UserActionActivity = mongoose.model('UserActionActivity', userActionActivitySchema);

export default UserActionActivity;
