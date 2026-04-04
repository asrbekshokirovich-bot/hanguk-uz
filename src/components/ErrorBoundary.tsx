import React from 'react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Component error:', error, errorInfo);
    
    // Automatically try to unregister service workers on fatal boundary catch
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach(r => r.unregister());
      }).catch(console.error);
    }
  }

  handleTryAgain = () => {
    // Hard clear caches
    if ('caches' in window) {
      caches.keys().then((names) => {
        names.forEach(name => caches.delete(name));
      }).catch(console.error);
    }
    
    // Hard reload from server
    setTimeout(() => {
      window.location.reload();
    }, 100);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex items-center justify-center p-8 text-center min-h-screen break-words">
          <div className="max-w-md">
            <p className="text-lg font-semibold text-destructive mb-2">Something went wrong</p>
            <p className="text-sm text-muted-foreground mb-4 break-words">{this.state.error?.message}</p>
            <button
              onClick={this.handleTryAgain}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm cursor-pointer"
            >
              Clear Cache & Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
