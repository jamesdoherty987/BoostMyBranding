import Link from 'next/link';
import { Button, Logo } from '@boost/ui';
import { ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-16 safe-pt safe-pb">
      <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">
        <Logo wordmark={false} size="lg" className="justify-center" />
        <div className="mt-5 text-5xl font-bold text-slate-900">404</div>
        <h1 className="mt-2 text-lg font-semibold text-slate-900">Nothing here.</h1>
        <p className="mt-1 text-sm text-slate-600">Head back to your dashboard.</p>
        <Link href="/dashboard" className="mt-5 inline-block">
          <Button size="lg">
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Button>
        </Link>
      </div>
    </main>
  );
}
