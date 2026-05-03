'use client';

/**
 * Client signup. Email + password + business details. No tier selection,
 * no payment collected — they land in the portal with
 * `subscription_status: 'none'` and pick a plan from /subscription when
 * they're ready.
 *
 * Keeping this flow as short as possible: three fields is the minimum we
 * need to create a usable workspace (business name, contact name, email)
 * plus a password.
 */

import { useState } from 'react';
import Link from 'next/link';
import { Button, Input, Logo, toast, Toaster } from '@boost/ui';
import { api } from '@/lib/api';
import { ApiError } from '@boost/api-client';
import { ArrowRight, Building2, User, Mail, Lock, Loader2 } from 'lucide-react';

const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL ?? 'http://localhost:3001';

type Mode = 'signup' | 'login' | 'forgot';

export default function SignupPage() {
  const [mode, setMode] = useState<Mode>('signup');
  const [form, setForm] = useState({
    email: '',
    password: '',
    businessName: '',
    contactName: '',
    industry: '',
  });
  const [loading, setLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const update = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      if (mode === 'signup') {
        await api.register({
          email: form.email.trim(),
          password: form.password,
          businessName: form.businessName.trim(),
          contactName: form.contactName.trim(),
          industry: form.industry.trim() || undefined,
        });
        toast.success('Account created', 'Welcome. Let us get you set up.');
        window.location.href = `${PORTAL_URL}/dashboard`;
      } else if (mode === 'login') {
        await api.login(form.email.trim(), form.password);
        window.location.href = `${PORTAL_URL}/dashboard`;
      } else {
        await api.sendMagicLink(form.email.trim(), `${PORTAL_URL}/dashboard`);
        setForgotSent(true);
      }
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : (err as Error).message ?? 'Something went wrong';
      // If the account already exists, steer them to the sign-in tab in
      // the same flow rather than showing a dead-end error toast.
      if (mode === 'signup' && /already exists/i.test(msg)) {
        toast.info(
          'You already have an account',
          'Switched to sign in — enter your password.',
        );
        setMode('login');
        setForm((f) => ({ ...f, password: '' }));
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
    <main className="min-h-screen bg-slate-50">
      <Toaster />
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link href="/" aria-label="Home">
            <Logo size="md" />
          </Link>
          <Link href="/" className="text-sm text-slate-600 hover:text-slate-900">
            Back to home
          </Link>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-md px-4 py-10 md:py-16">
        <div className="w-full rounded-3xl border border-slate-200 bg-white p-6 shadow-xl md:p-8">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            {mode === 'signup'
              ? 'Create your account'
              : mode === 'login'
                ? 'Welcome back'
                : 'Email me a sign-in link'}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {mode === 'signup'
              ? 'No credit card needed. Pick a plan once you’re set up.'
              : mode === 'login'
                ? 'Sign in to your BoostMyBranding portal.'
                : "We'll email you a one-click link."}
          </p>

          {forgotSent ? (
            <div className="mt-6 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">
              <p className="font-semibold">Check your inbox</p>
              <p className="mt-1">
                We sent a sign-in link to <span className="font-semibold">{form.email}</span>.
              </p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="mt-6 space-y-3.5">
              {mode === 'signup' ? (
                <>
                  <Field label="Business name" icon={Building2}>
                    <Input
                      type="text"
                      required
                      value={form.businessName}
                      onChange={(e) => update({ businessName: e.target.value })}
                      placeholder="Verde Cafe"
                      className="pl-9 no-zoom"
                      autoComplete="organization"
                    />
                  </Field>
                  <Field label="Your name" icon={User}>
                    <Input
                      type="text"
                      required
                      value={form.contactName}
                      onChange={(e) => update({ contactName: e.target.value })}
                      placeholder="Luca Romano"
                      className="pl-9 no-zoom"
                      autoComplete="name"
                    />
                  </Field>
                </>
              ) : null}

              <Field label="Email" icon={Mail}>
                <Input
                  type="email"
                  required
                  autoFocus={mode !== 'signup'}
                  value={form.email}
                  onChange={(e) => update({ email: e.target.value })}
                  placeholder="you@business.com"
                  className="pl-9 no-zoom"
                  autoComplete="email"
                />
              </Field>

              {mode !== 'forgot' ? (
                <Field label="Password" icon={Lock}>
                  <Input
                    type="password"
                    required
                    minLength={mode === 'signup' ? 8 : 1}
                    value={form.password}
                    onChange={(e) => update({ password: e.target.value })}
                    placeholder={mode === 'signup' ? 'At least 8 characters' : ''}
                    className="pl-9 no-zoom"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  />
                </Field>
              ) : null}

              {mode === 'signup' ? (
                <Field label="Industry (optional)" icon={Building2}>
                  <Input
                    type="text"
                    value={form.industry}
                    onChange={(e) => update({ industry: e.target.value })}
                    placeholder="Food & Beverage"
                    className="pl-9 no-zoom"
                  />
                </Field>
              ) : null}

              <Button type="submit" size="lg" className="w-full !mt-6" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {mode === 'signup'
                  ? loading
                    ? 'Creating account…'
                    : 'Create account'
                  : mode === 'login'
                    ? loading
                      ? 'Signing in…'
                      : 'Sign in'
                    : loading
                      ? 'Sending…'
                      : 'Send link'}
                <ArrowRight className="h-4 w-4" />
              </Button>

              {mode === 'signup' ? (
                <p className="text-[11px] text-slate-500">
                  By creating an account you agree to our{' '}
                  <Link href="/terms" className="underline">
                    Terms
                  </Link>{' '}
                  and{' '}
                  <Link href="/privacy" className="underline">
                    Privacy Policy
                  </Link>
                  .
                </p>
              ) : null}
            </form>
          )}

          <div className="mt-6 border-t border-slate-100 pt-4 text-center text-xs text-slate-600">
            {mode === 'signup' ? (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setForgotSent(false);
                  }}
                  className="font-semibold text-slate-900 hover:underline"
                >
                  Sign in
                </button>
              </>
            ) : mode === 'login' ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setForgotSent(false);
                  }}
                  className="font-semibold text-slate-900 hover:underline"
                >
                  Create account
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
