'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button, Input, Logo, AuroraBg, Toaster, toast, Spinner } from '@boost/ui';
import { ArrowRight, Mail, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/.+@.+\..+/.test(email.trim())) {
      toast.error('Check your email', 'That doesn\'t look quite right.');
      return;
    }
    setLoading(true);
    try {
      const redirectTo =
        typeof window !== 'undefined' ? `${window.location.origin}/dashboard` : undefined;
      const res = await api.sendMagicLink(email.trim(), redirectTo);
      setSent(true);
      if (res.devLink) setDevLink(res.devLink);
      toast.success('Check your inbox', 'Magic link sent');
    } catch (err) {
      toast.error('Could not send link', (err as Error).message);
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
        <h1 className="mt-6 text-2xl font-bold text-slate-900">Welcome back</h1>
        <p className="mt-1 text-sm text-slate-600">
          We&apos;ll email you a magic link. No passwords to remember.
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
                Dev link — click to continue
              </a>
            ) : null}
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-3">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                type="email"
                required
                placeholder="you@business.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? <Spinner /> : null}
              Send magic link
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
        )}
        <div className="mt-6 text-center text-xs text-slate-500">
          Team member?{' '}
          <Link
            href={process.env.NEXT_PUBLIC_DASHBOARD_URL ?? 'http://localhost:3002'}
            className="font-medium text-slate-700 underline"
          >
            Dashboard login
          </Link>
        </div>
      </motion.div>
      <Toaster />
    </main>
  );
}
