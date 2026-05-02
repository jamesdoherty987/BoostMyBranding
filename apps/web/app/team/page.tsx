'use client';

/**
 * Secret team sign-in route. Not linked from the public site — team
 * members reach it by typing /team directly. Sends a magic link to an
 * agency email and redirects the callback to the dashboard.
 *
 * Security: agency role is assigned server-side based on the email
 * domain (`@boostmybranding.com`). A random visitor who guesses this URL
 * and submits their own email won't get agency access — they'll get a
 * client-role user and bounce off dashboard auth checks.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, Input, Logo } from '@boost/ui';
import { api } from '@/lib/api';
import { ArrowRight, CheckCircle2, ExternalLink } from 'lucide-react';

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? 'http://localhost:3002';

export default function TeamLoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await api.sendMagicLink(email.trim(), DASHBOARD_URL);
      setSent(true);
      if (result.devLink) setDevLink(result.devLink);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Link href="/" aria-label="BoostMyBranding home">
            <Logo size="lg" />
          </Link>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          {sent ? (
            <div className="space-y-4 text-center">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Check your inbox</h1>
                <p className="mt-2 text-sm text-slate-600">
                  We sent a sign-in link to <span className="font-semibold">{email}</span>.
                  Click it to access the dashboard.
                </p>
              </div>

              {devLink ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left text-xs text-amber-900">
                  <div className="font-semibold">Dev mode link</div>
                  <p className="mt-1 text-amber-800/80">
                    Resend isn&apos;t configured, so the magic link is shown here.
                  </p>
                  <a
                    href={devLink}
                    className="mt-2 inline-flex items-center gap-1.5 break-all font-mono text-[11px] text-amber-900 underline"
                  >
                    Open link
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                </div>
              ) : null}
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold tracking-tight">Team sign in</h1>
              <p className="mt-2 text-sm text-slate-600">
                Enter your work email and we&apos;ll send you a sign-in link.
              </p>

              <form onSubmit={onSubmit} className="mt-6 space-y-4">
                <div>
                  <label htmlFor="email" className="text-xs font-semibold text-slate-700">
                    Work email
                  </label>
                  <Input
                    id="email"
                    type="email"
                    required
                    autoFocus
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@boostmybranding.com"
                    className="mt-1.5"
                  />
                </div>

                {error ? (
                  <div className="rounded-xl bg-rose-50 p-3 text-xs text-rose-900">{error}</div>
                ) : null}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Sending…' : 'Send sign-in link'}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </form>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Not a team member?{' '}
          <Link href="/" className="font-medium text-slate-700 hover:text-slate-900">
            Go to the main site
          </Link>
        </p>
      </div>
    </main>
  );
}
