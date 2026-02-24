/**
 * Activity Tracking API Routes
 * Express routes for activity logging and analytics
 */

import express from 'express';
import ActivityLog from '../models/ActivityLog.js';
import { logActivity, activityMiddleware } from '../middleware/activityTracker.js';

const router = express.Router();

/**
 * Authentication middleware (use your existing auth middleware)
 * Replace this with your actual authentication middleware
 */
const authenticate = (req, res, next) => {
  // TODO: Add your authentication logic
  // Example:
  // const token = req.headers.authorization?.split(' ')[1];
  // const decoded = verifyToken(token);
  // req.user = decoded;
  next();
};

/**
 * POST /api/activity/log
 * Log a single activity
 */
router.post('/log', authenticate, async (req, res) => {
  try {
    const { actionType, description, metadata, projectId } = req.body;
    const userId = req.user.id || req.user._id;

    const log = await logActivity({
      userId,
      projectId,
      actionType,
      description,
      metadata,
      req,
    });

    res.status(201).json({
      success: true,
      data: log,
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to log activity',
    });
  }
});

/**
 * POST /api/activity/batch
 * Log multiple activities at once
 */
router.post('/batch', authenticate, async (req, res) => {
  try {
    const { activities } = req.body;
    const userId = req.user.id || req.user._id;

    if (!Array.isArray(activities)) {
      return res.status(400).json({
        success: false,
        error: 'Activities must be an array',
      });
    }

    const logs = await Promise.all(
      activities.map((activity) =>
        logActivity({
          userId,
          projectId: activity.projectId,
          actionType: activity.actionType,
          description: activity.description,
          metadata: activity.metadata,
          req,
          performanceMetrics: activity.performanceMetrics,
        })
      )
    );

    res.status(201).json({
      success: true,
      count: logs.filter(Boolean).length,
      data: logs,
    });
  } catch (error) {
    console.error('Failed to log activities:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to log activities',
    });
  }
});

/**
 * GET /api/activity/my-activities
 * Get current user's activity history
 */
router.get('/my-activities', authenticate, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { limit = 50, page = 1, actionType, startDate, endDate } = req.query;

    const query = { userId };

    // Filter by action type
    if (actionType) {
      query.actionType = actionType;
    }

    // Filter by date range
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const [activities, total] = await Promise.all([
      ActivityLog.find(query)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(skip)
        .populate('projectId', 'name thumbnail')
        .lean(),
      ActivityLog.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: activities,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Failed to fetch activities:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch activities',
    });
  }
});

/**
 * GET /api/activity/stats
 * Get activity statistics for current user
 */
router.get('/stats', authenticate, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { days = 30 } = req.query;

    const stats = await ActivityLog.getUserStats(userId, parseInt(days));

    // Get action type breakdown
    const actionSummary = await ActivityLog.aggregate([
      {
        $match: {
          userId: mongoose.Types.ObjectId(userId),
          createdAt: {
            $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
          },
        },
      },
      {
        $group: {
          _id: '$actionType',
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
    ]);

    // Get total activities
    const totalActivities = await ActivityLog.countDocuments({
      userId,
      createdAt: {
        $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
      },
    });

    res.json({
      success: true,
      data: {
        dailyStats: stats,
        actionSummary,
        totalActivities,
        period: `${days} days`,
      },
    });
  } catch (error) {
    console.error('Failed to fetch stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics',
    });
  }
});

/**
 * GET /api/activity/recent
 * Get recent activities for current user
 */
router.get('/recent', authenticate, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { limit = 20 } = req.query;

    const activities = await ActivityLog.getRecentActivities(
      userId,
      parseInt(limit)
    );

    res.json({
      success: true,
      data: activities,
    });
  } catch (error) {
    console.error('Failed to fetch recent activities:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recent activities',
    });
  }
});

/**
 * GET /api/activity/project/:projectId
 * Get activities for a specific project
 */
router.get('/project/:projectId', authenticate, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { projectId } = req.params;
    const { limit = 50, page = 1 } = req.query;

    const skip = (page - 1) * limit;

    const [activities, total] = await Promise.all([
      ActivityLog.find({ userId, projectId })
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(skip)
        .lean(),
      ActivityLog.countDocuments({ userId, projectId }),
    ]);

    res.json({
      success: true,
      data: activities,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Failed to fetch project activities:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch project activities',
    });
  }
});

/**
 * DELETE /api/activity/clear
 * Clear old activities (keep last 90 days)
 */
router.delete('/clear', authenticate, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { days = 90 } = req.body;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const result = await ActivityLog.deleteMany({
      userId,
      createdAt: { $lt: cutoffDate },
    });

    res.json({
      success: true,
      deletedCount: result.deletedCount,
      message: `Deleted activities older than ${days} days`,
    });
  } catch (error) {
    console.error('Failed to clear activities:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear activities',
    });
  }
});

/**
 * GET /api/activity/export
 * Export activities as CSV or JSON
 */
router.get('/export', authenticate, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { format = 'json', startDate, endDate } = req.query;

    const query = { userId };

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const activities = await ActivityLog.find(query)
      .sort({ createdAt: -1 })
      .populate('projectId', 'name')
      .lean();

    if (format === 'csv') {
      // Convert to CSV
      const csv = convertToCSV(activities);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=activities-${Date.now()}.csv`
      );
      res.send(csv);
    } else {
      // JSON format
      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=activities-${Date.now()}.json`
      );
      res.json(activities);
    }
  } catch (error) {
    console.error('Failed to export activities:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export activities',
    });
  }
});

/**
 * Helper: Convert activities to CSV
 */
function convertToCSV(activities) {
  if (activities.length === 0) return '';

  const headers = [
    'Date',
    'Action Type',
    'Description',
    'Project',
    'Status',
    'IP Address',
    'Device',
  ];

  const rows = activities.map((activity) => [
    new Date(activity.createdAt).toISOString(),
    activity.actionType,
    activity.description || '',
    activity.projectId?.name || '',
    activity.status,
    activity.ipAddress || '',
    activity.deviceInfo?.device || '',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
  ].join('\n');

  return csvContent;
}

export default router;
