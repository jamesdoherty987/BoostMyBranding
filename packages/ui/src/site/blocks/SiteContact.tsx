'use client';

import { useState, type FormEvent } from 'react';
import { Mail, MapPin, Phone, Clock, ArrowRight } from 'lucide-react';
import type { WebsiteConfig } from '@boost/core';
import { SectionWrapper } from '../../section-wrapper';
import { useSiteContext } from '../context';
import { brandGradient } from '../theme';
import { InlineEditable } from '../InlineEditable';

interface SiteContactProps {
  config: WebsiteConfig;
  /** Client id override. Falls back to the SiteContext value if omitted. */
  clientId?: string;
  /** API base URL override. Falls back to the SiteContext value if omitted. */
  apiUrl?: string;
}

type FormState = 'idle' | 'sending' | 'sent' | 'error';

/**
 * Contact block. Shows a booking form when `showBookingForm !== false` and
 * always surfaces address / phone / email / hours when present.
 *
 * Submission strategy:
 *   1. If `apiUrl` + `clientId` are supplied (directly or via context),
 *      POST to `${apiUrl}/api/v1/leads`.
 *   2. If that fails (network, 5xx, or missing config), fall back to a
 *      `mailto:` so the enquiry still reaches the business.
 *   3. Always show the user a clear success/error state.
 */
