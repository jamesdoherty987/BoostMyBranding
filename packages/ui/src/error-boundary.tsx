'use client';

import { Component, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './button';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches render errors so a single broken component doesn't nuke the page.
 * Next.js also has `error.tsx` segments which we use for route-level errors;
 * this is for inline sections (e.g. a chart that failed to render).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
        <AlertTriangle className="h-6 w-6 text-rose-500" />
        <h3 className="mt-3 text-sm font-semibold text-rose-900">Something broke here.</h3>
        <p className="mt-1 text-xs text-rose-700">{error.message}</p>
        <Button size="sm" variant="outline" className="mt-4" onClick={this.reset}>
          Try again
        </Button>
      </div>
    );
  }
}
