import React, { useState, useEffect } from 'react';
import './ActivityDashboard.css';

const ActivityDashboard = () => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [userEmail, setUserEmail] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    // Get user email from localStorage
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        setUserEmail(user.email);
        loadActivities(user.email);
        loadStats(user.id);
      } catch (e) {
        console.error('Error parsing user:', e);
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  const loadActivities = async (email) => {
    try {
      const response = await fetch(`http://localhost:3001/api/activities/email/${email}?limit=100`);
      const data = await response.json();

      if (response.ok) {
        setActivities(data.activities || []);
      } else {
        console.error('Error loading activities:', data.error);
      }
    } catch (error) {
      console.error('Error loading activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async (userId) => {
    try {
      const response = await fetch(`http://localhost:3001/api/activities/stats/${userId}`);
      const data = await response.json();

      if (response.ok) {
        setStats(data);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;

    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const getActivityIcon = (actionType) => {
    const iconMap = {
      // Project actions
      'project_created': '🆕',
      'project_opened': '📂',
      'project_saved': '💾',
      'project_deleted': '🗑️',
      'project_renamed': '✏️',
      'project_duplicated': '📋',

      // Element actions
      'element_added': '➕',
      'element_deleted': '❌',
      'element_modified': '🔧',
      'element_moved': '↔️',
      'element_resized': '↕️',
      'element_rotated': '🔄',
      'element_duplicated': '📋',

      // Layer actions
      'layer_renamed': '✏️',
      'layer_visibility_toggled': '👁️',
      'layer_locked': '🔒',
      'layer_unlocked': '🔓',
      'layer_reordered': '↕️',

      // Animation actions
      'keyframe_added': '⏱️',
      'keyframe_deleted': '⏱️',
      'keyframe_modified': '⏱️',
      'animation_played': '▶️',
      'animation_paused': '⏸️',
      'animation_preset_applied': '✨',

      // File actions
      'file_uploaded': '📤',
      'image_added': '🖼️',
      'background_removed': '🎭',

      // Drawing actions
      'drawing_started': '✏️',
      'drawing_completed': '✅',
      'path_created': '🖌️',

      // Text actions
      'text_added': '📝',
      'text_edited': '📝',
      'font_changed': '🔤',

      // Timeline actions
      'timeline_zoomed': '🔍',
      'playhead_moved': '⏯️',
      'frame_changed': '🎬',

      // Export actions
      'project_exported': '📦',
      'export_format_selected': '📦',

      // Session actions
      'session_started': '🚀',
      'session_ended': '👋',
      'page_viewed': '👀',

      // Settings actions
      'settings_changed': '⚙️',
      'theme_changed': '🎨',
      'preferences_updated': '⚙️',
    };

    return iconMap[actionType] || '📊';
  };

  const getActivityDescription = (activity) => {
    const { actionType, actionData, projectName } = activity;

    try {
      switch (actionType) {
        // Project actions
        case 'project_created':
          return `Created project "${projectName || 'Untitled'}"`;
        case 'project_opened':
          return `Opened project "${projectName || 'Untitled'}"`;
        case 'project_saved':
          return `Saved project "${projectName || 'Untitled'}" with ${actionData.elementCount || 0} elements`;
        case 'project_deleted':
          return `Deleted project "${projectName || 'Untitled'}"`;
        case 'project_renamed':
          return `Renamed project to "${projectName}"`;

        // Element actions
        case 'element_added':
          return `Added ${actionData.elementType || 'element'} to canvas`;
        case 'element_deleted':
          return `Deleted ${actionData.elementType || 'element'} from canvas`;
        case 'element_modified':
          return `Modified ${actionData.elementType || 'element'}: ${actionData.property || 'property'}`;
        case 'element_moved':
          return `Moved ${actionData.elementType || 'element'}`;
        case 'element_resized':
          return `Resized ${actionData.elementType || 'element'}`;
        case 'element_rotated':
          return `Rotated ${actionData.elementType || 'element'}`;

        // Keyframe actions
        case 'keyframe_added':
          return `Added keyframe for ${actionData.property} at frame ${actionData.frame}`;
        case 'keyframe_deleted':
          return `Deleted keyframe for ${actionData.property} at frame ${actionData.frame}`;
        case 'keyframe_modified':
          return `Modified keyframe at frame ${actionData.frame}`;

        // Animation actions
        case 'animation_played':
          return `Started playback from frame ${actionData.currentFrame || 0}`;
        case 'animation_paused':
          return `Paused playback at frame ${actionData.currentFrame || 0}`;
        case 'animation_preset_applied':
          return `Applied "${actionData.presetName || 'preset'}" animation`;

        // File actions
        case 'file_uploaded':
          return `Uploaded file: ${actionData.fileName || 'file'}`;
        case 'image_added':
          return `Added image to canvas`;
        case 'background_removed':
          return `Removed background from image`;

        // Session actions
        case 'session_started':
          return `Started a new session`;
        case 'session_ended':
          return `Ended session`;
        case 'page_viewed':
          return `Viewed ${actionData.pageName || 'page'}`;

        // Default
        default:
          return actionType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      }
    } catch (error) {
      console.error('Error formatting activity description:', error);
      return actionType;
    }
  };

  const getActivityCategory = (actionType) => {
    if (actionType.startsWith('project_')) return 'project';
    if (actionType.startsWith('element_')) return 'element';
    if (actionType.startsWith('layer_')) return 'layer';
    if (actionType.startsWith('keyframe_')) return 'animation';
    if (actionType.startsWith('animation_')) return 'animation';
    if (actionType.startsWith('file_')) return 'file';
    if (actionType.startsWith('drawing_')) return 'drawing';
    if (actionType.startsWith('text_')) return 'text';
    if (actionType.startsWith('session_')) return 'session';
    return 'other';
  };

  const filteredActivities = filter === 'all'
    ? activities
    : activities.filter(activity => getActivityCategory(activity.actionType) === filter);

  if (loading) {
    return (
      <div className="activity-dashboard">
        <div className="loading">Loading your activity...</div>
      </div>
    );
  }

  if (!userEmail) {
    return (
      <div className="activity-dashboard">
        <div className="no-user">
          <h2>Please login to view your activity</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="activity-dashboard">
      <div className="dashboard-header">
        <h1>Activity Timeline</h1>
        <p>Track all your actions and changes</p>
      </div>

      {stats && (
        <div className="stats-section">
          <div className="stat-card">
            <div className="stat-value">{stats.totalActions || 0}</div>
            <div className="stat-label">Total Actions</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.actionBreakdown?.length || 0}</div>
            <div className="stat-label">Action Types</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{activities.length}</div>
            <div className="stat-label">Recent Actions</div>
          </div>
        </div>
      )}

      <div className="filter-section">
        <button
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All
        </button>
        <button
          className={`filter-btn ${filter === 'project' ? 'active' : ''}`}
          onClick={() => setFilter('project')}
        >
          📁 Projects
        </button>
        <button
          className={`filter-btn ${filter === 'element' ? 'active' : ''}`}
          onClick={() => setFilter('element')}
        >
          🎨 Elements
        </button>
        <button
          className={`filter-btn ${filter === 'animation' ? 'active' : ''}`}
          onClick={() => setFilter('animation')}
        >
          ▶️ Animation
        </button>
        <button
          className={`filter-btn ${filter === 'file' ? 'active' : ''}`}
          onClick={() => setFilter('file')}
        >
          📤 Files
        </button>
        <button
          className={`filter-btn ${filter === 'session' ? 'active' : ''}`}
          onClick={() => setFilter('session')}
        >
          🚀 Sessions
        </button>
      </div>

      <div className="activity-list">
        {filteredActivities.length === 0 ? (
          <div className="empty-state">
            <p>No activities found</p>
            <p className="hint">Start creating animations to see your activity here!</p>
          </div>
        ) : (
          filteredActivities.map((activity, index) => (
            <div key={index} className="activity-item">
              <div className="activity-icon">
                {getActivityIcon(activity.actionType)}
              </div>
              <div className="activity-details">
                <div className="activity-description">
                  {getActivityDescription(activity)}
                </div>
                <div className="activity-meta">
                  <span className="activity-timestamp">
                    {formatTimestamp(activity.timestamp)}
                  </span>
                  {activity.projectName && (
                    <span className="activity-project">
                      in {activity.projectName}
                    </span>
                  )}
                  {activity.browser && (
                    <span className="activity-device">
                      via {activity.browser} on {activity.device}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ActivityDashboard;
