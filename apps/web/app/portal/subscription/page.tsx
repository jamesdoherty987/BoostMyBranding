'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button, Spinner, Badge, toast } from '@boost/ui';
import { CheckCircle2, CreditCard, ArrowRight, Sparkles, ShieldCheck, XCircle } from 'lucide-react';
import { TIERS, formatTierPrice, COMPANY, formatCurrency } from '@boost/core';
import type { SubscriptionTier } from '@boost/core';
import { Shell } from '@/components/portal/Shell';
import {
  useSubscription,
  startCheckout,
  openBillingPortal,
  type SubscriptionView,
} from '@/lib/portal/subscription';
import { api } from '@/lib/portal/api';

export default function SubscriptionPage() {
  return (
    <Suspense fallback={null}>
      <SubscriptionInner />
    </Suspense>
  );
}

function SubscriptionInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { subscription, isLoading, refresh } = useSubscription();
  const [selected, setSelected] = useState<SubscriptionTier | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const handledReturn = useRef(false);

  // Handle the redirect back from Stripe. Stripe's webhook flips our DB
  // row to `active` asynchronously, so we call a server-side finalize
  // endpoint that retrieves the session directly (belt-and-braces for
  // local dev, where webhooks can't reach localhost) and then poll a
  // few times as a fallback — otherwise the user would see a stale
  // "Not subscribed" screen after successfully paying.
  useEffect(() => {
    if (handledReturn.current) return;
    const s = params.get('status');
    if (s !== 'success' && s !== 'canceled') return;
    handledReturn.current = true;

    if (s === 'canceled') {
      toast.error('Checkout canceled', 'No worries, your account is still here.');
      router.replace('/portal/subscription');
      return;
    }

    const sessionId = params.get('session_id');

    // Success path: ask the server to reconcile the Stripe session, then
    // poll as a backup until the subscription row shows active.
    setConfirming(true);
    let cancelled = false;
    (async () => {
      if (sessionId) {
        try {
          await api.finalizeCheckout(sessionId);
        } catch {
          // Non-fatal — we'll still poll. If the webhook has already
          // landed, polling alone is enough.
        }
      }

      const deadline = Date.now() + 10_000;
      let becameActive = false;
      while (!cancelled && Date.now() < deadline) {
        try {
          const fresh = await api.getSubscription();
          if (fresh.active) {
            becameActive = true;
            break;
          }
        } catch {
          // Ignore; we'll try again.
        }
        await new Promise((r) => setTimeout(r, 1200));
      }
      if (cancelled) return;
      await refresh();
      setConfirming(false);
      if (becameActive) {
        toast.success('Welcome aboard', 'Your subscription is active.');
      } else {
        toast.error(
          'Still confirming your payment',
          'Stripe is taking a moment. Refresh in a few seconds or contact us if this persists.',
        );
      }
      router.replace('/portal/subscription');
    })();
    return () => {
      cancelled = true;
    };
  }, [params, refresh, router]);

  useEffect(() => {
    if (subscription && !selected) setSelected(subscription.tier);
  }, [subscription, selected]);

  if (isLoading || !subscription || confirming) {
    return (
      <Shell title="Subscription" hideSubscriptionBanner>
        <div className="flex flex-col items-center justify-center gap-3 p-12">
          <Spinner size={28} />
          {confirming ? (
            <p className="text-sm text-slate-600">Confirming your payment…</p>
          ) : null}
        </div>
      </Shell>
    );
  }

  const subscribe = async () => {
    if (!selected) return;
    setCheckingOut(true);
    try {
      await startCheckout(selected);
    } catch (e) {
      toast.error('Could not open checkout', (e as Error).message);
      setCheckingOut(false);
    }
  };

  const manage = async () => {
    setOpeningPortal(true);
    try {
      await openBillingPortal();
    } catch (e) {
      toast.error('Could not open billing portal', (e as Error).message);
      setOpeningPortal(false);
    }
  };

  return (
    <Shell title="Subscription" hideSubscriptionBanner>
      {subscription.active ? (
        <ActiveState subscription={subscription} onManage={manage} opening={openingPortal} />
      ) : (
        <PlansState
          subscription={subscription}
          selected={selected}
          onSelect={setSelected}
          onSubscribe={subscribe}
          checkingOut={checkingOut}
          onManage={subscription.hasCustomer ? manage : undefined}
          opening={openingPortal}
        />
      )}
    </Shell>
  );
}

