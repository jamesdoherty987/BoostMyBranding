'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, Input, Spinner, toast, Logo, Toaster } from '@boost/ui';
import { ArrowRight, Upload, CheckCircle2, Sparkles, Image as ImageIcon } from 'lucide-react';
import { api } from '@/lib/api';
import { mockClients } from '@boost/core';

/**
 * One-time onboarding flow for brand-new clients after they pay. Three quick
 * steps: confirm business voice, drop first 10 photos, we kick off the first
 * content batch in the background.
 */
export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [goals, setGoals] = useState('Grow local awareness and drive bookings.');
  const [vibe, setVibe] = useState<'warm' | 'professional' | 'playful' | 'premium'>('warm');
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  const addFiles = (picked: FileList | null) => {
    if (!picked) return;
    const next = Array.from(picked)
      .filter((f) => f.type.startsWith('image/'))
      .slice(0, 10);
    setFiles((prev) => [...prev, ...next].slice(0, 10));
  };

  const finish = async () => {
    setLoading(true);
    try {
      let clientId: string;
      try {
        const me = await api.getMyClient();
        clientId = me.id;
      } catch {
        clientId = mockClients[0]!.id;
      }
      if (files.length > 0) {
        await api.uploadImages(clientId, files, ['onboarding']);
      }
      toast.success('All set!', 'Your first batch is on the way');
      setStep(2);
    } catch (e) {
      toast.error('Could not upload', (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 safe-pt safe-pb">
      <Toaster />
      <div className="mx-auto w-full max-w-md px-4 py-10">
        <Logo size="md" className="mb-8" />

        <AnimatePresence mode="wait">
          {step === 0 ? (
            <motion.div
              key="step-0"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl"
            >
              <h1 className="text-2xl font-bold tracking-tight">Welcome aboard 🚀</h1>
              <p className="mt-2 text-sm text-slate-600">
                Two quick questions and we&apos;ll start building your brand voice.
              </p>

              <div className="mt-6">
                <label className="block text-xs font-medium text-slate-600">
                  What should we focus on?
                </label>
                <Input
                  value={goals}
                  onChange={(e) => setGoals(e.target.value)}
                  className="mt-1 no-zoom"
                  placeholder="e.g. Grow foot traffic, drive bookings, awareness"
                />
              </div>

              <div className="mt-5">
                <label className="block text-xs font-medium text-slate-600">Brand vibe</label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {(['warm', 'professional', 'playful', 'premium'] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setVibe(v)}
                      className={`rounded-xl border px-3 py-3 text-sm font-medium capitalize transition-all ${
                        vibe === v
                          ? 'border-transparent bg-gradient-cta text-white shadow-brand'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <Button className="mt-8 w-full" onClick={() => setStep(1)}>
                Continue
                <ArrowRight className="h-4 w-4" />
              </Button>
            </motion.div>
          ) : null}

          {step === 1 ? (
            <motion.div
              key="step-1"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl"
            >
              <h1 className="text-2xl font-bold tracking-tight">Drop in your first photos</h1>
              <p className="mt-2 text-sm text-slate-600">
                10 recent shots is plenty. We&apos;ll enhance and score them automatically.
              </p>

              <label className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center transition-colors hover:border-[#48D886] hover:bg-[#48D886]/5">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-cta text-white">
                  <Upload className="h-5 w-5" />
                </div>
                <div className="mt-3 text-sm font-semibold text-slate-900">
                  Tap to add photos
                </div>
                <div className="text-xs text-slate-500">JPG, PNG, WEBP · up to 10</div>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => addFiles(e.target.files)}
                />
              </label>

              {files.length > 0 ? (
                <div className="mt-4 grid grid-cols-4 gap-2">
                  {files.map((f, i) => (
                    <div key={i} className="relative aspect-square overflow-hidden rounded-lg bg-slate-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={URL.createObjectURL(f)}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              ) : null}

              <Button
                className="mt-6 w-full"
                onClick={finish}
                disabled={loading}
              >
                {loading ? <Spinner /> : <Sparkles className="h-4 w-4" />}
                {files.length > 0 ? `Upload ${files.length} & finish` : 'Skip for now'}
              </Button>
              <button
                onClick={() => setStep(0)}
                className="mt-3 block w-full text-center text-xs text-slate-500 hover:text-slate-700"
              >
                Back
              </button>
            </motion.div>
          ) : null}

          {step === 2 ? (
            <motion.div
              key="step-2"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-xl"
            >
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-cta text-white shadow-brand">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h1 className="mt-5 text-2xl font-bold tracking-tight">You&apos;re all set!</h1>
              <p className="mt-2 text-sm text-slate-600">
                Our team is building your brand-voice doc and first month of content. We&apos;ll ping you in chat within 2 business days.
              </p>
              <Link href="/dashboard">
                <Button className="mt-8 w-full" size="lg">
                  Go to your dashboard
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </main>
  );
}
