'use client';

import { useEffect } from 'react';
import { Button, Logo } from '@boost/ui';
import { AlertTriangle, RotateCcw } from 'lucide-react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[dashboard] route error:', error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-16">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-xl">
        <Logo wordmark={false} size="lg" className="justify-center" />
        <div className="mx-auto mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-500">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-xl font-semibold text-slate-900">Something went wrong.</h1>
        <p className="mt-2 text-sm text-slate-600">
          We hit a snag loading this page.
        </p>
        <div className="mt-5 flex items-center justify-center gap-2">
          <Button onClick={reset} variant="outline">
            <RotateCcw className="h-4 w-4" />
            Try again
          </Button>
          <a href="/">
            <Button>Go to overview</Button>
          </a>
        </div>
        {error.digest ? (
          <div className="mt-4 font-mono text-[10px] text-slate-400">{error.digest}</div>
        ) : null}
      </div>
    </main>
  );
}
