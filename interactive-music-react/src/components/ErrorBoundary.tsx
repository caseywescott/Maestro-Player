import React, { Component, ErrorInfo, ReactNode } from "react"

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  resetOnPropsChange?: boolean
  resetKeys?: Array<string | number>
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  errorId: string | null
}

export class ErrorBoundary extends Component<Props, State> {
  private resetTimeoutId: number | null = null

  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error
    console.error("🚨 Error Boundary caught an error:", error)
    console.error("🔍 Error Info:", errorInfo)

    this.setState({
      error,
      errorInfo,
    })

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    // Report error to external service (if available)
    this.reportError(error, errorInfo)
  }

  componentDidUpdate(prevProps: Props) {
    const { resetKeys, resetOnPropsChange } = this.props
    const { hasError } = this.state

    // Reset error boundary when resetKeys change
    if (hasError && resetKeys) {
      const hasResetKeyChanged = resetKeys.some(
        (key, index) => prevProps.resetKeys?.[index] !== key
      )
      if (hasResetKeyChanged) {
        this.resetErrorBoundary()
      }
    }

    // Reset error boundary when any prop changes (if enabled)
    if (
      hasError &&
      resetOnPropsChange &&
      prevProps.children !== this.props.children
    ) {
      this.resetErrorBoundary()
    }
  }

  resetErrorBoundary = () => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId)
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    })
  }

  scheduleReset = (delay: number = 5000) => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId)
    }

    this.resetTimeoutId = window.setTimeout(() => {
      this.resetErrorBoundary()
    }, delay)
  }

  reportError = (error: Error, errorInfo: ErrorInfo) => {
    // In production, you would send this to an error reporting service
    // For now, we'll just log it with additional context
    const errorReport = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      errorId: this.state.errorId,
    }

    console.warn("📊 Error Report:", errorReport)

    // You could send this to services like Sentry, LogRocket, etc.
    // if (window.Sentry) {
    //   window.Sentry.captureException(error, {
    //     contexts: { errorInfo },
    //     tags: { errorBoundary: true }
    //   })
    // }
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI provided
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default fallback UI
      return (
        <div className="error-boundary">
          <div className="error-boundary-content">
            <h2>🚨 Something went wrong</h2>
            <p>An unexpected error occurred in the audio application.</p>

            <div className="error-actions">
              <button
                onClick={this.resetErrorBoundary}
                className="error-button primary"
              >
                🔄 Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="error-button secondary"
              >
                🔃 Reload App
              </button>
            </div>

            <details className="error-details">
              <summary>🔍 Error Details</summary>
              <div className="error-info">
                <p>
                  <strong>Error ID:</strong> {this.state.errorId}
                </p>
                <p>
                  <strong>Message:</strong> {this.state.error?.message}
                </p>
                <pre className="error-stack">{this.state.error?.stack}</pre>
                {this.state.errorInfo && (
                  <div>
                    <p>
                      <strong>Component Stack:</strong>
                    </p>
                    <pre className="error-component-stack">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </div>
                )}
              </div>
            </details>
          </div>

          <style>{`
            .error-boundary {
              padding: 20px;
              margin: 20px;
              border: 2px solid #e74c3c;
              border-radius: 8px;
              background: #fdf2f2;
              font-family: 'Courier New', monospace;
            }

            .error-boundary-content {
              max-width: 600px;
              margin: 0 auto;
              text-align: center;
            }

            .error-boundary h2 {
              color: #e74c3c;
              margin-bottom: 10px;
            }

            .error-boundary p {
              color: #666;
              margin-bottom: 20px;
            }

            .error-actions {
              display: flex;
              gap: 10px;
              justify-content: center;
              margin-bottom: 20px;
            }

            .error-button {
              padding: 10px 20px;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              font-family: monospace;
              font-weight: bold;
              transition: background 0.2s;
            }

            .error-button.primary {
              background: #3498db;
              color: white;
            }

            .error-button.primary:hover {
              background: #2980b9;
            }

            .error-button.secondary {
              background: #95a5a6;
              color: white;
            }

            .error-button.secondary:hover {
              background: #7f8c8d;
            }

            .error-details {
              text-align: left;
              margin-top: 20px;
              border: 1px solid #ddd;
              border-radius: 4px;
              padding: 10px;
              background: white;
            }

            .error-details summary {
              cursor: pointer;
              font-weight: bold;
              padding: 5px;
              background: #f8f9fa;
              border-radius: 4px;
            }

            .error-details summary:hover {
              background: #e9ecef;
            }

            .error-info {
              margin-top: 10px;
              font-size: 12px;
            }

            .error-stack,
            .error-component-stack {
              background: #f8f9fa;
              border: 1px solid #dee2e6;
              border-radius: 4px;
              padding: 10px;
              font-size: 10px;
              overflow-x: auto;
              white-space: pre-wrap;
              max-height: 200px;
              overflow-y: auto;
            }
          `}</style>
        </div>
      )
    }

    return this.props.children
  }
}

