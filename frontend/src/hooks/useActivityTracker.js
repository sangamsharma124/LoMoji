import { useCallback, useEffect, useState } from 'react';

/**
 * Custom Hook for Activity Tracking
 * Tracks all user actions in the application
 * Similar to Lottielab's activity tracking
 */

const API_BASE_URL = 'http://localhost:3001';

// Generate a unique session ID (persists across page reloads)
const getOrCreateSessionId = () => {
  let sessionId = sessionStorage.getItem('lomoji_session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    sessionStorage.setItem('lomoji_session_id', sessionId);
  }
  return sessionId;
};

// Get browser info
const getBrowserInfo = () => {
  const ua = navigator.userAgent;
  let browser = 'Unknown';

  if (ua.indexOf('Firefox') > -1) browser = 'Firefox';
  else if (ua.indexOf('Chrome') > -1) browser = 'Chrome';
  else if (ua.indexOf('Safari') > -1) browser = 'Safari';
  else if (ua.indexOf('Edge') > -1) browser = 'Edge';

  return {
    userAgent: ua,
    browser,
    device: /Mobile/.test(ua) ? 'Mobile' : 'Desktop',
    platform: navigator.platform
  };
};

export const useActivityTracker = () => {
  const [userId, setUserId] = useState(null);
  const [userEmail, setUserEmail] = useState(null);
  const [sessionId] = useState(getOrCreateSessionId());
  const [browserInfo] = useState(getBrowserInfo());

  // Get user info from localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        setUserId(user.id);
        setUserEmail(user.email);
      } catch (e) {
        console.error('Error parsing user:', e);
      }
    }
  }, []);

  /**
   * Track an activity
   * @param {string} actionType - Type of action (e.g., 'element_added')
   * @param {object} actionData - Additional data about the action
   * @param {string} projectId - Current project ID (optional)
   * @param {string} projectName - Current project name (optional)
   */
  const trackActivity = useCallback(async (
    actionType,
    actionData = {},
    projectId = null,
    projectName = null
  ) => {
    // Don't track if user is not logged in
    if (!userId || !userEmail) {
      console.warn('Activity tracking skipped: User not logged in');
      return;
    }

    try {
      const activityPayload = {
        userId,
        email: userEmail,
        actionType,
        actionData,
        projectId,
        projectName,
        sessionId,
        timestamp: new Date().toISOString(),
        ...browserInfo
      };

      // Send to backend
      const response = await fetch(`${API_BASE_URL}/api/activities`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(activityPayload)
      });

      if (!response.ok) {
        console.error('Failed to track activity:', await response.text());
      }

      // Optional: Also log to console in development
      if (process.env.NODE_ENV === 'development') {
        console.log('📊 Activity tracked:', actionType, actionData);
      }
    } catch (error) {
      console.error('Error tracking activity:', error);
    }
  }, [userId, userEmail, sessionId, browserInfo]);

  /**
   * Track project actions
   */
  const trackProjectAction = useCallback((action, projectId, projectName, data = {}) => {
    return trackActivity(`project_${action}`, data, projectId, projectName);
  }, [trackActivity]);

  /**
   * Track element actions
   */
  const trackElementAction = useCallback((action, elementData, projectId, projectName) => {
    return trackActivity(`element_${action}`, elementData, projectId, projectName);
  }, [trackActivity]);

  /**
   * Track layer actions
   */
  const trackLayerAction = useCallback((action, layerData, projectId, projectName) => {
    return trackActivity(`layer_${action}`, layerData, projectId, projectName);
  }, [trackActivity]);

  /**
   * Track animation actions
   */
  const trackAnimationAction = useCallback((action, animationData, projectId, projectName) => {
    return trackActivity(`animation_${action}`, animationData, projectId, projectName);
  }, [trackActivity]);

  /**
   * Track keyframe actions
   */
  const trackKeyframeAction = useCallback((action, keyframeData, projectId, projectName) => {
    return trackActivity(`keyframe_${action}`, keyframeData, projectId, projectName);
  }, [trackActivity]);

  /**
   * Track timeline actions
   */
  const trackTimelineAction = useCallback((action, timelineData, projectId, projectName) => {
    return trackActivity(`timeline_${action}`, timelineData, projectId, projectName);
  }, [trackActivity]);

  /**
   * Track file actions
   */
  const trackFileAction = useCallback((action, fileData, projectId, projectName) => {
    return trackActivity(`file_${action}`, fileData, projectId, projectName);
  }, [trackActivity]);

  /**
   * Track session start
   */
  const trackSessionStart = useCallback(() => {
    return trackActivity('session_started', {
      sessionId,
      timestamp: new Date().toISOString()
    });
  }, [trackActivity, sessionId]);

  /**
   * Track session end
   */
  const trackSessionEnd = useCallback(() => {
    return trackActivity('session_ended', {
      sessionId,
      timestamp: new Date().toISOString()
    });
  }, [trackActivity, sessionId]);

  /**
   * Track page view
   */
  const trackPageView = useCallback((pageName, pageUrl) => {
    return trackActivity('page_viewed', {
      pageName,
      pageUrl,
      timestamp: new Date().toISOString()
    });
  }, [trackActivity]);

  return {
    trackActivity,
    trackProjectAction,
    trackElementAction,
    trackLayerAction,
    trackAnimationAction,
    trackKeyframeAction,
    trackTimelineAction,
    trackFileAction,
    trackSessionStart,
    trackSessionEnd,
    trackPageView,
    sessionId,
    userId,
    userEmail
  };
};

export default useActivityTracker;
