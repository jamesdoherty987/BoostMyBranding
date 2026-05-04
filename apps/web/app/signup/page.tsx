'use client';

/**
 * Unified signup / login / forgot-password page.
 *
 * Supports deep links from invite emails and the dashboard:
 *   /signup                             → signup tab (default)
 *   /signup?mode=login                  → opens in login tab
 *   /signup?mode=forgot                 → opens in forgot tab
 *   /signup?email=x&business=Y&name=Z   → pre-fills signup fields
 *   /signup?redirect=/somewhere         → where to send user after success
 *
 * Payment is NOT collected here. Client lands in the portal with
 * `subscription_status: 'none'` and picks a plan from the portal when
 * ready. This keeps signup to three fields and removes the biggest
 * friction (payment) from the initial commitment.
 */

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button, Input, Logo, toast, Toaster } from '@boost/ui';
import { api } from '@/lib/api';
import { ApiError } from '@boost/api-client';
import {
  ArrowRight,
  Building2,
  User,
  Mail,
  Lock,
  Loader2,
  Eye,
  EyeOff,
  Check,
} from 'lucide-react';

const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL ?? 'http://localhost:3000/portal';

type Mode = 'signup' | 'login' | 'forgot';

export default function SignupPage() {
  return (
    <Suspense fallback={<PageShell>{null}</PageShell>}>
      <SignupPageInner />
    </Suspense>
  );
}

function SignupPageInner() {
  const searchParams = useSearchParams();
  // Mode from URL — defaults to signup, but an invite link or the
  // "Sign in" link from the marketing site can deep-link to login/forgot.
  const initialMode: Mode =
    searchParams.get('mode') === 'login'
      ? 'login'
      : searchParams.get('mode') === 'forgot'
        ? 'forgot'
        : 'signup';
  const [mode, setMode] = useState<Mode>(initialMode);

  // Pre-fill fields from invite links like
  // /signup?email=x@y.com&business=Verde+Cafe&name=Luca
  const [form, setForm] = useState({
    email: searchParams.get('email') ?? '',
    password: '',
    businessName: searchParams.get('business') ?? '',
    contactName: searchParams.get('name') ?? '',
    industry: searchParams.get('industry') ?? '',
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const redirect = searchParams.get('redirect') || `${PORTAL_URL}/dashboard`;
  // Flag a prefilled session so we can show a friendly banner telling the
  // user "this link was sent to you by Your Agency — just pick a password".
  const isInvited = Boolean(searchParams.get('email') && searchParams.get('business'));

  // If the URL mode changes (rare but possible via back/forward), keep
  // internal state in sync.
  useEffect(() => {
    setMode(initialMode);
    setForgotSent(false);
  }, [initialMode]);

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
        window.location.href = redirect;
      } else if (mode === 'login') {
        await api.login(form.email.trim(), form.password);
        window.location.href = redirect;
      } else {
        await api.sendMagicLink(form.email.trim(), redirect);
        setForgotSent(true);
      }
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : (err as Error).message ?? 'Something went wrong';
      if (mode === 'signup' && /already exists/i.test(msg)) {
        toast.info(
          'You already have an account',
          'Switched to sign in — enter your password below.',
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

  const title =
    mode === 'signup'
      ? isInvited
        ? 'Finish setting up your account'
        : 'Create your account'
      : mode === 'login'
        ? 'Welcome back'
        : 'Reset your password';

  const subtitle =
    mode === 'signup'
      ? isInvited
        ? 'Your agency set this up for you — just pick a password and you are in.'
        : 'Free to start. Pick a plan once you are set up.'
      : mode === 'login'
        ? 'Sign in to your BoostMyBranding portal.'
        : "We'll email you a one-click sign-in link so you can set a new password.";

  return (
    <PageShell>
      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
      <p className="mt-2 text-sm text-slate-600">{subtitle}</p>

      {forgotSent ? (
        <div className="mt-6 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-semibold">Check your inbox</p>
          <p className="mt-1">
            We sent a sign-in link to <span className="font-semibold">{form.email}</span>. Click
            it and you&apos;ll land back here — once signed in you can change your password from
            Settings.
          </p>
          <button
            type="button"
            onClick={() => {
              setForgotSent(false);
              setMode('login');
            }}
            className="mt-3 text-xs font-semibold text-emerald-900 underline"
          >
            ← Back to sign in
          </button>
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
                  readOnly={isInvited && Boolean(searchParams.get('business'))}
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
              autoFocus={mode !== 'signup' || !form.email}
              value={form.email}
              onChange={(e) => update({ email: e.target.value })}
              placeholder="you@business.com"
              className="pl-9 no-zoom"
              autoComplete="email"
              readOnly={isInvited && mode === 'signup' && Boolean(searchParams.get('email'))}
            />
          </Field>

          {mode !== 'forgot' ? (
            <Field label="Password" icon={Lock}>
              <Input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={mode === 'signup' ? 8 : 1}
                value={form.password}
                onChange={(e) => update({ password: e.target.value })}
                placeholder={mode === 'signup' ? 'At least 8 characters with a number' : ''}
                className="pl-9 pr-10 no-zoom"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                autoFocus={isInvited && mode === 'signup'}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
              </button>
            </Field>
          ) : null}

          {/* Password strength hints during signup */}
          {mode === 'signup' && form.password.length > 0 ? (
            <PasswordHints password={form.password} />
          ) : null}

          {mode === 'signup' && !isInvited ? (
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
                : isInvited
                  ? 'Finish setup'
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
    </PageShell>
  );
}

/**
 * Outer page chrome. Extracted so the Suspense fallback can render the
 * same shell while client-only hooks (useSearchParams) initialize.
 */
function PageShell({ children }: { children: React.ReactNode }) {
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
          {children}
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

/**
 * Live password rule checklist shown under the password field during signup.
 * Mirrors the rules the server enforces in `validatePassword` so the user
 * never sees a 400 for something we could have flagged here first.
 */
function PasswordHints({ password }: { password: string }) {
  const rules: Array<{ label: string; ok: boolean }> = [
    { label: 'At least 8 characters', ok: password.length >= 8 },
    { label: 'Contains a letter', ok: /[a-zA-Z]/.test(password) },
    { label: 'Contains a number', ok: /\d/.test(password) },
  ];
  return (
    <ul className="space-y-0.5 rounded-lg bg-slate-50 px-3 py-2">
      {rules.map((r) => (
        <li
          key={r.label}
          className={`flex items-center gap-1.5 text-[11px] ${
            r.ok ? 'text-emerald-600' : 'text-slate-500'
          }`}
        >
          <Check
            className={`h-3 w-3 shrink-0 ${r.ok ? 'text-emerald-500' : 'text-slate-300'}`}
          />
          {r.label}
        </li>
      ))}
    </ul>
  );
}
