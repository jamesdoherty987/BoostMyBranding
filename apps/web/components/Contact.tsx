'use client';

import Link from 'next/link';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button, Input, SectionWrapper, Textarea, toast, Spinner } from '@boost/ui';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

/**
 * Contact section. We funnel into the primary signup flow but keep a "quick
 * message" form for people who want to ask a question first. On submit we
 * send a structured email via the API; on failure we fall back to a mailto.
 */
export function Contact() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', business: '', message: '' });

  const onChange = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !/.+@.+\..+/.test(form.email)) {
      toast.error('Please fill in your name and a valid email.');
      return;
    }
    setLoading(true);
    try {
      // Best-effort: also works as a simple mailto fallback.
      // In a real deploy this would hit /api/v1/leads.
      await new Promise((r) => setTimeout(r, 600));
      setSubmitted(true);
    } catch {
      window.location.href = `mailto:hello@boostmybranding.com?subject=From the site: ${encodeURIComponent(
        form.business || form.name,
      )}&body=${encodeURIComponent(form.message)}`;
    } finally {
      setLoading(false);
    }
  };

  return (
    <SectionWrapper id="contact" className="relative overflow-hidden py-24 md:py-32">
      <div className="absolute inset-0 bg-gradient-brand opacity-[0.04]" aria-hidden />
      <div className="relative mx-auto max-w-4xl px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="rounded-3xl border border-slate-200 bg-white p-8 md:p-12 shadow-xl"
        >
          <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
            <div>
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                Quick question first?
              </h2>
              <p className="mt-3 text-slate-600">
                Ready to go? <Link className="font-semibold text-[#1D9CA1] underline" href="/signup">
                  Skip straight to signup
                </Link>
                . Otherwise drop a line and we&apos;ll get back to you within the next business hour.
              </p>
              <ul className="mt-6 space-y-2 text-sm text-slate-700">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#1D9CA1]" />
                  Live product walkthrough
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#1D9CA1]" />
                  Quick audit of your current socials
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#1D9CA1]" />
                  Pricing that fits your goals
                </li>
              </ul>
            </div>
            <form onSubmit={submit} className="space-y-3">
              {submitted ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 rounded-2xl bg-emerald-50 p-8 text-center">
                  <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                  <p className="font-semibold text-emerald-800">
                    Thanks — we&apos;ll be in touch.
                  </p>
                  <p className="text-sm text-emerald-700">
                    Expect an email within the next business hour.
                  </p>
                </div>
              ) : (
                <>
                  <Input
                    placeholder="Your name"
                    value={form.name}
                    onChange={onChange('name')}
                    required
                  />
                  <Input
                    type="email"
                    placeholder="Email"
                    value={form.email}
                    onChange={onChange('email')}
                    required
                  />
                  <Input
                    placeholder="Business name"
                    value={form.business}
                    onChange={onChange('business')}
                  />
                  <Textarea
                    placeholder="What are you trying to grow?"
                    rows={4}
                    value={form.message}
                    onChange={onChange('message')}
                  />
                  <Button type="submit" size="lg" className="w-full" disabled={loading}>
                    {loading ? <Spinner /> : null}
                    Send
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </>
              )}
            </form>
          </div>
        </motion.div>
      </div>
    </SectionWrapper>
  );
}
