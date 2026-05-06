'use client';

/**
 * Inspiration-driven generation mode.
 *
 * Flow:
 *   1. Client picks inspiration media (upload + library picker, mixable)
 *   2. Optional Claude Vision analysis OR skip to direct brief
 *   3. User picks the output type (image / video / both)
 *   4. User picks a model per type — with price, pros/cons, recommendation
 *   5. Run → shows each generated asset with re-roll, edit, swap model
 *
 * No Remotion templates. AI video comes straight from the selected model
 * (Kling / Hailuo / Seedance / SVD), using the inspiration as the seed
 * image when it makes sense.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import type { ClientImage } from '@boost/core';
import {
  Badge,
  Button,
  Card,
  CardContent,
  Textarea,
  Spinner,
  toast,
} from '@boost/ui';
import {
  Sparkles,
  Upload,
  Image as ImageIcon,
  Video,
  Wand2,
  Eye,
  EyeOff,
  X,
  AlertCircle,
  CheckCircle2,
  RefreshCcw,
  Zap,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Plus,
  ExternalLink,
  Layers,
  Shield,
} from 'lucide-react';
import { api } from '@/lib/dashboard/api';

const isValidUuid = (s: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

/* ═══════════════════════════════════════════════════════════════════ */
/* Types                                                                */
/* ═══════════════════════════════════════════════════════════════════ */

type OutputType = 'image' | 'video' | 'both';
type ImageAR = '1:1' | '4:5' | '9:16' | '16:9';
type VideoAR = '9:16' | '1:1' | '16:9';

interface ModelOption {
  id: string;
  displayName: string;
  mediaType: 'image' | 'video';
  supportsReference: boolean;
  maxReferenceCount: number;
  maxDurationSeconds?: number;
  pricePerUnitCents: number;
  unit: 'second' | 'image';
  recommendation: 'quality' | 'speed' | 'price' | null;
  supportedAspectRatios: Array<'9:16' | '1:1' | '16:9' | '4:5'>;
  available: boolean;
  provider: 'fal' | 'gemini' | 'vertex';
  notes?: string;
}

interface InspirationPick {
  key: string; // UI key
  source: 'upload' | 'library';
  // library source
  libraryId?: string;
  // upload source
  uploadUrl?: string;
  mimeType: string;
  thumbnailUrl: string;
  label?: string;
}

interface GeneratedRecord {
  assetId: string;
  mediaType: 'image' | 'video';
  url: string;
  modelId: string;
  modelDisplayName: string;
  prompt: string;
  costCents: number;
  fromMock: boolean;
}

/* ═══════════════════════════════════════════════════════════════════ */
/* Main component                                                       */
/* ═══════════════════════════════════════════════════════════════════ */

