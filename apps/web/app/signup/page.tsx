'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, Input, Logo, Spinner, toast, Toaster } from '@boost/ui';
import { ArrowRight, ArrowLeft, CheckCircle2, Sparkles, Globe, CreditCard } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL ?? 'http://localhost:3001';

type Tier = 'social_only' | 'website_only' | 'full_package';

interface Form {
  businessName: string;
  contactName: string;
  email: string;
  industry: string;
  websiteUrl: string;
  tier: Tier;
}

const TIERS: { id: Tier; name: string; price: string; blurb: string; popular?: boolean }[] = [
  { id: 'social_only', name: 'Social Only', price: '€700/mo', blurb: '30 posts · 4 platforms · monthly report.' },
  {
    id: 'full_package',
    name: 'Full Package',
    price: '€800/mo + €800 setup',
    blurb: 'Social + custom website + unlimited change requests.',
    popular: true,
  },
  { id: 'website_only', name: 'Website Only', price: '€150/mo + €800 setup', blurb: 'Custom website + hosting + monthly tweaks.' },
];

const STEPS = ['Plan', 'Business', 'Pay', 'Done'] as const;

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupInner />
    </Suspense>
  );
}

function SignupInner() {
  const params = useSearchParams();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Form>({
    businessName: '',
    contactName: '',
    email: '',
    industry: '',
    websiteUrl: '',
    tier: 'full_package',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const plan = params.get('plan') as Tier | null;
    if (plan && ['social_only', 'website_only', 'full_package'].includes(plan)) {
      setForm((f) => ({ ...f, tier: plan }));
      setStep(1);
    }
  }, [params]);

  const update = (patch: Partial<Form>) => setForm((prev) => ({ ...prev, ...patch }));

  const canProceed = () => {
    if (step === 0) return !!form.tier;
    if (step === 1) {
      return (
        form.businessName.trim().length > 1 &&
        form.contactName.trim().length > 1 &&
        /.+@.+\..+/.test(form.email)
      );
    }
    return true;
  };

  const next = () => {
    if (!canProceed()) {
      toast.error('Please finish this step first');
      return;
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };
  const back = () => setStep((s) => Math.max(0, s - 1));

  const startCheckout = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/billing/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          tier: form.tier,
          email: form.email,
          businessName: form.businessName,
          contactName: form.contactName,
          industry: form.industry,
          websiteUrl: form.websiteUrl,
        }),
      });
      const payload = await res.json();
      if (!res.ok || payload.error) throw new Error(payload.error?.message ?? 'Checkout failed');
      window.location.href = payload.data.url;
    } catch (e) {
      toast.error('Could not start checkout', (e as Error).message);
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

      <div className="mx-auto w-full max-w-2xl px-4 py-10 md:py-16">
        <Stepper step={step} />

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35 }}
            className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl md:p-10"
          >
            {step === 0 ? (
              <>
                <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Pick your plan</h1>
                <p className="mt-1 text-sm text-slate-600">
                  Cancel monthly after the first 3 months.
                </p>
                <div className="mt-6 space-y-3">
                  {TIERS.map((t) => {
                    const active = form.tier === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => update({ tier: t.id })}
                        className={`relative flex w-full items-start justify-between gap-4 rounded-2xl border p-4 text-left transition-all ${
                          active
                            ? 'border-transparent bg-gradient-to-br from-[#48D886]/10 to-[#1D9CA1]/10 ring-2 ring-[#48D886]'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {t.popular ? (
                          <span className="absolute -top-2 right-4 rounded-full bg-gradient-cta px-2 py-0.5 text-[10px] font-semibold text-white">
                            Most popular
                          </span>
                        ) : null}
                        <div>
                          <div className="font-semibold text-slate-900">{t.name}</div>
                          <div className="text-sm text-slate-600">{t.blurb}</div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-sm font-bold text-slate-900">{t.price}</div>
                          {active ? (
                            <CheckCircle2 className="ml-auto mt-1 h-5 w-5 text-[#48D886]" />
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : null}

            {step === 1 ? (
              <>
                <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Tell us about the business</h1>
                <p className="mt-1 text-sm text-slate-600">Takes about 30 seconds.</p>

                <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Field label="Business name *">
                    <Input
                      value={form.businessName}
                      onChange={(e) => update({ businessName: e.target.value })}
                      placeholder="Verde Cafe"
                      className="no-zoom"
                    />
                  </Field>
                  <Field label="Your name *">
                    <Input
                      value={form.contactName}
                      onChange={(e) => update({ contactName: e.target.value })}
                      placeholder="Luca Romano"
                      className="no-zoom"
                    />
                  </Field>
                  <Field label="Work email *" className="md:col-span-2">
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) => update({ email: e.target.value })}
                      placeholder="you@business.com"
                      className="no-zoom"
                    />
                  </Field>
                  <Field label="Industry">
                    <Input
                      value={form.industry}
                      onChange={(e) => update({ industry: e.target.value })}
                      placeholder="Food & Beverage"
                      className="no-zoom"
                    />
                  </Field>
                  <Field label="Current website (optional)">
                    <Input
                      value={form.websiteUrl}
                      onChange={(e) => update({ websiteUrl: e.target.value })}
                      placeholder="https://"
                      className="no-zoom"
                    />
                  </Field>
                </div>
              </>
            ) : null}

            {step === 2 ? (
              <>
                <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Confirm &amp; pay</h1>
                <p className="mt-1 text-sm text-slate-600">
                  Secure Stripe checkout. You&apos;ll be redirected to confirm.
                </p>
                <div className="mt-6 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
                  <Row k="Plan" v={TIERS.find((t) => t.id === form.tier)?.name ?? ''} />
                  <Row k="Business" v={form.businessName} />
                  <Row k="Contact" v={`${form.contactName} · ${form.email}`} />
                  {form.industry ? <Row k="Industry" v={form.industry} /> : null}
                  {form.websiteUrl ? <Row k="Website" v={form.websiteUrl} /> : null}
                </div>
                <ul className="mt-6 space-y-2 text-sm text-slate-700">
                  <li className="flex items-start gap-2"><Sparkles className="mt-0.5 h-4 w-4 text-[#1D9CA1]" /> AI brand-voice doc starts generating once payment clears.</li>
                  <li className="flex items-start gap-2"><Globe className="mt-0.5 h-4 w-4 text-[#1D9CA1]" /> Portal access emailed to you instantly.</li>
                  <li className="flex items-start gap-2"><CreditCard className="mt-0.5 h-4 w-4 text-[#1D9CA1]" /> 3-month minimum, cancel any time after.</li>
                </ul>
              </>
            ) : null}

            {step === 3 ? (
              <div className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-cta text-white shadow-brand">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <h1 className="mt-5 text-2xl font-bold tracking-tight md:text-3xl">You&apos;re in!</h1>
                <p className="mt-2 text-slate-600">
                  We sent a magic link to <span className="font-semibold">{form.email}</span>. Tap it to open your client portal.
                </p>
                <Link href={PORTAL_URL}>
                  <Button size="lg" className="mt-8 w-full">
                    Open client portal
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            ) : null}

            {step < 3 ? (
              <div className="mt-8 flex items-center justify-between gap-2">
                <Button variant="ghost" onClick={back} disabled={step === 0}>
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
                {step < 2 ? (
                  <Button onClick={next}>
                    Continue <ArrowRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button onClick={startCheckout} disabled={loading}>
                    {loading ? <Spinner /> : <CreditCard className="h-4 w-4" />}
                    Go to secure checkout
                  </Button>
                )}
              </div>
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>
    </main>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <ol className="flex items-center justify-between gap-2">
      {STEPS.map((label, i) => {
        const done = i < step;
        const active = i === step;
        return (
          <li key={label} className="flex flex-1 items-center gap-2">
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                done
                  ? 'bg-gradient-cta text-white'
                  : active
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-200 text-slate-500'
              }`}
            >
              {done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </div>
            <div
              className={`text-xs font-medium ${
                active ? 'text-slate-900' : 'text-slate-500'
              } hidden sm:block`}
            >
              {label}
            </div>
            {i < STEPS.length - 1 ? (
              <div
                className={`flex-1 h-0.5 rounded-full ${
                  done ? 'bg-gradient-cta' : 'bg-slate-200'
                }`}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className ?? ''}`}>
      <span className="block text-xs font-medium text-slate-600">{label}</span>
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-slate-500">{k}</span>
      <span className="font-medium text-slate-900">{v}</span>
    </div>
  );
}