function ActiveState({
  subscription,
  onManage,
  opening,
}: {
  subscription: SubscriptionView;
  onManage: () => void;
  opening: boolean;
}) {
  const started = subscription.startedAt
    ? new Date(subscription.startedAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;

  return (
    <>
      <section className="rounded-2xl bg-gradient-cta p-5 text-white shadow-brand">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-white/80">
          <ShieldCheck className="h-3.5 w-3.5" />
          Active plan
        </div>
        <div className="mt-1 text-2xl font-bold">{subscription.tierName}</div>
        <div className="mt-1 text-sm text-white/90">
          {formatCurrency(subscription.priceCents)} /mo
          {started ? ` · since ${started}` : ''}
        </div>
      </section>

      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Billing</h2>
        <p className="mt-1 text-xs text-slate-500">
          Update payment method, see invoices, or cancel anytime.
        </p>
        <Button
          variant="outline"
          size="lg"
          className="mt-3 w-full"
          onClick={onManage}
          disabled={opening}
        >
          {opening ? <Spinner /> : <CreditCard className="h-4 w-4" />}
          Manage billing
        </Button>
      </section>

      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Switch plan</h2>
        <p className="mt-1 text-xs text-slate-500">
          Want to add a website or drop down a tier? Change your plan from the billing portal.
        </p>
      </section>
    </>
  );
}

function PlansState({
  subscription,
  selected,
  onSelect,
  onSubscribe,
  checkingOut,
  onManage,
  opening,
}: {
  subscription: SubscriptionView;
  selected: SubscriptionTier | null;
  onSelect: (t: SubscriptionTier) => void;
  onSubscribe: () => void;
  checkingOut: boolean;
  onManage?: () => void;
  opening: boolean;
}) {
  const isPastDue = subscription.status === 'past_due';
  const isCanceled = subscription.status === 'canceled';
  const headlineCopy = isPastDue
    ? 'Your last payment failed. Update your card to keep everything switched on.'
    : isCanceled
      ? 'Your subscription ended. Pick a plan to restore access.'
      : 'Pick a plan to unlock content generation, publishing, and your client workspace.';

  return (
    <>
      <section
        className={`rounded-2xl p-5 shadow-brand ${
          isPastDue || isCanceled
            ? 'bg-amber-50 text-amber-900 ring-1 ring-amber-200'
            : 'bg-gradient-cta text-white'
        }`}
      >
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest opacity-80">
          {isPastDue ? (
            <>
              <XCircle className="h-3.5 w-3.5" />
              Payment failed
            </>
          ) : isCanceled ? (
            <>
              <XCircle className="h-3.5 w-3.5" />
              Canceled
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5" />
              Not subscribed yet
            </>
          )}
        </div>
        <div className="mt-1 text-xl font-bold">{headlineCopy}</div>
      </section>

      {isPastDue && onManage ? (
        <Button size="lg" className="mt-4 w-full" onClick={onManage} disabled={opening}>
          {opening ? <Spinner /> : <CreditCard className="h-4 w-4" />}
          Update payment method
        </Button>
      ) : null}

      <section className="mt-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Choose a plan</h2>
        {TIERS.map((t) => {
          const active = selected === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t.id)}
              className={`relative flex w-full flex-col gap-2 rounded-2xl border p-4 text-left transition-all ${
                active
                  ? 'border-transparent bg-gradient-to-br from-[#48D886]/10 to-[#1D9CA1]/10 ring-2 ring-[#48D886]'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900">{t.name}</span>
                    {t.highlight ? <Badge tone="brand">Popular</Badge> : null}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-600">{t.description}</p>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-sm font-bold text-slate-900">{formatTierPrice(t)}</div>
                  {active ? (
                    <CheckCircle2 className="ml-auto mt-1 h-5 w-5 text-[#48D886]" />
                  ) : null}
                </div>
              </div>
              <ul className="mt-1 space-y-1 text-xs text-slate-600">
                {t.features.slice(0, 3).map((f) => (
                  <li key={f} className="flex items-start gap-1.5">
                    <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-[#48D886]" />
                    {f}
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </section>

      <p className="mt-4 text-center text-xs text-slate-500">
        {COMPANY.minCommitmentMonths}-month minimum, cancel monthly after. Secure checkout by Stripe.
      </p>

      <Button size="lg" className="mt-4 w-full" onClick={onSubscribe} disabled={!selected || checkingOut}>
        {checkingOut ? <Spinner /> : <ArrowRight className="h-4 w-4" />}
        {checkingOut ? 'Opening secure checkout…' : 'Continue to payment'}
      </Button>
    </>
  );
}
