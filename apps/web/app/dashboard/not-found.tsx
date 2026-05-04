import Link from 'next/link';
import { Button, Logo } from '@boost/ui';
import { ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-16">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-xl">
        <Logo wordmark={false} size="lg" className="justify-center" />
        <div className="mt-6 text-6xl font-bold text-slate-900">404</div>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">Page not found.</h1>
        <Link href="/" className="mt-5 inline-block">
          <Button size="lg">
            <ArrowLeft className="h-4 w-4" />
            Back to overview
          </Button>
        </Link>
      </div>
    </main>
  );
}
