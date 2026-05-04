'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { toast, Button } from '@boost/ui';
import { Camera, Upload, X, Check, Lock, ArrowRight } from 'lucide-react';
import { Shell } from '@/components/portal/Shell';
import { api } from '@/lib/portal/api';
import { handlePortalAuthError, ALLOW_MOCK_FALLBACK } from '@/lib/portal/auth';
import { mockClients } from '@boost/core';
import { useSubscription } from '@/lib/portal/subscription';
import { useTierGate } from '@/lib/portal/tier-gate';

interface PendingUpload {
  id: string;
  file: File;
  url: string;
  tag: string;
  progress: number;
  done: boolean;
  error?: string;
}

const TAGS = ['product', 'team', 'workspace', 'event', 'other'];
const MAX_PER_BATCH = 10;
const MAX_SIZE_MB = 15;

export default function UploadPage() {
  // Upload is a social-pipeline thing. Website-only clients get redirected
  // to /dashboard rather than landing here with nothing to do.
  useTierGate(['social_only', 'full_package']);

  const { subscription } = useSubscription();
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [uploads, setUploads] = useState<PendingUpload[]>([]);
  const [dragOver, setDragOver] = useState(false);

  // Revoke all object URLs on unmount to prevent memory leaks.
  useEffect(() => {
    return () => {
      for (const u of uploads) URL.revokeObjectURL(u.url);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const accepted: PendingUpload[] = [];
    for (const f of Array.from(files).slice(0, MAX_PER_BATCH)) {
      if (!f.type.startsWith('image/')) continue;
      if (f.size > MAX_SIZE_MB * 1024 * 1024) {
        toast.error('Too large', `${f.name} is over ${MAX_SIZE_MB}MB`);
        continue;
      }
      accepted.push({
        id: `${Date.now()}-${accepted.length}`,
        file: f,
        url: URL.createObjectURL(f),
        tag: 'product',
        progress: 0,
        done: false,
      });
    }
    if (accepted.length === 0) return;
    setUploads((prev) => [...prev, ...accepted]);
    uploadBatch(accepted);
  };

  const uploadBatch = async (batch: PendingUpload[]) => {
    let clientId: string;
    try {
      const me = await api.getMyClient();
      clientId = me.id;
    } catch (err) {
      handlePortalAuthError(err);
      if (!ALLOW_MOCK_FALLBACK) {
        // handlePortalAuthError already redirected for auth errors.
        // Non-auth failures: drop the batch and surface a toast; the
        // user can retry once the network settles.
        toast.error('Could not upload', 'Something went wrong — try again in a moment.');
        // Clear the pending rows we just added so they don't sit as "stuck".
        const ids = new Set(batch.map((b) => b.id));
        setUploads((prev) => {
          for (const u of prev) if (ids.has(u.id)) URL.revokeObjectURL(u.url);
          return prev.filter((u) => !ids.has(u.id));
        });
        return;
      }
      clientId = mockClients[0]!.id;
    }
    for (const item of batch) {
      try {
        await api.uploadImagesWithProgress(
          clientId,
          [item.file],
          [item.tag],
          (percent) => {
            setUploads((prev) =>
              prev.map((u) =>
                u.id === item.id && !u.done ? { ...u, progress: percent } : u,
              ),
            );
          },
        );
        setUploads((prev) =>
          prev.map((u) => (u.id === item.id ? { ...u, progress: 100, done: true } : u)),
        );
        toast.success('Uploaded', item.file.name);
      } catch (e) {
        setUploads((prev) =>
          prev.map((u) =>
            u.id === item.id ? { ...u, progress: 100, done: true, error: (e as Error).message } : u,
          ),
        );
        toast.error('Upload failed', item.file.name);
      }
    }
  };

  const setTag = (id: string, tag: string) =>
    setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, tag } : u)));

  const remove = (id: string) =>
    setUploads((prev) => {
      const target = prev.find((u) => u.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((u) => u.id !== id);
    });

  const locked = subscription ? !subscription.active : false;
  // Show in-flight state when any upload is still running. Lets the page
  // dim the "take photo" / "from gallery" controls so mid-upload the user
  // isn't tempted to queue more files at the same time.
  const busy = uploads.some((u) => !u.done);

  return (
    <Shell
      title="Upload photos"
      subtitle={locked ? 'Paid feature' : `Max ${MAX_PER_BATCH} files · ${MAX_SIZE_MB}MB each`}
    >
      {locked ? (
        <LockedUploadState />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              disabled={busy}
              className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-[#48D886] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-slate-200"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-cta text-white">
                <Camera className="h-5 w-5" />
              </div>
              <div className="text-sm font-semibold text-slate-900">Take photo</div>
            </button>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-[#48D886] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-slate-200"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-white">
                <Upload className="h-5 w-5" />
              </div>
              <div className="text-sm font-semibold text-slate-900">From gallery</div>
            </button>
          </div>

          <div
            onDragOver={(e) => {
              if (busy) return;
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              if (busy) return;
              e.preventDefault();
              setDragOver(false);
              addFiles(e.dataTransfer.files);
            }}
            className={`mt-4 rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${
              busy
                ? 'border-slate-200 bg-slate-50 opacity-60'
                : dragOver
                  ? 'border-[#48D886] bg-[#48D886]/5'
                  : 'border-slate-300 bg-white'
            }`}
          >
            <p className="text-sm text-slate-600">
              {busy ? 'Uploading — hold on a moment' : 'Or drag & drop here'}
            </p>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            hidden
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = '';
            }}
          />

          <AnimatePresence>
            {uploads.length > 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mt-6 space-y-3"
              >
                <h2 className="text-sm font-semibold text-slate-900">
                  {uploads.length} file{uploads.length === 1 ? '' : 's'}
                </h2>
                {uploads.map((u) => (
                  <div
                    key={u.id}
                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
                  >
                    <div className="flex gap-3 p-3">
                      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={u.url} alt="" className="h-full w-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="truncate text-sm font-medium text-slate-900">
                            {u.file.name}
                          </p>
                          <button
                            onClick={() => remove(u.id)}
                            className="rounded-full p-1 text-slate-400 hover:bg-slate-100"
                            aria-label="Remove"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <p className="text-xs text-slate-500">
                          {(u.file.size / 1024 / 1024).toFixed(1)} MB
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {TAGS.map((t) => (
                            <button
                              key={t}
                              onClick={() => setTag(u.id, t)}
                              className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
                                u.tag === t
                                  ? 'bg-[#1D9CA1] text-white'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="h-1 bg-slate-100">
                      <motion.div
                        className={`h-full ${u.error ? 'bg-rose-500' : 'bg-gradient-cta'}`}
                        animate={{ width: `${u.progress}%` }}
                        transition={{ duration: 0.25 }}
                      />
                    </div>
                    {u.done ? (
                      u.error ? (
                        <div className="flex items-center gap-2 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800">
                          <X className="h-3.5 w-3.5" />
                          {u.error}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
                          <Check className="h-3.5 w-3.5" />
                          Received, your team will take it from here
                        </div>
                      )
                    ) : null}
                  </div>
                ))}
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div className="mt-6 rounded-2xl bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">Tips for great posts</h3>
            <ul className="mt-2 space-y-1.5 text-xs text-slate-600">
              <li>• Natural light beats flash almost always.</li>
              <li>• Square or portrait crops work best on Instagram.</li>
              <li>• 10–15 photos a month gives us plenty of variety.</li>
            </ul>
          </div>
        </>
      )}
    </Shell>
  );
}

function LockedUploadState() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gradient-cta text-white shadow-brand">
        <Lock className="h-5 w-5" />
      </div>
      <h2 className="mt-3 text-base font-semibold text-slate-900">
        Photo uploads are a paid feature
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Subscribe to share your photos with us so we can build your monthly content plan.
      </p>
      <Link href="/portal/subscription">
        <Button size="lg" className="mt-5 w-full">
          See plans
          <ArrowRight className="h-4 w-4" />
        </Button>
      </Link>
    </div>
  );
}
