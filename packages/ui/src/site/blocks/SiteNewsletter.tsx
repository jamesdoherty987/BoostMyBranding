'use client';

import { useState, type FormEvent } from 'react';
import { Mail, ArrowRight } from 'lucide-react';
import type { WebsiteConfig } from '@boost/core';
import { SectionWrapper } from '../../section-wrapper';
import { useSiteContext } from '../context';
import { brandGradient } from '../theme';
import { InlineEditable } from '../InlineEditable';

interface SiteNewsletterProps {
  config: WebsiteConfig;
}

type FormState = 'idle' | 'sending' | 'sent' | 'error';

/**
 * Newsletter / waitlist email capture. Posts to the same /leads endpoint
 * as the contact form but tagged as `newsletter_signup` so the dashboard
 * can filter. On network failure we fall back to a "mailto:" so the
 * enquiry still reaches the business.
 *
 * Styled as a single strip with brand-gradient background — distinct
 * from the full Contact block, intended to sit between other sections
 * as a light conversion nudge.
 */
export function SiteNewsletter({ config }: SiteNewsletterProps) {
  const ctx = useSiteContext();
  const n = config.newsletter;
  const [state, setState] = useState<FormState>('idle');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string>('');

  if (!n) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (ctx.editMode) return;
    setState('sending');
    setError('');

    try {
      const base = ctx.apiUrl ?? '';
      const clientId = ctx.clientId;
      let ok = false;
      if (base && clientId) {
        const res = await fetch(`${base.replace(/\/$/, '')}/api/v1/leads`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId,
            name: '',
            email: email.trim(),
            message: '',
            source: 'newsletter_signup',
            referer: typeof document !== 'undefined' ? document.referrer : undefined,
          }),
        });
        ok = res.ok;
      }
      if (ok) {
        setState('sent');
        setEmail('');
        return;
      }
      // API path didn't work — fall back to mailto when we can.
      const toAddr = config.contact?.email;
      if (toAddr && typeof window !== 'undefined') {
        const subj = encodeURIComponent('Newsletter signup');
        const body = encodeURIComponent(`Please add ${email.trim()} to your newsletter.`);
        window.location.href = `mailto:${toAddr}?subject=${subj}&body=${body}`;
        setState('sent');
        setEmail('');
        return;
      }
      // No API + no email on file — we genuinely cannot subscribe this person.
      // Surface a clear message instead of failing silently.
      setState('error');
      setError(
        "We couldn't save that right now. Please try again later or contact us directly.",
      );
    } catch (err) {
      setState('error');
      setError((err as Error).message || "Couldn't subscribe. Try again.");
    }
  };

  return (
    <SectionWrapper immediate={ctx.embedded} className="bg-white py-12 md:py-16">
      <div className="mx-auto max-w-5xl px-4">
        <div
          className="overflow-hidden rounded-[2rem] px-8 py-10 text-white shadow-xl md:px-14 md:py-12"
          style={{ background: brandGradient(config.brand, 140) }}
        >
          <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-2 md:gap-10">
            <div>
              {n.eyebrow ? (
                <InlineEditable
                  path="newsletter.eyebrow"
                  value={n.eyebrow}
                  as="p"
                  className="text-xs font-semibold uppercase tracking-[0.25em] text-white/80"
                  placeholder="Section eyebrow…"
                />
              ) : null}
              <h2 className="mt-2 text-2xl font-bold tracking-tight md:text-4xl">
                <InlineEditable
                  path="newsletter.heading"
                  value={n.heading ?? 'Stay in the loop.'}
                  as="span"
                  placeholder="Heading…"
                />
              </h2>
              {n.body ? (
                <p className="mt-3 text-base text-white/85 md:text-lg">
                  <InlineEditable
                    path="newsletter.body"
                    value={n.body}
                    as="span"
                    multiline
                    placeholder="Short line about what subscribers get…"
                  />
                </p>
              ) : null}
            </div>

            {state === 'sent' ? (
              <div
                role="status"
                aria-live="polite"
                className="rounded-2xl bg-white/15 p-5 text-center backdrop-blur"
              >
                <div
                  className="mx-auto mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-xl font-bold"
                  style={{ color: 'var(--bmb-site-primary)' }}
                  aria-hidden
                >
                  ✓
                </div>
                <p className="text-sm font-semibold">Thanks — you're in.</p>
                <button
                  type="button"
                  onClick={() => setState('idle')}
                  className="mt-2 text-xs text-white/80 underline-offset-2 hover:underline"
                >
                  Add another
                </button>
              </div>
            ) : (
              <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
                <div className="flex flex-col items-stretch gap-2 sm:flex-row">
                  <label className="sr-only" htmlFor="bmb-newsletter-email">
                    Email
                  </label>
                  <div className="relative flex-1">
                    <Mail
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60"
                      aria-hidden
                    />
                    <input
                      id="bmb-newsletter-email"
                      type="email"
                      required
                      maxLength={200}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={n.placeholder ?? 'Your email'}
                      className="h-12 w-full rounded-full border border-white/30 bg-white/15 pl-10 pr-4 text-sm text-white placeholder:text-white/60 outline-none focus:border-white focus:bg-white/25"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={state === 'sending'}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold shadow-lg transition-transform hover:scale-[1.02] disabled:opacity-60"
                    style={{ color: 'var(--bmb-site-primary)' }}
                  >
                    <InlineEditable
                      path="newsletter.buttonLabel"
                      value={n.buttonLabel ?? 'Subscribe'}
                      as="span"
                      placeholder="Subscribe"
                    />
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
                {state === 'error' && error ? (
                  <p role="alert" className="text-xs text-white/90">
                    {error}
                  </p>
                ) : null}
                {n.consent ? (
                  <p className="text-[10px] text-white/70">
                    <InlineEditable
                      path="newsletter.consent"
                      value={n.consent}
                      as="span"
                      placeholder="Optional consent line…"
                    />
                  </p>
                ) : null}
              </form>
            )}
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
}
