import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  fallback?: (error: Error) => ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    const { error } = this.state;
    if (error) {
      if (this.props.fallback) return this.props.fallback(error);
      return (
        <div className="flex flex-col items-center justify-center h-64 gap-4 text-center px-6">
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 max-w-lg w-full">
            <h3 className="text-sm font-semibold text-red-700 mb-2">Something went wrong</h3>
            <p className="text-xs text-red-600 font-mono break-all">{error.message}</p>
            <button
              onClick={() => this.setState({ error: null })}
              className="mt-4 rounded-md bg-red-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
