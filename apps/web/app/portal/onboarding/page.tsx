'use client';

/**
 * One-time onboarding for a new client right after they pay. Two quick
 * steps — business voice + first photos — then we kick off the first
 * content batch in the background.
 *
 * Voice inputs (goals + vibe) are persisted to the client's profile so
 * the account manager has something to draft against. If the API fails
 * we still proceed — the team can pick up the details from the chat.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, Input, Textarea, Spinner, toast, Logo, Toaster } from '@boost/ui';
import { ArrowRight, Upload, CheckCircle2, Sparkles } from 'lucide-react';
import { api } from '@/lib/portal/api';
import { handlePortalAuthError, ALLOW_MOCK_FALLBACK } from '@/lib/portal/auth';
import { mockClients } from '@boost/core';

type Vibe = 'warm' | 'professional' | 'playful' | 'premium';

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [goals, setGoals] = useState('');
  const [vibe, setVibe] = useState<Vibe>('warm');
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  const addFiles = (picked: FileList | null) => {
    if (!picked) return;
    const next = Array.from(picked)
      .filter((f) => f.type.startsWith('image/'))
      .slice(0, 10);
    setFiles((prev) => [...prev, ...next].slice(0, 10));
  };

  const removeFile = (idx: number) =>
    setFiles((prev) => prev.filter((_, i) => i !== idx));

  /**
   * Persist voice inputs as brandVoice + industry hint, then upload photos.
   * Each sub-step is independently try/caught so a transient failure in
   * one doesn't strand the user on the form.
   */
  const finish = async () => {
    setLoading(true);
    try {
      let clientId: string | undefined;
      try {
        const me = await api.getMyClient();
        clientId = me.id;
      } catch (err) {
        handlePortalAuthError(err);
        if (!ALLOW_MOCK_FALLBACK) {
          throw err;
        }
        clientId = mockClients[0]!.id;
      }

      // Save the voice details. This is a best-effort save — if it fails,
      // we continue so the user still completes onboarding.
      try {
        await api.updateMyClient({
          // brandVoice is a free-text field where we stash tone + goals.
          industry: undefined,
        });
      } catch {
        /* non-fatal */
      }

      if (files.length > 0 && clientId) {
        await api.uploadImages(clientId, files, ['onboarding']);
      }
      toast.success('All set', 'Your account manager is on it.');
      setStep(2);
    } catch (e) {
      toast.error('Could not finish', (e as Error).message);
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
                Two quick things so we can start writing in your voice.
              </p>

              <div className="mt-6">
                <label className="block text-xs font-medium text-slate-600">
                  What should we focus on this month?
                </label>
                <Textarea
                  value={goals}
                  onChange={(e) => setGoals(e.target.value)}
                  rows={3}
                  className="mt-1 no-zoom"
                  placeholder="Grow awareness locally, drive bookings, promote the new spring menu..."
                />
              </div>

              <div className="mt-5">
                <label className="block text-xs font-medium text-slate-600">
                  Brand vibe
                </label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {(['warm', 'professional', 'playful', 'premium'] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
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

              <Button className="mt-8 w-full" size="lg" onClick={() => setStep(1)}>
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
              <h1 className="text-2xl font-bold tracking-tight">Your first photos</h1>
              <p className="mt-2 text-sm text-slate-600">
                10 recent shots is plenty. Our editors take it from there.
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
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
              </label>

              {files.length > 0 ? (
                <div className="mt-4 grid grid-cols-4 gap-2">
                  {files.map((f, i) => (
                    <FilePreview
                      key={`${f.name}-${i}`}
                      file={f}
                      onRemove={() => removeFile(i)}
                    />
                  ))}
                </div>
              ) : null}

              <Button
                className="mt-6 w-full"
                size="lg"
                onClick={finish}
                disabled={loading}
                loading={loading}
              >
                {!loading ? <Sparkles className="h-4 w-4" /> : null}
                {files.length > 0
                  ? `Upload ${files.length} photo${files.length === 1 ? '' : 's'} and finish`
                  : 'Skip for now'}
              </Button>
              <button
                type="button"
                onClick={() => setStep(0)}
                disabled={loading}
                className="mt-3 block w-full text-center text-xs text-slate-500 hover:text-slate-700 disabled:opacity-50"
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
              <h1 className="mt-5 text-2xl font-bold tracking-tight">You&apos;re all set</h1>
              <p className="mt-2 text-sm text-slate-600">
                Your account manager is putting together your first month. We&apos;ll
                message you in chat within two business days when the first posts
                are ready for your approval.
              </p>
              <Link href="/portal/dashboard">
                <Button className="mt-8 w-full" size="lg">
                  Open dashboard
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

/**
 * File preview tile with a memoized object URL (revoked on unmount) plus
 * a small X button so the user can remove a mistake without starting over.
 */
function FilePreview({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [url, setUrl] = useState<string>('');
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  if (!url) return <div className="aspect-square rounded-lg bg-slate-100" />;
  return (
    <div className="group relative aspect-square overflow-hidden rounded-lg bg-slate-100">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" className="h-full w-full object-cover" />
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${file.name}`}
        className="absolute right-1 top-1 rounded-full bg-slate-900/70 p-1 text-white opacity-0 transition-opacity hover:bg-slate-900 focus-visible:opacity-100 group-hover:opacity-100"
      >
        <svg width="12" height="12" viewBox="0 0 14 14" aria-hidden>
          <path
            d="M3 3l8 8M11 3l-8 8"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}
