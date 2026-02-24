/**
 * Activity Tracking Middleware
 * Automatically logs user activities to MongoDB
 */

import ActivityLog from '../models/ActivityLog.js';
import UAParser from 'ua-parser-js'; // npm install ua-parser-js

/**
 * Extract device information from user agent
 */
function getDeviceInfo(userAgent) {
  const parser = new UAParser(userAgent);
  const result = parser.getResult();

  return {
    userAgent,
    browser: `${result.browser.name} ${result.browser.version}`,
    os: `${result.os.name} ${result.os.version}`,
    device: result.device.type || 'desktop',
    isMobile: result.device.type === 'mobile' || result.device.type === 'tablet',
    screenResolution: typeof window !== 'undefined'
      ? `${window.screen.width}x${window.screen.height}`
      : 'unknown',
  };
}

/**
 * Extract IP address from request
 */
function getClientIP(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0] ||
    req.headers['x-real-ip'] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

/**
 * Main activity logging function
 */
export async function logActivity({
  userId,
  projectId = null,
  actionType,
  description = '',
  metadata = {},
  req = null,
  status = 'SUCCESS',
  errorDetails = null,
  performanceMetrics = null,
}) {
  try {
    const activityData = {
      userId,
      projectId,
      actionType,
      description,
      metadata,
      status,
    };

    // Add request information if available
    if (req) {
      activityData.deviceInfo = getDeviceInfo(req.headers['user-agent'] || '');
      activityData.ipAddress = getClientIP(req);
      activityData.sessionId = req.session?.id || req.headers['x-session-id'];
    }

    // Add error details if present
    if (errorDetails) {
      activityData.errorDetails = errorDetails;
    }

    // Add performance metrics if present
    if (performanceMetrics) {
      activityData.performanceMetrics = performanceMetrics;
    }

    // Create activity log
    const log = await ActivityLog.create(activityData);
    return log;
  } catch (error) {
    // Don't throw errors from activity logging - log silently
    console.error('Failed to log activity:', error);
    return null;
  }
}

/**
 * Express middleware for automatic activity logging
 * Add this to routes that need activity tracking
 */
export function activityMiddleware(actionType, options = {}) {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id || req.user?._id;

      if (!userId) {
        // Skip logging if no user
        return next();
      }

      // Extract project ID from request (if applicable)
      const projectId = req.params.projectId || req.body.projectId || null;

      // Log the activity
      await logActivity({
        userId,
        projectId,
        actionType,
        description: options.description || `User performed ${actionType}`,
        metadata: {
          path: req.path,
          method: req.method,
          query: req.query,
          ...options.metadata,
        },
        req,
      });

      next();
    } catch (error) {
      // Don't block the request on logging errors
      console.error('Activity middleware error:', error);
      next();
    }
  };
}

/**
 * Error tracking middleware
 * Logs errors that occur in the application
 */
export function errorTrackingMiddleware(err, req, res, next) {
  const userId = req.user?.id || req.user?._id;

  if (userId) {
    logActivity({
      userId,
      actionType: 'ERROR',
      description: err.message,
      status: 'FAILED',
      errorDetails: {
        message: err.message,
        stack: err.stack,
        code: err.code || err.statusCode,
      },
      metadata: {
        path: req.path,
        method: req.method,
        query: req.query,
      },
      req,
    }).catch(console.error);
  }

  next(err);
}

/**
 * Client-side activity tracker
 * Use this in React components
 */
