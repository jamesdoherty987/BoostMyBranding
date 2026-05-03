'use client';

/**
 * Portal login. Password-first; magic link as a "forgot password" fallback.
 * A signed-in user is redirected straight to /dashboard, so this page is
 * only reached by logged-out visitors.
 */

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button, Input, Logo, AuroraBg, Toaster, toast, Spinner } from '@boost/ui';
import { ArrowRight, Mail, Lock, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';
import { ApiError } from '@boost/api-client';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? 'http://localhost:3002';

type Mode = 'login' | 'forgot';

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!/.+@.+\..+/.test(email.trim())) {
      toast.error('Check your email', "That doesn't look quite right.");
      return;
    }
    setLoading(true);
    try {
      if (mode === 'login') {
        await api.login(email.trim(), password);
        window.location.href = '/dashboard';
      } else {
        const redirectTo =
          typeof window !== 'undefined' ? `${window.location.origin}/dashboard` : undefined;
        const res = await api.sendMagicLink(email.trim(), redirectTo);
        setSent(true);
        if (res.devLink) setDevLink(res.devLink);
        toast.success('Check your inbox', 'Magic link sent');
      }
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : (err as Error).message ?? 'Something went wrong';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <AuroraBg />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-8 shadow-xl"
      >
        <Logo size="md" />
        <h1 className="mt-6 text-2xl font-bold text-slate-900">
          {mode === 'login' ? 'Welcome back' : 'Email me a sign-in link'}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {mode === 'login'
            ? 'Sign in to your BoostMyBranding portal.'
            : "We'll email you a one-click link to sign back in."}
        </p>

        {sent ? (
          <div className="mt-6 space-y-3">
            <div className="flex items-start gap-3 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                Check your inbox for a sign-in link. It expires in 15 minutes.
              </div>
            </div>
            {devLink ? (
              <a
                href={devLink}
                className="block rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-center text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                Dev link, click to continue
              </a>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setSent(false);
                setMode('login');
              }}
              className="block w-full text-center text-xs font-semibold text-slate-700 hover:underline"
            >
              ← Back to sign in
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-3">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                type="email"
                required
                autoComplete="email"
                placeholder="you@business.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-9"
              />
            </div>

            {mode === 'login' ? (
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9"
                />
              </div>
            ) : null}

            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? <Spinner /> : null}
              {mode === 'login' ? 'Sign in' : 'Send magic link'}
              <ArrowRight className="h-4 w-4" />
            </Button>

            {mode === 'login' ? (
              <button
                type="button"
                onClick={() => setMode('forgot')}
                className="block w-full text-center text-[11px] font-medium text-slate-500 hover:text-slate-700 hover:underline"
              >
                Forgot password?
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setMode('login')}
                className="block w-full text-center text-[11px] font-medium text-slate-500 hover:text-slate-700 hover:underline"
              >
                ← Back to sign in
              </button>
            )}
          </form>
        )}

        <div className="mt-6 border-t border-slate-100 pt-4 text-center">
          <p className="text-xs text-slate-600">
            New here?{' '}
            <a
              href={`${APP_URL}/signup`}
              className="font-semibold text-[#1D9CA1] hover:underline"
            >
              Create an account
            </a>
          </p>
        </div>

        <div className="mt-4 text-center text-xs text-slate-500">
          Team member?{' '}
          <Link href={DASHBOARD_URL} className="font-medium text-slate-700 underline">
            Dashboard login
          </Link>
        </div>
      </motion.div>
      <Toaster />
    </main>
  );
}