export function SiteContact({ config, clientId: clientIdProp, apiUrl: apiUrlProp }: SiteContactProps) {
  const ctx = useSiteContext();
  const clientId = clientIdProp ?? ctx.clientId;
  const apiUrl = apiUrlProp ?? ctx.apiUrl;
  const embedded = ctx.embedded;
  const c = config.contact;
  const [state, setState] = useState<FormState>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [values, setValues] = useState({ name: '', email: '', message: '' });
  if (!c) return null;

  const sendMailtoFallback = () => {
    if (typeof window === 'undefined' || !c.email) return false;
    const subject = encodeURIComponent('Enquiry from your website');
    const body = encodeURIComponent(
      `Name: ${values.name}\nEmail: ${values.email}\n\n${values.message}`,
    );
    window.location.href = `mailto:${c.email}?subject=${subject}&body=${body}`;
    return true;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setState('sending');
    setErrorMessage('');

    try {
      let apiOk = false;
      if (apiUrl && clientId) {
        const res = await fetch(`${apiUrl.replace(/\/$/, '')}/api/v1/leads`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId,
            name: values.name.trim(),
            email: values.email.trim(),
            message: values.message.trim(),
            source: 'website_contact',
            referer: typeof document !== 'undefined' ? document.referrer : undefined,
          }),
        });
        apiOk = res.ok;
      }

      if (!apiOk) {
        // Best-effort mailto fallback. Still counts as "sent" from the user's
        // perspective because we've handed them off to their mail client.
        sendMailtoFallback();
      }

      setState('sent');
      setValues({ name: '', email: '', message: '' });
    } catch (err) {
      // Network-level failure → mailto fallback.
      const fallbackOk = sendMailtoFallback();
      if (fallbackOk) {
        setState('sent');
        setValues({ name: '', email: '', message: '' });
      } else {
        setState('error');
        setErrorMessage((err as Error).message || "Couldn't send. Try calling us instead.");
      }
    }
  };

  return (
    <SectionWrapper immediate={embedded} id="contact" className="bg-white py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4">
        <div
          className="overflow-hidden rounded-[2rem] shadow-xl"
          style={{ background: brandGradient(config.brand, 120) }}
        >
          <div className="grid grid-cols-1 gap-0 lg:grid-cols-2">
            <div className="p-8 text-white md:p-12">
              <InlineEditable
                path="contact.eyebrow"
                value={c.eyebrow ?? 'Contact'}
                as="p"
                className="text-xs font-semibold uppercase tracking-[0.25em] text-white/70"
                placeholder="Section eyebrow…"
              />
              <h2 className="mt-2 text-3xl font-bold tracking-tight md:text-5xl">
                <InlineEditable
                  path="contact.heading"
                  value={c.heading}
                  as="span"
                  placeholder="Contact heading…"
                />
              </h2>
              <p className="mt-4 text-base text-white/85 md:text-lg">
                <InlineEditable
                  path="contact.body"
                  value={c.body}
                  as="span"
                  multiline
                  placeholder="Short note about how to reach you…"
                />
              </p>

              <div className="mt-8 space-y-3 text-sm">
                {c.address || ctx.editMode ? (
                  <div className="flex items-start gap-3">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 opacity-80" />
                    <InlineEditable
                      path="contact.address"
                      value={c.address ?? ''}
                      as="span"
                      placeholder="123 Main St, City"
                    />
                  </div>
                ) : null}
                {c.phone || ctx.editMode ? (
                  ctx.editMode ? (
                    <div className="flex items-start gap-3">
                      <Phone className="mt-0.5 h-4 w-4 shrink-0 opacity-80" />
                      <InlineEditable
                        path="contact.phone"
                        value={c.phone ?? ''}
                        as="span"
                        placeholder="+353 1 234 5678"
                      />
                    </div>
                  ) : (
                    <a
                      href={`tel:${(c.phone ?? '').replace(/[^+\d]/g, '')}`}
                      className="flex items-start gap-3 hover:underline"
                    >
                      <Phone className="mt-0.5 h-4 w-4 shrink-0 opacity-80" />
                      <span>{c.phone}</span>
                    </a>
                  )
                ) : null}
                {c.email || ctx.editMode ? (
                  ctx.editMode ? (
                    <div className="flex items-start gap-3">
                      <Mail className="mt-0.5 h-4 w-4 shrink-0 opacity-80" />
                      <InlineEditable
                        path="contact.email"
                        value={c.email ?? ''}
                        as="span"
                        placeholder="hello@example.com"
                      />
                    </div>
                  ) : (
                    <a href={`mailto:${c.email}`} className="flex items-start gap-3 hover:underline">
                      <Mail className="mt-0.5 h-4 w-4 shrink-0 opacity-80" />
                      <span>{c.email}</span>
                    </a>
                  )
                ) : null}
                {(c.showHours && c.hours) || ctx.editMode ? (
                  <div className="flex items-start gap-3">
                    <Clock className="mt-0.5 h-4 w-4 shrink-0 opacity-80" />
                    <InlineEditable
                      path="contact.hours"
                      value={c.hours ?? ''}
                      as="span"
                      placeholder="Mon–Fri 9am–5pm"
                    />
                  </div>
                ) : null}
              </div>
            </div>

            {c.showBookingForm !== false ? (
              <div className="bg-white p-8 md:p-12">
                {state === 'sent' ? (
                  <div
                    role="status"
                    aria-live="polite"
                    className="flex h-full flex-col items-center justify-center text-center"
                  >
                    <div
                      className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full"
                      style={{
                        background: 'var(--bmb-site-primary)',
                        color: 'var(--bmb-site-on-primary)',
                      }}
                      aria-hidden
                    >
                      ✓
                    </div>
                    <h3 className="text-xl font-semibold text-slate-900">Thanks!</h3>
                    <p className="mt-2 text-sm text-slate-600">
                      We&apos;ll get back to you within a few hours.
                    </p>
                    <button
                      type="button"
                      onClick={() => setState('idle')}
                      className="mt-4 text-xs font-semibold text-slate-500 underline-offset-2 hover:underline"
                    >
                      Send another
                    </button>
                  </div>
                ) : (
                  <form onSubmit={submit} className="space-y-4" noValidate>
                    <div>
                      <label
                        htmlFor="contact-name"
                        className="block text-xs font-medium text-slate-600"
                      >
                        Name
                      </label>
                      <input
                        id="contact-name"
                        name="name"
                        autoComplete="name"
                        required
                        maxLength={200}
                        value={values.name}
                        onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
                        className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="contact-email"
                        className="block text-xs font-medium text-slate-600"
                      >
                        Email
                      </label>
                      <input
                        id="contact-email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        maxLength={200}
                        value={values.email}
                        onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
                        className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="contact-message"
                        className="block text-xs font-medium text-slate-600"
                      >
                        Message
                      </label>
                      <textarea
                        id="contact-message"
                        name="message"
                        rows={4}
                        required
                        maxLength={2000}
                        value={values.message}
                        onChange={(e) =>
                          setValues((v) => ({ ...v, message: e.target.value }))
                        }
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                      />
                    </div>

                    {state === 'error' && errorMessage ? (
                      <p role="alert" className="text-xs text-rose-600">
                        {errorMessage}
                      </p>
                    ) : null}

                    <button
                      type="submit"
                      disabled={state === 'sending'}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold shadow-sm transition-transform hover:scale-[1.01] disabled:opacity-60"
                      style={{
                        background: 'var(--bmb-site-primary)',
                        color: 'var(--bmb-site-on-primary)',
                      }}
                    >
                      {state === 'sending' ? 'Sending…' : 'Send enquiry'}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </form>
                )}
              </div>
            ) : null}
          </div>
        </div>

        {/* Map embed — shown when the client provided an address. Uses the
            maps.google.com search URL so no API key or geocoding is needed;
            the iframe picks up the address string and renders the pin. */}
        {c.address ? <SiteContactMap address={c.address} /> : null}
      </div>
    </SectionWrapper>
  );
}

/**
 * Lightweight Google Maps embed. No API key required — we build a
 * `maps.google.com/maps?q=...&output=embed` URL, which returns an
 * interactive map centered on the search query. Lazy-loaded so it
 * doesn't block the rest of the contact section on first paint.
 */
function SiteContactMap({ address }: { address: string }) {
  const query = encodeURIComponent(address);
  const src = `https://maps.google.com/maps?q=${query}&t=&z=14&ie=UTF8&iwloc=&output=embed`;

  return (
    <div className="mt-6 overflow-hidden rounded-[2rem] border border-slate-200 shadow-sm">
      <iframe
        src={src}
        title={`Map of ${address}`}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className="block h-72 w-full md:h-96"
        style={{ border: 0 }}
      />
    </div>
  );
}
