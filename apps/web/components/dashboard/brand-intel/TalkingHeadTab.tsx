'use client';

/**
 * AI UGC tab — generate talking-head avatar videos for TikTok/Reels.
 *
 * Flow:
 *   1. User writes a brief + picks target platform & duration.
 *   2. API generates a Claude-written script using brand context,
 *      inspiration profiles, tone pairs, and (optionally) a product.
 *   3. User picks avatar + voice + model + aspect ratio.
 *   4. Render → video URL returned and persisted to Media Studio.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import {
  Button,
  Card,
  CardContent,
  Textarea,
  Spinner,
  Badge,
  toast,
} from '@boost/ui';
import {
  Mic,
  Sparkles,
  Loader2,
  Play,
  Download,
  User,
  Clock,
  DollarSign,
  Package,
  Info,
} from 'lucide-react';
import type { Product } from '@boost/api-client';
import { api } from '@/lib/dashboard/api';

type Platform = 'tiktok' | 'instagram_reels' | 'youtube_shorts' | 'generic';

/** Live word→seconds estimate that matches the server's ~150 wpm calc. */
function estimateSpeakingSeconds(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (words === 0) return 0;
  return Math.max(3, Math.round((words / 150) * 60));
}

export function TalkingHeadTab({ clientId }: { clientId: string }) {
  const { data: options, isLoading: loadingOptions } = useSWR(
    'talking-head:options',
    () => api.talkingHeadOptions(),
  );
  const { data: products } = useSWR<Product[]>(`products:${clientId}`, () =>
    api.listProducts(clientId, 'active'),
  );

  const [brief, setBrief] = useState('');
  const [platform, setPlatform] = useState<Platform>('tiktok');
  const [durationSeconds, setDurationSeconds] = useState(30);
  const [productId, setProductId] = useState<string | undefined>();

  const [script, setScript] = useState('');
  const [generatingScript, setGeneratingScript] = useState(false);
  const scriptAnchorRef = useRef<HTMLDivElement | null>(null);

  const [avatarId, setAvatarId] = useState<string | undefined>();
  const [modelId, setModelId] = useState<string | undefined>();

  const [rendering, setRendering] = useState(false);
  const [rendered, setRendered] = useState<{
    videoUrl: string;
    durationSeconds: number;
    modelDisplayName: string;
    costCents: number;
    fromMock: boolean;
  } | null>(null);

  // Default selections — run in an effect to avoid "Cannot update during
  // render" React warnings when options stream in. Only sets defaults
  // once per pool so user picks aren't overwritten.
  useEffect(() => {
    if (!options) return;
    if (!avatarId && options.avatars[0]) setAvatarId(options.avatars[0].id);
    if (!modelId && options.models[0]) setModelId(options.models[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options]);

  // Platforms are inherently vertical on mobile-first feeds. Narrow the
  // avatar roster accordingly so users don't accidentally render a 16:9
  // landscape video for a TikTok placement.
  const preferredAspect: '9:16' | '16:9' =
    platform === 'tiktok' || platform === 'instagram_reels' || platform === 'youtube_shorts'
      ? '9:16'
      : '16:9';
  const filteredAvatars = useMemo(() => {
    if (!options) return [];
    const matching = options.avatars.filter((a) => a.aspectRatio === preferredAspect);
    return matching.length > 0 ? matching : options.avatars;
  }, [options, preferredAspect]);

  // If the chosen avatar is filtered out (e.g. user switched platform),
  // fall back to the first compatible one so we don't submit something
  // that'll render the wrong orientation.
  useEffect(() => {
    if (!avatarId || filteredAvatars.length === 0) return;
    const still = filteredAvatars.find((a) => a.id === avatarId);
    if (!still) setAvatarId(filteredAvatars[0]!.id);
  }, [filteredAvatars, avatarId]);

  // Live speaking-time estimate so the cost and duration tiles update
  // as the user edits the script — critical for UX trust. Falls back
  // to the user-set target when no script is written yet.
  const scriptEstimate = useMemo(
    () => (script.trim().length > 0 ? estimateSpeakingSeconds(script) : null),
    [script],
  );
  const effectiveSeconds = scriptEstimate ?? durationSeconds;

  // Auto-scroll to the script area once Claude returns a draft so the
  // user sees the next step without hunting for it.
  useEffect(() => {
    if (script && !generatingScript) {
      scriptAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [script, generatingScript]);

  if (loadingOptions) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size={24} />
      </div>
    );
  }

  async function generateScript() {
    if (brief.trim().length < 10) {
      toast.info('Brief too short', 'Describe what the video should say.');
      return;
    }
    setGeneratingScript(true);
    try {
      const res = await api.generateTalkingHeadScript({
        clientId,
        brief,
        platform,
        durationSeconds,
        productId,
      });
      setScript(res.script);
      if (res.fromMock) {
        toast.info('Using mock Claude', 'Connect ANTHROPIC_API_KEY for tailored scripts.');
      } else {
        toast.success('Script ready');
      }
    } catch (e) {
      toast.error('Script failed', (e as Error).message);
    } finally {
      setGeneratingScript(false);
    }
  }

  async function render() {
    if (!modelId || !avatarId) {
      toast.info('Pick a model and avatar');
      return;
    }
    if (script.trim().length < 10) {
      toast.info('Script too short');
      return;
    }
    const avatar = options?.avatars.find((a) => a.id === avatarId);
    setRendering(true);
    setRendered(null);
    try {
      const res = await api.renderTalkingHead({
        clientId,
        modelId,
        avatarId,
        script,
        // fal.ai bakes aspect ratio into the avatar preset; we still
        // send it so other providers (that take a distinct field) get
        // the right framing.
        aspectRatio: avatar?.aspectRatio === '16:9' ? '16:9' : '9:16',
      });
      setRendered({
        videoUrl: res.videoUrl,
        durationSeconds: res.durationSeconds,
        modelDisplayName: res.modelDisplayName,
        costCents: res.costCents,
        fromMock: res.fromMock,
      });
      if (res.fromMock) {
        toast.info('Preview render', 'Connect FAL_KEY for real avatar video.');
      } else {
        toast.success('Video rendered', 'Saved to the client media library.');
      }
    } catch (e) {
      toast.error('Render failed', (e as Error).message);
    } finally {
      setRendering(false);
    }
  }

  const selectedModel = options?.models.find((m) => m.id === modelId);
  const estimatedCost = selectedModel
    ? (selectedModel.pricePerSecondCents * effectiveSeconds) / 100
    : null;
  const overDuration =
    selectedModel?.maxDurationSeconds != null &&
    effectiveSeconds > selectedModel.maxDurationSeconds;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 p-2.5 text-white shadow-brand">
              <Mic className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">AI UGC videos</h3>
              <p className="mt-1 text-sm text-slate-600">
                A person-on-camera video that reads your script. Perfect for TikTok &
                Reels. The script is written in your brand voice using everything from the
                Brand Intel tab.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step 1 — Brief */}
      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="flex items-center gap-2">
            <Badge tone="brand">1</Badge>
            <h4 className="text-sm font-semibold text-slate-900">Write the brief</h4>
          </div>

          <Textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="e.g. Announce our new oat milk latte — emphasise that it's fair-trade and launching this Monday only. Hook should feel playful."
            rows={3}
          />

          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="text-xs font-semibold text-slate-600">Platform</label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as Platform)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="tiktok">TikTok</option>
                <option value="instagram_reels">Instagram Reels</option>
                <option value="youtube_shorts">YouTube Shorts</option>
                <option value="generic">Generic</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">
                Target duration: {durationSeconds}s
              </label>
              <input
                type="range"
                min={10}
                max={90}
                step={5}
                value={durationSeconds}
                onChange={(e) => setDurationSeconds(parseInt(e.target.value, 10))}
                className="mt-2 w-full"
                aria-label="Target video duration in seconds"
              />
              <div className="mt-0.5 flex justify-between text-[10px] text-slate-400">
                <span>10s</span>
                <span>30s</span>
                <span>60s</span>
                <span>90s</span>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">
                <Package className="mr-1 inline h-3 w-3" />
                Anchor product (optional)
              </label>
              <select
                value={productId ?? ''}
                onChange={(e) => setProductId(e.target.value || undefined)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">— None —</option>
                {(products ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end">
            <Button size="sm" onClick={generateScript} disabled={generatingScript || brief.trim().length < 10}>
              {generatingScript ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {generatingScript ? 'Writing script…' : 'Generate script'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Step 2 — Script */}
      {script ? (
        <div ref={scriptAnchorRef}>
          <Card>
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge tone="brand">2</Badge>
                  <h4 className="text-sm font-semibold text-slate-900">Review & edit script</h4>
                </div>
                {scriptEstimate != null ? (
                  <span className="flex items-center gap-1 text-xs text-slate-500">
                    <Clock className="h-3 w-3" />
                    ~{scriptEstimate}s speaking ·{' '}
                    {script.trim().split(/\s+/).filter(Boolean).length} words
                  </span>
                ) : null}
              </div>
              <Textarea
                value={script}
                onChange={(e) => setScript(e.target.value)}
                rows={8}
                className="font-mono text-sm leading-relaxed"
                aria-label="Avatar script"
              />
              <p className="flex items-start gap-1 text-xs text-slate-500">
                <Info className="mt-0.5 h-3 w-3 shrink-0" />
                The avatar reads this verbatim. Use ellipses (…) for natural pauses.
                Avoid brackets, emoji, and markdown — they&apos;ll be read aloud.
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Step 3 — Casting */}
      {script ? (
        <Card>
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center gap-2">
              <Badge tone="brand">3</Badge>
              <h4 className="text-sm font-semibold text-slate-900">Cast the video</h4>
            </div>

            <div>
              <div className="mb-2 flex items-center gap-1 text-xs font-semibold text-slate-600">
                <User className="h-3 w-3" />
                Avatar — showing {preferredAspect} for {platform.replace('_', ' ')} (voice and
                framing are baked into each preset)
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {filteredAvatars.map((a) => {
                  const active = avatarId === a.id;
                  return (
                    <button
                      key={a.id}
                      onClick={() => setAvatarId(a.id)}
                      className={`rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D9CA1] ${
                        active
                          ? 'border-[#1D9CA1] bg-white shadow-brand'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                      aria-pressed={active}
                    >
                      <div className="flex h-14 w-full items-center justify-center rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 text-xs font-semibold text-slate-500">
                        {a.displayName.slice(0, 1)}
                      </div>
                      <div className="mt-2 truncate text-xs font-semibold text-slate-900">
                        {a.displayName}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {a.gender} · {a.ageRange} · {a.aspectRatio}
                      </div>
                      <div className="mt-0.5 line-clamp-1 text-[10px] italic text-slate-500">
                        {a.vibe}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600">Model</label>
              <select
                value={modelId ?? ''}
                onChange={(e) => setModelId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                {options?.models.map((m) => (
                  <option key={m.id} value={m.id} disabled={!m.available}>
                    {m.displayName}
                    {!m.available ? ' — unavailable' : ` — ${m.pricePerSecondCents}¢/sec`}
                  </option>
                ))}
              </select>
              {selectedModel?.notes ? (
                <p className="mt-1 text-[11px] text-slate-500">{selectedModel.notes}</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-3 rounded-xl bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-slate-500" />
                  Speaking time: <strong>~{effectiveSeconds}s</strong>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-3.5 w-3.5 text-[#1D9CA1]" />
                  Estimated cost:{' '}
                  {estimatedCost != null ? (
                    <strong>${estimatedCost.toFixed(2)}</strong>
                  ) : (
                    <strong>—</strong>
                  )}
                </div>
                {overDuration ? (
                  <div className="flex items-center gap-1 text-amber-700">
                    <Info className="h-3 w-3" />
                    Script exceeds the model&apos;s {selectedModel?.maxDurationSeconds}s cap —
                    consider trimming before rendering.
                  </div>
                ) : null}
              </div>
              <Button
                onClick={render}
                disabled={rendering || !modelId || !avatarId || overDuration}
                size="lg"
              >
                {rendering ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {rendering ? 'Rendering… (can take 60-90s)' : 'Render video'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Step 4 — Output */}
      {rendered ? (
        <Card>
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge tone="success">Done</Badge>
                <h4 className="text-sm font-semibold text-slate-900">Your video</h4>
              </div>
              {rendered.fromMock ? (
                <Badge tone="warning">Preview only</Badge>
              ) : (
                <Badge tone="success">Saved to media library</Badge>
              )}
            </div>
            <div className="overflow-hidden rounded-xl bg-black">
              <video
                src={rendered.videoUrl}
                controls
                playsInline
                className="mx-auto max-h-[70vh] w-auto"
              />
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>
                {rendered.modelDisplayName} · {rendered.durationSeconds}s · $
                {(rendered.costCents / 100).toFixed(2)}
              </span>
              <a
                href={rendered.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                download
                className="inline-flex items-center gap-1 text-[#1D9CA1] hover:underline"
              >
                <Download className="h-3 w-3" />
                Download
              </a>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
