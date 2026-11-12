import React from 'react';
import i18n from '@/lib/i18n';
import { reportClientError } from '@/lib/errorReporter';

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
    // A page that fell over for someone signed in is written down (web_client_errors).
    reportClientError('crash', error, { componentStack: errorInfo.componentStack });

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
            <p className="text-lg font-semibold text-destructive mb-2">{i18n.t('errorScreen.title', 'Nimadir xato ketdi')}</p>
            <p className="text-sm text-muted-foreground mb-4 break-words">{this.state.error?.message}</p>
            <button
              onClick={this.handleTryAgain}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm cursor-pointer"
            >
              {i18n.t('errorScreen.reload', 'Keshni tozalab, qayta yuklash')}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