// Higher-order component for easier usage
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, "children">
) => {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  )

  WrappedComponent.displayName = `withErrorBoundary(${
    Component.displayName || Component.name
  })`

  return WrappedComponent
}

// Audio-specific error boundary with audio context cleanup
export class AudioErrorBoundary extends ErrorBoundary {
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    super.componentDidCatch(error, errorInfo)

    // Audio-specific error handling
    console.error("🎵 Audio Error Boundary caught an audio-related error")

    // Try to clean up audio context if it exists
    try {
      const audioElements = document.querySelectorAll("audio")
      audioElements.forEach((audio) => {
        audio.pause()
        audio.currentTime = 0
      })

      // Stop Web Audio API contexts
      if (window.AudioContext) {
        // Note: We can't access all contexts, but we can try to stop any global ones
        console.log("🧹 Attempting to clean up audio contexts after error")
      }
    } catch (cleanupError) {
      console.warn("⚠️ Error during audio cleanup:", cleanupError)
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="audio-error-boundary">
          <div className="audio-error-content">
            <h2>🎵 Audio System Error</h2>
            <p>An error occurred in the audio processing system.</p>
            <p>Audio playback has been stopped for safety.</p>

            <div className="error-actions">
              <button
                onClick={() => {
                  this.resetErrorBoundary()
                  // Optionally reload audio system
                  window.location.reload()
                }}
                className="error-button primary"
              >
                🔄 Restart Audio System
              </button>
              <button
                onClick={this.resetErrorBoundary}
                className="error-button secondary"
              >
                ⚠️ Continue Without Audio
              </button>
            </div>

            <details className="error-details">
              <summary>🔍 Technical Details</summary>
              <div className="error-info">
                <p>
                  <strong>Error ID:</strong> {this.state.errorId}
                </p>
                <p>
                  <strong>Audio Error:</strong> {this.state.error?.message}
                </p>
                <p>
                  <strong>Recommendation:</strong> Try refreshing the page or
                  check your audio permissions.
                </p>
                <pre className="error-stack">{this.state.error?.stack}</pre>
              </div>
            </details>
          </div>

          <style>{`
            .audio-error-boundary {
              padding: 20px;
              margin: 20px;
              border: 2px solid #f39c12;
              border-radius: 8px;
              background: #fef9e7;
              font-family: 'Courier New', monospace;
            }

            .audio-error-content {
              max-width: 600px;
              margin: 0 auto;
              text-align: center;
            }

            .audio-error-boundary h2 {
              color: #f39c12;
              margin-bottom: 10px;
            }

            .audio-error-boundary .error-actions {
              display: flex;
              gap: 10px;
              justify-content: center;
              margin: 20px 0;
            }

            .audio-error-boundary .error-button {
              padding: 10px 20px;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              font-family: monospace;
              font-weight: bold;
              transition: background 0.2s;
            }

            .audio-error-boundary .error-button.primary {
              background: #e67e22;
              color: white;
            }

            .audio-error-boundary .error-button.primary:hover {
              background: #d35400;
            }

            .audio-error-boundary .error-button.secondary {
              background: #95a5a6;
              color: white;
            }

            .audio-error-boundary .error-button.secondary:hover {
              background: #7f8c8d;
            }

            .audio-error-boundary .error-details {
              text-align: left;
              margin-top: 20px;
              border: 1px solid #ddd;
              border-radius: 4px;
              padding: 10px;
              background: white;
            }

            .audio-error-boundary .error-details summary {
              cursor: pointer;
              font-weight: bold;
              padding: 5px;
              background: #f8f9fa;
              border-radius: 4px;
            }

            .audio-error-boundary .error-info {
              margin-top: 10px;
              font-size: 12px;
            }

            .audio-error-boundary .error-stack {
              background: #f8f9fa;
              border: 1px solid #dee2e6;
              border-radius: 4px;
              padding: 10px;
              font-size: 10px;
              overflow-x: auto;
              white-space: pre-wrap;
              max-height: 200px;
              overflow-y: auto;
            }
          `}</style>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
