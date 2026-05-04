'use client';

import { useEffect } from 'react';
import { Button, Logo } from '@boost/ui';
import { AlertTriangle, RotateCcw } from 'lucide-react';

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[portal] route error:', error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-16 safe-pt safe-pb">
      <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">
        <Logo wordmark={false} size="lg" className="justify-center" />
        <div className="mx-auto mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-500">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-lg font-semibold text-slate-900">Something went wrong.</h1>
        <p className="mt-1 text-sm text-slate-600">We couldn&apos;t load this screen.</p>
        <div className="mt-5 flex flex-col gap-2">
          <Button onClick={reset}>
            <RotateCcw className="h-4 w-4" />
            Try again
          </Button>
          <a href="/portal/dashboard">
            <Button variant="outline" className="w-full">
              Go home
            </Button>
          </a>
        </div>
      </div>
    </main>
  );
}
