import React from 'react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || 'An unexpected error occurred.' };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('DayLock ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="glass-panel max-w-md w-full rounded-3xl p-6 text-slate-900">
            <h1 className="text-xl font-semibold">Something went wrong</h1>
            <p className="mt-2 text-sm text-slate-600">
              Your local trading memory is safe on this device. Reload the app to continue.
            </p>
            <p className="mt-3 rounded-xl bg-slate-900/5 p-3 text-xs font-mono text-slate-700 break-words">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 w-full h-11 rounded-xl bg-[#0a1c2e] text-white text-sm font-semibold hover:bg-[#13304a] transition-colors"
            >
              Reload DayLock
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
