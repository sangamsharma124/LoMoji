/**
 * Error Boundary Component
 * Catches React errors and displays fallback UI
 */

import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error to console
    console.error('ErrorBoundary caught error:', error, errorInfo);

    // Update state with error details
    this.setState((prev) => ({
      error,
      errorInfo,
      errorCount: prev.errorCount + 1,
    }));

    // Log to activity tracking service
    if (typeof window !== 'undefined' && window.activityTracker) {
      window.activityTracker.trackError({
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
      });
    }

    // Send to error tracking service (e.g., Sentry)
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    // Call optional reset callback
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI from props
      if (this.props.fallback) {
        return this.props.fallback({
          error: this.state.error,
          errorInfo: this.state.errorInfo,
          resetError: this.handleReset,
        });
      }

      // Default fallback UI
      return (
        <div className="error-boundary-fallback">
          <div className="error-boundary-container">
            <div className="error-boundary-icon">⚠️</div>

            <h1 className="error-boundary-title">
              Oops! Something went wrong
            </h1>

            <p className="error-boundary-message">
              {this.props.friendlyMessage ||
                "We're sorry for the inconvenience. The application encountered an unexpected error."}
            </p>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="error-boundary-details">
                <summary>Error Details (Development Only)</summary>
                <div className="error-boundary-stack">
                  <strong>Error:</strong>
                  <pre>{this.state.error.toString()}</pre>

                  <strong>Stack Trace:</strong>
                  <pre>{this.state.error.stack}</pre>

                  {this.state.errorInfo && (
                    <>
                      <strong>Component Stack:</strong>
                      <pre>{this.state.errorInfo.componentStack}</pre>
                    </>
                  )}
                </div>
              </details>
            )}

            <div className="error-boundary-actions">
              <button
                onClick={this.handleReset}
                className="error-boundary-btn error-boundary-btn-primary"
              >
                Try Again
              </button>

              <button
                onClick={this.handleReload}
                className="error-boundary-btn error-boundary-btn-secondary"
              >
                Reload Page
              </button>

              {this.props.showHomeButton && (
                <button
                  onClick={() => (window.location.href = '/')}
                  className="error-boundary-btn error-boundary-btn-secondary"
                >
                  Go Home
                </button>
              )}
            </div>

            {this.state.errorCount > 1 && (
              <p className="error-boundary-warning">
                ⚠️ This error has occurred {this.state.errorCount} times.
                Consider refreshing the page or checking your internet connection.
              </p>
            )}
          </div>

          <style>{`
            .error-boundary-fallback {
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 2rem;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            }

            .error-boundary-container {
              background: white;
              border-radius: 16px;
              padding: 3rem;
              max-width: 600px;
              width: 100%;
              box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
              text-align: center;
            }

            .error-boundary-icon {
              font-size: 4rem;
              margin-bottom: 1.5rem;
              animation: pulse 2s ease-in-out infinite;
            }

            @keyframes pulse {
              0%, 100% { transform: scale(1); }
              50% { transform: scale(1.1); }
            }

            .error-boundary-title {
              font-size: 2rem;
              font-weight: 700;
              color: #1a1a1a;
              margin-bottom: 1rem;
            }

            .error-boundary-message {
              font-size: 1.125rem;
              color: #666;
              line-height: 1.6;
              margin-bottom: 2rem;
            }

            .error-boundary-details {
              text-align: left;
              background: #f5f5f5;
              border-radius: 8px;
              padding: 1rem;
              margin: 2rem 0;
              max-height: 300px;
              overflow-y: auto;
            }

            .error-boundary-details summary {
              cursor: pointer;
              font-weight: 600;
              color: #d83b01;
              margin-bottom: 1rem;
              user-select: none;
            }

            .error-boundary-stack {
              font-size: 0.875rem;
            }

            .error-boundary-stack strong {
              display: block;
              margin-top: 1rem;
              margin-bottom: 0.5rem;
              color: #1a1a1a;
            }

            .error-boundary-stack pre {
              background: white;
              border: 1px solid #e5e7eb;
              border-radius: 4px;
              padding: 0.75rem;
              overflow-x: auto;
              font-size: 0.75rem;
              line-height: 1.5;
            }

            .error-boundary-actions {
              display: flex;
              gap: 1rem;
              justify-content: center;
              flex-wrap: wrap;
            }

            .error-boundary-btn {
              padding: 0.75rem 2rem;
              border: none;
              border-radius: 8px;
              font-size: 1rem;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.2s;
              min-width: 140px;
            }

            .error-boundary-btn-primary {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
            }

            .error-boundary-btn-primary:hover {
              transform: translateY(-2px);
              box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
            }

            .error-boundary-btn-secondary {
              background: #f5f5f5;
              color: #1a1a1a;
              border: 1px solid #e5e7eb;
            }

            .error-boundary-btn-secondary:hover {
              background: #e5e7eb;
            }

            .error-boundary-warning {
              margin-top: 1.5rem;
              padding: 1rem;
              background: #fef3c7;
              border: 1px solid #f59e0b;
              border-radius: 8px;
              color: #92400e;
              font-size: 0.875rem;
            }

            @media (max-width: 640px) {
              .error-boundary-container {
                padding: 2rem 1.5rem;
              }

              .error-boundary-title {
                font-size: 1.5rem;
              }

              .error-boundary-actions {
                flex-direction: column;
              }

              .error-boundary-btn {
                width: 100%;
              }
            }
          `}</style>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Async Error Boundary for lazy loaded components
 */
export class AsyncErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      isLoading: false,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('AsyncErrorBoundary caught error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, isLoading: true });

    setTimeout(() => {
      this.setState({ isLoading: false });
    }, 1000);
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '2rem',
          textAlign: 'center',
          background: '#f9fafb',
          borderRadius: '8px'
        }}>
          <h3>Failed to load component</h3>
          <button onClick={this.handleRetry}>
            {this.state.isLoading ? 'Loading...' : 'Retry'}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
