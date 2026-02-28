/**
 * Client-side Activity Tracker (Frontend only)
 * Safe for use in React components without backend dependencies
 */

export class ClientActivityTracker {
    constructor(apiBaseUrl = '/api') {
        this.apiBaseUrl = apiBaseUrl;
        this.sessionId = this.generateSessionId();
        this.queue = [];
        this.flushInterval = null;
        this.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

        if (typeof window !== 'undefined') {
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
        if (typeof window === 'undefined') return {};
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
        if (typeof localStorage === 'undefined') return;
        try {
            localStorage.setItem('activity_queue', JSON.stringify(this.queue));
        } catch (error) {
            console.error('Failed to save activity queue:', error);
        }
    }

    loadFromLocalStorage() {
        if (typeof localStorage === 'undefined') return;
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
        if (typeof localStorage === 'undefined') return null;
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
    if (typeof window === 'undefined') return null;
    if (!trackerInstance) {
        trackerInstance = new ClientActivityTracker(apiBaseUrl);
        trackerInstance.loadFromLocalStorage();
    }
    return trackerInstance;
}

export default {
    ClientActivityTracker,
    getActivityTracker,
};
