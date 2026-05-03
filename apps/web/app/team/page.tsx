'use client';

/**
 * Team (agency) sign-in. Password-based login with a toggle to create a
 * new team account. Agency role is domain-gated server-side — only emails
 * ending in `@boostmybranding.com` can claim team privileges. A random
 * visitor who reaches this URL and tries to register with a non-agency
 * email gets a polite rejection from the API.
 *
 * Magic link is retained as a "forgot password" fallback.
 */

import { useState } from 'react';
import Link from 'next/link';
import { Button, Input, Logo, toast, Toaster } from '@boost/ui';
import { api } from '@/lib/api';
import { ApiError } from '@boost/api-client';
import { ArrowRight, Lock, User, Mail, Loader2 } from 'lucide-react';

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? 'http://localhost:3002';

type Mode = 'login' | 'register' | 'forgot';

export default function TeamAuthPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      if (mode === 'login') {
        await api.login(email.trim(), password);
        window.location.href = DASHBOARD_URL;
      } else if (mode === 'register') {
        await api.registerTeam({
          email: email.trim(),
          password,
          name: name.trim() || email.split('@')[0]!,
        });
        window.location.href = DASHBOARD_URL;
      } else {
        await api.sendMagicLink(email.trim(), DASHBOARD_URL);
        setForgotSent(true);
      }
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : (err as Error).message ?? 'Something went wrong';
      if (mode === 'register' && /already exists/i.test(msg)) {
        toast.info('You already have an account', 'Switched to sign in.');
        setMode('login');
        setPassword('');
      } else if (mode === 'login' && /invalid email or password/i.test(msg)) {
        toast.error('Wrong email or password', 'Double-check and try again.');
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Toaster />
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Link href="/" aria-label="BoostMyBranding home">
            <Logo size="lg" />
          </Link>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold tracking-tight">
            {mode === 'login'
              ? 'Team sign in'
              : mode === 'register'
                ? 'Create a team account'
                : 'Email me a sign-in link'}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {mode === 'login'
              ? 'Agency dashboard access. Sign in with your work email and password.'
              : mode === 'register'
                ? 'Only @boostmybranding.com emails can make team accounts.'
                : "We'll email you a one-click link to sign back in."}
          </p>

          {forgotSent ? (
            <div className="mt-6 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">
              <p className="font-semibold">Check your inbox</p>
              <p className="mt-1">
                We sent a sign-in link to <span className="font-semibold">{email}</span>.
              </p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              {mode === 'register' ? (
                <Field label="Your name" icon={User}>
                  <Input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Sam Agency"
                    className="pl-9"
                    autoComplete="name"
                  />
                </Field>
              ) : null}

              <Field label="Work email" icon={Mail}>
                <Input
                  type="email"
                  required
                  autoFocus
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@boostmybranding.com"
                  className="pl-9"
                />
              </Field>

              {mode !== 'forgot' ? (
                <Field label="Password" icon={Lock}>
                  <Input
                    type="password"
                    required
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === 'register' ? 'At least 8 characters' : ''}
                    className="pl-9"
                  />
                </Field>
              ) : null}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {mode === 'login'
                  ? loading
                    ? 'Signing in…'
                    : 'Sign in'
                  : mode === 'register'
                    ? loading
                      ? 'Creating account…'
                      : 'Create account'
                    : loading
                      ? 'Sending…'
                      : 'Send sign-in link'}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          )}

          {/* Mode toggle */}
          <div className="mt-6 border-t border-slate-100 pt-4 text-center text-xs text-slate-600">
            {mode === 'login' ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setForgotSent(false);
                  }}
                  className="font-semibold text-slate-900 hover:underline"
                >
                  Create a team account
                </button>
                <span className="mx-2 text-slate-300">·</span>
                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot');
                    setForgotSent(false);
                  }}
                  className="font-semibold text-slate-900 hover:underline"
                >
                  Forgot password?
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setForgotSent(false);
                }}
                className="font-semibold text-slate-900 hover:underline"
              >
                ← Back to sign in
              </button>
            )}
          </div>
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

function Field({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-slate-700">{label}</span>
      <div className="relative mt-1.5">
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        {children}
      </div>
    </label>
  );
}
