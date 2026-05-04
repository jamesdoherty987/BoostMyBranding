import Link from 'next/link';
import { Button, Logo } from '@boost/ui';
import { CheckCircle2 } from 'lucide-react';

export default function PricingSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string; mock?: string }>;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-16">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-2xl">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-cta text-white shadow-brand">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <Logo wordmark size="sm" className="justify-center" />
        <h1 className="mt-4 text-3xl font-bold tracking-tight">You&apos;re in.</h1>
        <p className="mt-3 text-slate-600">
          Thanks for signing up. We&apos;ll email your onboarding checklist within the next business
          hour. Meanwhile, you can head to the client portal and start uploading photos.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href={process.env.NEXT_PUBLIC_PORTAL_URL ?? 'http://localhost:3000/portal'}>
            <Button size="lg" className="w-full">
              Open client portal
            </Button>
          </Link>
          <Link href="/">
            <Button size="lg" variant="outline" className="w-full">
              Back home
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