export function InspirationMode({
  clientId,
  businessName,
}: {
  clientId: string;
  businessName?: string;
}) {
  /* ── Remote data ─────────────────────────────────────────────── */

  const { data: models = [] } = useSWR(
    'inspiration:models',
    () => api.listInspirationModels().catch(() => [] as ModelOption[]),
  );

  const { data: library = [] } = useSWR(
    clientId && isValidUuid(clientId) ? ['inspiration:library', clientId] : null,
    () => api.listImages(clientId).catch(() => [] as ClientImage[]),
  );

  /* ── Inspiration set ─────────────────────────────────────────── */

  const [picks, setPicks] = useState<InspirationPick[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  /* ── Analysis ───────────────────────────────────────────────── */

  const [runAnalysis, setRunAnalysis] = useState(true);
  const [direction, setDirection] = useState('');
  const [directBrief, setDirectBrief] = useState('');

  /* ── Output type ─────────────────────────────────────────────── */

  const [outputType, setOutputType] = useState<OutputType>('image');

  /* ── Model selection ─────────────────────────────────────────── */

  const imageModels = useMemo(
    () => models.filter((m) => m.mediaType === 'image'),
    [models],
  );
  const videoModels = useMemo(
    () => models.filter((m) => m.mediaType === 'video'),
    [models],
  );

  const [imageModelId, setImageModelId] = useState('');
  const [videoModelId, setVideoModelId] = useState('');

  // Default model selection:
  //   - If the user has inspiration picks, prefer a reference-capable model
  //     so the style actually transfers. Otherwise prefer quality.
  //   - For video, quality is the default regardless (all video models
  //     in the catalog take a seed image).
  useEffect(() => {
    if (!imageModelId && imageModels.length > 0) {
      const hasRefs = picks.length > 0;
      const pick =
        (hasRefs
          ? imageModels.find((m) => m.available && m.supportsReference)
          : undefined) ??
        imageModels.find((m) => m.available && m.recommendation === 'quality') ??
        imageModels.find((m) => m.available) ??
        imageModels[0];
      if (pick) setImageModelId(pick.id);
    }
    if (!videoModelId && videoModels.length > 0) {
      const pick =
        videoModels.find((m) => m.available && m.recommendation === 'quality') ??
        videoModels.find((m) => m.available) ??
        videoModels[0];
      if (pick) setVideoModelId(pick.id);
    }
  }, [imageModels, videoModels, imageModelId, videoModelId, picks.length]);

  /* ── Per-media options ───────────────────────────────────────── */

  const [imageAspect, setImageAspect] = useState<ImageAR>('4:5');
  const [videoAspect, setVideoAspect] = useState<VideoAR>('9:16');
  const [videoDuration, setVideoDuration] = useState(5);
  const [useInspirationAsVideoSeed, setUseInspirationAsVideoSeed] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  /* ── Run state ───────────────────────────────────────────────── */

  const [running, setRunning] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [phase, setPhase] = useState<string | null>(null);
  const [outputs, setOutputs] = useState<GeneratedRecord[]>([]);
  const [inlineAnalysis, setInlineAnalysis] = useState<{
    style: string;
    mood: string;
    composition: string;
    colorPalette: string[];
    subjectType: string;
    suggestedOutputTypes: Array<'image' | 'video'>;
    suggestedPrompt: string;
    reasoning: string;
    fromMock: boolean;
  } | null>(null);

  /* ── Cost estimate ───────────────────────────────────────────── */

  const [estimateCents, setEstimateCents] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (!imageModelId && !videoModelId) {
        if (!cancelled) setEstimateCents(0);
        return;
      }
      try {
        const res = await api.estimateInspirationCost({
          imageModelId: outputType !== 'video' ? imageModelId || undefined : undefined,
          videoModelId: outputType !== 'image' ? videoModelId || undefined : undefined,
          videoDurationSeconds: videoDuration,
          outputType,
        });
        if (!cancelled) setEstimateCents(res.costCents);
      } catch {
        if (!cancelled) setEstimateCents(0);
      }
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [imageModelId, videoModelId, outputType, videoDuration]);

  /* ── Handlers ────────────────────────────────────────────────── */

  const handleFileUpload = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      if (!clientId || !isValidUuid(clientId)) {
        toast.error('Pick a real client first');
        return;
      }
      const remaining = 14 - picks.length;
      if (remaining <= 0) {
        toast.error('Max 14 inspiration items reached');
        return;
      }
      const chosen = Array.from(files).slice(0, remaining);
      try {
        const uploaded = await api.uploadInspirationFiles(clientId, chosen);
        setPicks((prev) => [
          ...prev,
          ...uploaded.map((u, i) => ({
            key: `upload-${Date.now()}-${i}`,
            source: 'upload' as const,
            uploadUrl: u.url,
            thumbnailUrl: u.url,
            mimeType: u.mimeType,
            label: u.fileName,
          })),
        ]);
        toast.success(`${uploaded.length} added`);
      } catch (e) {
        toast.error('Upload failed', (e as Error).message);
      }
    },
    [clientId, picks.length],
  );

  const addLibraryItem = (img: ClientImage) => {
    if (picks.length >= 14) {
      toast.error('Max 14 inspiration items reached');
      return;
    }
    if (picks.some((p) => p.source === 'library' && p.libraryId === img.id)) return;
    setPicks((prev) => [
      ...prev,
      {
        key: `library-${img.id}`,
        source: 'library',
        libraryId: img.id,
        thumbnailUrl: img.fileUrl,
        mimeType: img.mimeType ?? 'image/jpeg',
        label: img.aiDescription ?? img.fileName ?? undefined,
      },
    ]);
  };

  const removePick = (key: string) => {
    setPicks((prev) => prev.filter((p) => p.key !== key));
  };

  const runAnalyseOnly = async () => {
    if (picks.length === 0) {
      toast.error('Add inspiration first');
      return;
    }
    setAnalysisLoading(true);
    setInlineAnalysis(null);
    try {
      const items = picks.map((p) => ({
        id: p.key,
        url: p.thumbnailUrl,
        mimeType: p.mimeType,
        label: p.label,
      }));
      const res = await api.analyzeInspiration({
        items,
        direction: direction.trim() || undefined,
      });
      setInlineAnalysis(res);
      // Pre-pick the suggested output type if the user hasn't changed it.
      if (res.suggestedOutputTypes.length === 2) setOutputType('both');
      else if (res.suggestedOutputTypes[0]) setOutputType(res.suggestedOutputTypes[0]);
      toast.success(res.fromMock ? 'Mock analysis ready' : 'Analysis ready');
    } catch (e) {
      toast.error('Analysis failed', (e as Error).message);
    } finally {
      setAnalysisLoading(false);
    }
  };

  const generate = async () => {
    if (!clientId || !isValidUuid(clientId)) {
      toast.error('Pick a real client first');
      return;
    }
    if (runAnalysis && picks.length === 0) {
      toast.error('Add inspiration or switch to the direct brief path');
      return;
    }
    if (!runAnalysis && directBrief.trim().length < 10) {
      toast.error('Write a brief of at least 10 characters');
      return;
    }
    if ((outputType === 'image' || outputType === 'both') && !imageModelId) {
      toast.error('Pick an image model');
      return;
    }
    if ((outputType === 'video' || outputType === 'both') && !videoModelId) {
      toast.error('Pick a video model');
      return;
    }

    setRunning(true);
    setPhase('starting…');
    setOutputs([]);
    try {
      const inspiration = picks.map((p) =>
        p.source === 'library'
          ? ({ kind: 'library', id: p.libraryId! } as const)
          : ({
              kind: 'upload',
              url: p.uploadUrl!,
              mimeType: p.mimeType,
              label: p.label,
            } as const),
      );

      const result = await api.generateFromInspiration({
        clientId,
        inspiration,
        runAnalysis,
        directBrief: !runAnalysis ? directBrief.trim() : direction.trim() || undefined,
        outputType,
        imageModelId: outputType !== 'video' ? imageModelId : undefined,
        videoModelId: outputType !== 'image' ? videoModelId : undefined,
        imageAspectRatio: imageAspect,
        videoAspectRatio: videoAspect,
        videoDurationSeconds: videoDuration,
        useInspirationAsVideoSeed,
      });

      setOutputs(result.outputs);
      if (result.analysis) setInlineAnalysis(result.analysis);
      toast.success(
        `Generated ${result.outputs.length} asset${result.outputs.length === 1 ? '' : 's'}`,
        result.fromMock ? 'Mock mode — add API keys for real output' : undefined,
      );
    } catch (e) {
      toast.error('Generation failed', (e as Error).message);
    } finally {
      setRunning(false);
      setPhase(null);
    }
  };

  /* ── Derived ─────────────────────────────────────────────────── */

  const selectedImageModel = imageModels.find((m) => m.id === imageModelId);
  const selectedVideoModel = videoModels.find((m) => m.id === videoModelId);

  const canGenerate = useMemo(() => {
    if (running) return false;
    if (!clientId || !isValidUuid(clientId)) return false;
    if (runAnalysis && picks.length === 0) return false;
    if (!runAnalysis && directBrief.trim().length < 10) return false;
    if ((outputType === 'image' || outputType === 'both') && !imageModelId) return false;
    if ((outputType === 'video' || outputType === 'both') && !videoModelId) return false;
    return true;
  }, [running, clientId, runAnalysis, picks.length, directBrief, outputType, imageModelId, videoModelId]);

  /* ═════════════════════════════════════════════════════════════ */

  if (!clientId || !isValidUuid(clientId)) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Sparkles className="mx-auto h-10 w-10 text-slate-300" />
          <h3 className="mt-3 text-sm font-semibold text-slate-900">Pick a client first</h3>
          <p className="mx-auto mt-2 max-w-md text-xs text-slate-500">
            Inspiration-driven generation needs a selected client so we can save the output to
            their media library.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_420px]">
      {/* ═══════════ LEFT COLUMN ═══════════ */}

      <div className="space-y-4">
        {/* STEP 1 — Inspiration */}
        <Card>
          <CardContent className="p-5 md:p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1D9CA1]/10 text-[11px] font-bold text-[#1D9CA1]">
                    1
                  </span>
                  <h2 className="text-sm font-semibold text-slate-900">Inspiration</h2>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Upload references or pick from {businessName ?? 'the client'}&apos;s library.
                  Style, mood, and composition will guide the output. Up to 14 items.
                </p>
              </div>
              <Badge tone="brand">{picks.length}/14</Badge>
            </div>

            {/* Upload + Library buttons */}
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
                multiple
                className="hidden"
                onChange={(e) => {
                  handleFileUpload(e.target.files);
                  e.target.value = '';
                }}
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={picks.length >= 14}
              >
                <Upload className="h-3.5 w-3.5" />
                Upload files
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowPicker((v) => !v)}
                disabled={picks.length >= 14}
              >
                <Layers className="h-3.5 w-3.5" />
                {showPicker ? 'Hide library' : 'Pick from library'}
              </Button>
            </div>

            {/* Picks grid */}
            {picks.length > 0 ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-7">
                {picks.map((p) => {
                  const isVideo = p.mimeType.startsWith('video/');
                  return (
                    <div
                      key={p.key}
                      className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
                    >
                      {isVideo ? (
                        /* eslint-disable-next-line jsx-a11y/media-has-caption */
                        <video
                          src={p.thumbnailUrl}
                          muted
                          playsInline
                          preload="metadata"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={p.thumbnailUrl}
                          alt={p.label ?? ''}
                          className="h-full w-full object-cover"
                        />
                      )}
                      <button
                        onClick={() => removePick(p.key)}
                        className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100"
                        title="Remove"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      {p.source === 'library' ? (
                        <span className="absolute left-1 top-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] font-medium text-white">
                          library
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-xl border-2 border-dashed border-slate-200 p-4 text-xs text-slate-500">
                <ImageIcon className="h-5 w-5 text-slate-300" />
                No inspiration yet. Add at least one item to use the analysis path, or skip
                analysis below.
              </div>
            )}

            {/* Library picker panel */}
            <AnimatePresence>
              {showPicker ? (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  {library.length === 0 ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                      No media in this client&apos;s library yet. Upload from{' '}
                      <Link href="/dashboard/media" className="underline">
                        Media
                      </Link>{' '}
                      or drop files above.
                    </div>
                  ) : (
                    <div className="grid max-h-60 grid-cols-4 gap-2 overflow-y-auto rounded-xl border border-slate-200 p-3 sm:grid-cols-6 md:grid-cols-8">
                      {library.map((img) => {
                        const isVideo = (img.mimeType ?? '').startsWith('video/');
                        const picked = picks.some(
                          (p) => p.source === 'library' && p.libraryId === img.id,
                        );
                        return (
                          <button
                            key={img.id}
                            onClick={() => addLibraryItem(img)}
                            disabled={picked}
                            className={`group relative aspect-square overflow-hidden rounded-md border transition-all ${
                              picked
                                ? 'border-[#48D886] opacity-60 ring-2 ring-[#48D886]/40'
                                : 'border-slate-200 hover:border-[#1D9CA1]'
                            }`}
                            title={img.aiDescription ?? img.fileName ?? ''}
                          >
                            {isVideo ? (
                              /* eslint-disable-next-line jsx-a11y/media-has-caption */
                              <video
                                src={img.fileUrl}
                                muted
                                playsInline
                                preload="metadata"
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={img.fileUrl}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            )}
                            {picked ? (
                              <CheckCircle2 className="absolute right-1 top-1 h-4 w-4 text-[#48D886]" />
                            ) : (
                              <Plus className="absolute right-1 top-1 h-4 w-4 text-white drop-shadow opacity-0 group-hover:opacity-100" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </CardContent>
        </Card>

        {/* STEP 2 — Analysis path vs direct brief */}
        <Card>
          <CardContent className="p-5 md:p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1D9CA1]/10 text-[11px] font-bold text-[#1D9CA1]">
                    2
                  </span>
                  <h2 className="text-sm font-semibold text-slate-900">Brief</h2>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Use Claude Vision to analyse your inspiration, or skip to a direct brief.
                </p>
              </div>
              <div className="flex gap-1 rounded-full border border-slate-200 bg-white p-1 text-[11px]">
                <button
                  onClick={() => setRunAnalysis(true)}
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1 font-medium ${
                    runAnalysis ? 'bg-slate-900 text-white' : 'text-slate-600'
                  }`}
                >
                  <Eye className="h-3 w-3" />
                  Analysis
                </button>
                <button
                  onClick={() => setRunAnalysis(false)}
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1 font-medium ${
                    !runAnalysis ? 'bg-slate-900 text-white' : 'text-slate-600'
                  }`}
                >
                  <EyeOff className="h-3 w-3" />
                  Skip
                </button>
              </div>
            </div>

            {runAnalysis ? (
              <>
                <div>
                  <label className="text-xs font-medium text-slate-600">
                    Direction <span className="text-slate-400">(optional)</span>
                  </label>
                  <Textarea
                    rows={2}
                    value={direction}
                    onChange={(e) => setDirection(e.target.value)}
                    maxLength={1000}
                    placeholder="Nudge the analysis, e.g. 'keep it warm and editorial, avoid stock-photo feel.'"
                    className="mt-1 text-sm"
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] text-slate-500">
                    Analysis looks at up to 6 references and returns a style brief.
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={runAnalyseOnly}
                    disabled={analysisLoading || picks.length === 0}
                  >
                    {analysisLoading ? <Spinner /> : <Wand2 className="h-3.5 w-3.5" />}
                    Preview analysis
                  </Button>
                </div>

                {/* Analysis inline display */}
                {inlineAnalysis ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        {inlineAnalysis.fromMock ? 'Mock analysis' : 'Vision analysis'}
                      </p>
                      <button
                        onClick={() => setInlineAnalysis(null)}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                    <dl className="mt-2 space-y-1 text-xs">
                      <Row label="Style" value={inlineAnalysis.style} />
                      <Row label="Mood" value={inlineAnalysis.mood} />
                      <Row label="Composition" value={inlineAnalysis.composition} />
                      <Row label="Subject" value={inlineAnalysis.subjectType} />
                      <Row
                        label="Palette"
                        value={inlineAnalysis.colorPalette.join(', ')}
                      />
                      <Row
                        label="Suggests"
                        value={inlineAnalysis.suggestedOutputTypes.join(' + ')}
                      />
                      <div>
                        <span className="text-[10px] font-medium uppercase text-slate-400">
                          Prompt
                        </span>
                        <p className="mt-0.5 rounded-lg bg-white p-2 font-mono text-[11px] text-slate-700">
                          {inlineAnalysis.suggestedPrompt}
                        </p>
                      </div>
                    </dl>
                  </div>
                ) : null}
              </>
            ) : (
              <div>
                <label className="text-xs font-medium text-slate-600">
                  Direct brief{' '}
                  <span className="text-slate-400">(be specific: subject, light, mood)</span>
                </label>
                <Textarea
                  rows={4}
                  value={directBrief}
                  onChange={(e) => setDirectBrief(e.target.value)}
                  maxLength={2000}
                  placeholder="e.g. Slow push-in on a steaming espresso cup on weathered walnut, morning window light from the left, shallow depth of field, muted warm palette, no text or logos."
                  className="mt-1 text-sm"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  Inspiration items still pass through as visual reference when the selected
                  model supports it.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* STEP 3 — Output type */}
        <Card>
          <CardContent className="p-5 md:p-6 space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1D9CA1]/10 text-[11px] font-bold text-[#1D9CA1]">
                3
              </span>
              <h2 className="text-sm font-semibold text-slate-900">Output type</h2>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <OutputTypeCard
                active={outputType === 'image'}
                onClick={() => setOutputType('image')}
                icon={ImageIcon}
                label="Image"
                hint="A single still"
              />
              <OutputTypeCard
                active={outputType === 'video'}
                onClick={() => setOutputType('video')}
                icon={Video}
                label="Video"
                hint="A 2–12s clip"
              />
              <OutputTypeCard
                active={outputType === 'both'}
                onClick={() => setOutputType('both')}
                icon={Sparkles}
                label="Both"
                hint="Image + video"
              />
            </div>
          </CardContent>
        </Card>

        {/* STEP 4 — Models */}
        <Card>
          <CardContent className="p-5 md:p-6 space-y-4">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1D9CA1]/10 text-[11px] font-bold text-[#1D9CA1]">
                4
              </span>
              <h2 className="text-sm font-semibold text-slate-900">Models</h2>
            </div>

            {outputType === 'image' || outputType === 'both' ? (
              <>
                <ModelPicker
                  label="Image model"
                  mediaType="image"
                  models={imageModels}
                  selectedId={imageModelId}
                  onSelect={setImageModelId}
                />
                {picks.length > 0 && selectedImageModel && !selectedImageModel.supportsReference ? (
                  <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-800">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                    <span>
                      {selectedImageModel.displayName} doesn&apos;t accept reference images. The
                      inspiration will only influence the prompt via the vision analysis.
                      Switch to Flux Kontext Max for direct style transfer.
                    </span>
                  </div>
                ) : null}
              </>
            ) : null}

            {outputType === 'video' || outputType === 'both' ? (
              <ModelPicker
                label="Video model"
                mediaType="video"
                models={videoModels}
                selectedId={videoModelId}
                onSelect={setVideoModelId}
              />
            ) : null}
          </CardContent>
        </Card>

        {/* STEP 5 — Fine-tune */}
        <Card>
          <CardContent className="p-5 md:p-6 space-y-4">
            <button
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex w-full items-center justify-between text-left"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1D9CA1]/10 text-[11px] font-bold text-[#1D9CA1]">
                  5
                </span>
                <h2 className="text-sm font-semibold text-slate-900">Fine-tune</h2>
              </div>
              {showAdvanced ? (
                <ChevronUp className="h-4 w-4 text-slate-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-400" />
              )}
            </button>

            {showAdvanced ? (
              <div className="space-y-4">
                {/* Image */}
                {outputType === 'image' || outputType === 'both' ? (
                  <div className="rounded-xl border border-slate-200 p-3">
                    <p className="text-xs font-semibold text-slate-900">Image</p>
                    <div className="mt-2">
                      <label className="text-[11px] font-medium text-slate-600">
                        Aspect ratio
                      </label>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {(['1:1', '4:5', '9:16', '16:9'] as const).map((ar) => (
                          <ArPill
                            key={ar}
                            value={ar}
                            selected={imageAspect === ar}
                            supported={
                              selectedImageModel?.supportedAspectRatios.includes(ar) ?? true
                            }
                            onClick={() => setImageAspect(ar)}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Video */}
                {outputType === 'video' || outputType === 'both' ? (
                  <div className="rounded-xl border border-slate-200 p-3 space-y-3">
                    <p className="text-xs font-semibold text-slate-900">Video</p>
                    <div>
                      <label className="text-[11px] font-medium text-slate-600">
                        Aspect ratio
                      </label>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {(['9:16', '1:1', '16:9'] as const).map((ar) => (
                          <ArPill
                            key={ar}
                            value={ar}
                            selected={videoAspect === ar}
                            supported={
                              selectedVideoModel?.supportedAspectRatios.includes(ar) ?? true
                            }
                            onClick={() => setVideoAspect(ar)}
                          />
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-slate-600">
                        Duration: {videoDuration}s
                        {selectedVideoModel?.maxDurationSeconds
                          ? ` (max ${selectedVideoModel.maxDurationSeconds}s)`
                          : ''}
                      </label>
                      <input
                        type="range"
                        min={2}
                        max={selectedVideoModel?.maxDurationSeconds ?? 10}
                        step={1}
                        value={videoDuration}
                        onChange={(e) => setVideoDuration(Number(e.target.value))}
                        className="mt-2 w-full accent-[#1D9CA1]"
                      />
                    </div>
                    <label className="flex cursor-pointer items-start gap-2 text-[11px]">
                      <input
                        type="checkbox"
                        checked={useInspirationAsVideoSeed}
                        onChange={(e) => setUseInspirationAsVideoSeed(e.target.checked)}
                        className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-[#1D9CA1]"
                      />
                      <span className="text-slate-600">
                        Use the first inspiration image as the video&apos;s opening frame.
                        Otherwise we generate a seed still from the brief.
                      </span>
                    </label>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-[11px] text-slate-400">
                Aspect ratio, duration, video seeding — all hidden until you need them.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ═══════════ RIGHT COLUMN — Run panel + outputs ═══════════ */}

      <aside className="space-y-4">
        <Card>
          <CardContent className="p-5 md:p-6">
            <div className="flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-[#1D9CA1]" />
              <h3 className="text-sm font-semibold text-slate-900">Ready to generate</h3>
            </div>

            <dl className="mt-3 space-y-1.5 text-xs">
              <SummaryRow label="Inspiration" value={`${picks.length} item${picks.length === 1 ? '' : 's'}`} />
              <SummaryRow label="Path" value={runAnalysis ? 'Vision analysis' : 'Direct brief'} />
              <SummaryRow label="Output" value={outputType} />
              {outputType !== 'video' && selectedImageModel ? (
                <SummaryRow label="Image model" value={selectedImageModel.displayName} />
              ) : null}
              {outputType !== 'image' && selectedVideoModel ? (
                <SummaryRow
                  label="Video model"
                  value={`${selectedVideoModel.displayName} · ${videoDuration}s`}
                />
              ) : null}
            </dl>

            <div className="mt-4 rounded-xl bg-gradient-to-br from-[#1D9CA1]/10 to-[#48D886]/10 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Estimated cost
              </p>
              <p className="mt-0.5 text-xl font-bold text-slate-900">
                ${(estimateCents / 100).toFixed(2)}
              </p>
            </div>

            <Button
              onClick={generate}
              disabled={!canGenerate}
              className="mt-4 w-full"
              size="lg"
            >
              {running ? <Spinner /> : <Sparkles className="h-4 w-4" />}
              {running ? (phase ?? 'Running…') : 'Generate'}
            </Button>

            <p className="mt-2 flex items-start gap-1.5 text-[11px] text-slate-500">
              <Shield className="mt-0.5 h-3 w-3 flex-shrink-0" />
              Truthful mode — no fabricated names, dates, or events in the output.
            </p>
          </CardContent>
        </Card>

        {/* Outputs */}
        {outputs.length > 0 ? (
          <div className="space-y-3">
            {outputs.map((out, i) => (
              <OutputCard
                key={`${out.assetId}-${i}`}
                output={out}
                onReroll={() => generate()}
                disabled={running}
              />
            ))}
          </div>
        ) : null}
      </aside>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/* Sub-components                                                        */
/* ═══════════════════════════════════════════════════════════════════ */

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <dt className="w-20 flex-shrink-0 text-[10px] font-medium uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd className="text-slate-700">{value}</dd>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium capitalize text-slate-900">{value}</dd>
    </div>
  );
}

function OutputTypeCard({
  active,
  onClick,
  icon: Icon,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof ImageIcon;
  label: string;
  hint: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border p-3 text-left transition-all ${
        active
          ? 'border-[#1D9CA1] bg-[#1D9CA1]/5 ring-1 ring-[#1D9CA1]/30'
          : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      <Icon className={`h-4 w-4 ${active ? 'text-[#1D9CA1]' : 'text-slate-500'}`} />
      <p className="mt-2 text-xs font-semibold text-slate-900">{label}</p>
      <p className="mt-0.5 text-[10px] text-slate-500">{hint}</p>
    </button>
  );
}

function ArPill({
  value,
  selected,
  supported,
  onClick,
}: {
  value: string;
  selected: boolean;
  supported: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!supported}
      title={!supported ? 'Not supported by the selected model' : undefined}
      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all ${
        selected
          ? 'border-transparent bg-slate-900 text-white'
          : supported
            ? 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
            : 'border-slate-100 bg-slate-50 text-slate-300'
      }`}
    >
      {value}
    </button>
  );
}

function ModelPicker({
  label,
  mediaType,
  models,
  selectedId,
  onSelect,
}: {
  label: string;
  mediaType: 'image' | 'video';
  models: ModelOption[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  if (models.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        <AlertCircle className="inline h-3.5 w-3.5" /> No {mediaType} models available.
      </div>
    );
  }
  return (
    <div>
      <p className="text-xs font-medium text-slate-600">{label}</p>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {models.map((m) => (
          <ModelCard
            key={m.id}
            model={m}
            selected={m.id === selectedId}
            onSelect={() => onSelect(m.id)}
          />
        ))}
      </div>
    </div>
  );
}

function ModelCard({
  model,
  selected,
  onSelect,
}: {
  model: ModelOption;
  selected: boolean;
  onSelect: () => void;
}) {
  const priceLabel = formatPrice(model);
  const RecIcon =
    model.recommendation === 'quality'
      ? Sparkles
      : model.recommendation === 'speed'
        ? Zap
        : model.recommendation === 'price'
          ? DollarSign
          : null;
  return (
    <button
      onClick={onSelect}
      disabled={!model.available}
      className={`relative overflow-hidden rounded-xl border p-3 text-left transition-all disabled:cursor-not-allowed ${
        selected
          ? 'border-[#1D9CA1] bg-[#1D9CA1]/5 ring-1 ring-[#1D9CA1]/30'
          : model.available
            ? 'border-slate-200 bg-white hover:border-slate-300'
            : 'border-slate-100 bg-slate-50 opacity-60'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <p className="text-xs font-semibold text-slate-900">{model.displayName}</p>
          <p className="mt-0.5 text-[10px] text-slate-500 line-clamp-2">
            {model.notes ?? ''}
          </p>
        </div>
        {RecIcon ? (
          <span
            className={`inline-flex flex-shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase ${
              model.recommendation === 'quality'
                ? 'bg-[#1D9CA1]/10 text-[#1D9CA1]'
                : model.recommendation === 'speed'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-emerald-100 text-emerald-700'
            }`}
          >
            <RecIcon className="h-2.5 w-2.5" />
            {model.recommendation}
          </span>
        ) : null}
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px]">
        <span className="font-semibold text-slate-900">{priceLabel}</span>
        <span className="text-slate-400">
          {model.supportsReference
            ? `refs up to ${model.maxReferenceCount}`
            : 'no reference'}
        </span>
      </div>
      {!model.available ? (
        <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-[1px]">
          <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white">
            credentials required
          </span>
        </div>
      ) : null}
    </button>
  );
}

function formatPrice(m: ModelOption): string {
  // Image models: show cents for clarity (most are < 10¢).
  // Video models: show $/sec even when < 10¢/sec so the unit label reads naturally.
  if (m.pricePerUnitCents < 10 && m.unit === 'image') {
    return `${m.pricePerUnitCents}¢/image`;
  }
  return `$${(m.pricePerUnitCents / 100).toFixed(m.pricePerUnitCents < 10 ? 3 : 2)}/${m.unit}`;
}

function OutputCard({
  output,
  onReroll,
  disabled,
}: {
  output: GeneratedRecord;
  onReroll: () => void;
  disabled: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-3 space-y-2">
        <div className="relative overflow-hidden rounded-lg bg-slate-900" style={{ aspectRatio: '4/5' }}>
          {output.mediaType === 'video' ? (
            /* eslint-disable-next-line jsx-a11y/media-has-caption */
            <video
              src={output.url}
              controls
              className="h-full w-full object-cover"
            />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={output.url} alt="" className="h-full w-full object-cover" />
          )}
          {output.fromMock ? (
            <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white">
              mock
            </span>
          ) : null}
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <div>
            <p className="font-semibold text-slate-900">{output.modelDisplayName}</p>
            <p className="text-[10px] text-slate-500">
              {output.mediaType} · ${(output.costCents / 100).toFixed(2)}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <a
              href={output.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-600 hover:border-slate-300"
              title="Open"
            >
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
            <button
              onClick={onReroll}
              disabled={disabled}
              className="inline-flex items-center gap-0.5 rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-600 hover:border-slate-300 disabled:opacity-50"
              title="Re-roll"
            >
              <RefreshCcw className="h-2.5 w-2.5" />
              Re-roll
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