export class ClientActivityTracker {
  constructor(apiBaseUrl = '/api') {
    this.apiBaseUrl = apiBaseUrl;
    this.sessionId = this.generateSessionId();
    this.queue = [];
    this.flushInterval = null;
    this.isOnline = navigator.onLine;

    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.flush();
    });
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });

    // Start auto-flush
    this.startAutoFlush();
  }

  generateSessionId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  async track(actionType, data = {}) {
    const activity = {
      actionType,
      description: data.description || '',
      metadata: data.metadata || {},
      projectId: data.projectId || null,
      sessionId: this.sessionId,
      deviceInfo: this.getDeviceInfo(),
      timestamp: new Date().toISOString(),
      performanceMetrics: data.performanceMetrics || null,
    };

    // Add to queue
    this.queue.push(activity);

    // Save to localStorage as backup
    this.saveToLocalStorage();

    // Try to flush if online
    if (this.isOnline && this.queue.length >= 5) {
      await this.flush();
    }

    return activity;
  }

  getDeviceInfo() {
    return {
      userAgent: navigator.userAgent,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
    };
  }

  async flush() {
    if (this.queue.length === 0 || !this.isOnline) return;

    const activities = [...this.queue];
    this.queue = [];

    try {
      const response = await fetch(`${this.apiBaseUrl}/activity/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getToken()}`,
        },
        body: JSON.stringify({ activities }),
      });

      if (response.ok) {
        // Clear localStorage backup
        localStorage.removeItem('activity_queue');
      } else {
        // Put back in queue if failed
        this.queue = [...activities, ...this.queue];
        this.saveToLocalStorage();
      }
    } catch (error) {
      console.error('Failed to flush activities:', error);
      // Put back in queue
      this.queue = [...activities, ...this.queue];
      this.saveToLocalStorage();
    }
  }

  saveToLocalStorage() {
    try {
      localStorage.setItem('activity_queue', JSON.stringify(this.queue));
    } catch (error) {
      console.error('Failed to save activity queue:', error);
    }
  }

  loadFromLocalStorage() {
    try {
      const saved = localStorage.getItem('activity_queue');
      if (saved) {
        this.queue = JSON.parse(saved);
      }
    } catch (error) {
      console.error('Failed to load activity queue:', error);
    }
  }

  startAutoFlush() {
    // Flush every 30 seconds
    this.flushInterval = setInterval(() => {
      this.flush();
    }, 30000);

    // Flush on page unload
    window.addEventListener('beforeunload', () => {
      this.flush();
    });
  }

  stopAutoFlush() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
  }

  getToken() {
    return localStorage.getItem('token') || sessionStorage.getItem('token');
  }

  // Convenience methods for common actions
  trackLogin() {
    return this.track('LOGIN', {
      description: 'User logged in',
    });
  }

  trackLogout() {
    return this.track('LOGOUT', {
      description: 'User logged out',
    });
  }

  trackProjectOpen(projectId) {
    return this.track('PROJECT_OPEN', {
      projectId,
      description: 'Opened project',
    });
  }

  trackProjectSave(projectId, metadata = {}) {
    return this.track('PROJECT_SAVE', {
      projectId,
      description: 'Saved project',
      metadata,
    });
  }

  trackExport(projectId, format) {
    return this.track(`EXPORT_${format.toUpperCase()}`, {
      projectId,
      description: `Exported project as ${format}`,
      metadata: { format },
    });
  }

  trackPageView(page) {
    return this.track('PAGE_VIEW', {
      description: `Viewed ${page}`,
      metadata: { page, url: window.location.href },
    });
  }

  trackError(error) {
    return this.track('ERROR', {
      description: error.message,
      metadata: {
        stack: error.stack,
        url: window.location.href,
      },
    });
  }

  trackPerformance(metric, value) {
    return this.track('PERFORMANCE_METRIC', {
      description: `Performance: ${metric}`,
      performanceMetrics: {
        [metric]: value,
        timestamp: Date.now(),
      },
    });
  }
}

// Singleton instance
let trackerInstance = null;

export function getActivityTracker(apiBaseUrl) {
  if (!trackerInstance) {
    trackerInstance = new ClientActivityTracker(apiBaseUrl);
    trackerInstance.loadFromLocalStorage();
  }
  return trackerInstance;
}

export default {
  logActivity,
  activityMiddleware,
  errorTrackingMiddleware,
  ClientActivityTracker,
  getActivityTracker,
};
