'use client';

/**
 * Generator configuration — per-account.
 *
 * Two blocks:
 *   1. Style Bible — free-form "this is the vibe" guide, dos, donts, motifs,
 *      banned phrases. The biggest anti-slop lever we have.
 *   2. Generator settings — which AI models, which features on/off, quality
 *      tier, aspect ratio, web research toggle. Every knob is optional; we
 *      auto-pick sensible defaults.
 */

import { useRef, useState } from 'react';
import useSWR from 'swr';
import { Save, Sparkles, Info, Zap } from 'lucide-react';
import { Button, Card, CardContent, Input, Textarea, Spinner, toast } from '@boost/ui';
import type {
  PersonalAccount,
  PersonalAccountStyleBible,
  PersonalAiModel,
  PersonalCharacter,
  PersonalGeneratorConfig,
} from '@boost/api-client';
import { api } from '@/lib/dashboard/api';

export function GeneratorConfigPanel({
  account,
  characters,
  onChanged,
}: {
  account: PersonalAccount;
  characters: PersonalCharacter[];
  onChanged: () => void;
}) {
  const { data: models } = useSWR('personal:models', () => api.listPersonalModels());

  const initBible: PersonalAccountStyleBible = account.styleBible ?? {};
  const initGen: PersonalGeneratorConfig = account.generatorConfig ?? {};

  const [vibe, setVibe] = useState(initBible.vibe ?? '');
  const [dos, setDos] = useState<string>((initBible.dos ?? []).join('\n'));
  const [donts, setDonts] = useState<string>((initBible.donts ?? []).join('\n'));
  const [motifs, setMotifs] = useState<string>((initBible.motifs ?? []).join('\n'));
  const [copySamples, setCopySamples] = useState<string>((initBible.copySamples ?? []).join('\n'));
  const [bannedPhrases, setBannedPhrases] = useState<string>(
    (initBible.bannedPhrases ?? []).join('\n'),
  );

  const [gen, setGen] = useState<PersonalGeneratorConfig>(initGen);
  const [characterId, setCharacterId] = useState<string>(account.characterId ?? '');

  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await api.updatePersonalAccount(account.id, {
        characterId: characterId || null,
        styleBible: {
          vibe: vibe.trim() || undefined,
          dos: splitLines(dos),
          donts: splitLines(donts),
          motifs: splitLines(motifs),
          copySamples: splitLines(copySamples),
          bannedPhrases: splitLines(bannedPhrases),
        },
        generatorConfig: gen,
      });
      toast.success('Configuration saved');
      onChanged();
    } catch (e) {
      toast.error('Could not save', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const imageModels = (models ?? []).filter((m) => m.kind === 'image');
  const videoModels = (models ?? []).filter((m) => m.kind === 'video');

  return (
    <div className="space-y-4">
      {/* ── Style bible ───────────────────────────────────── */}
      <Card>
        <CardContent className="p-6">
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-400 to-indigo-500 text-white">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-600">
                Style bible
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Tell the AI exactly what this account is and what it is not. Every script and image will obey this.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <Field label="Vibe" hint="One or two paragraphs describing the feel you want — tone, mood, audience, what sets this account apart.">
              <Textarea
                rows={4}
                value={vibe}
                onChange={(e) => setVibe(e.target.value)}
                placeholder="e.g. 'Confident but never trolly. Finance grounded in research. Think Morning Brew meets a patient older sibling — specific, calm, never hype.'"
              />
            </Field>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Field label="Always do" hint="One rule per line.">
                <Textarea
                  rows={5}
                  value={dos}
                  onChange={(e) => setDos(e.target.value)}
                  placeholder="Cite a source when using a number\nLead with a specific, not a generalisation\nEnd with a concrete takeaway"
                />
              </Field>
              <Field label="Never do" hint="One rule per line — stricter than theme defaults.">
                <Textarea
                  rows={5}
                  value={donts}
                  onChange={(e) => setDonts(e.target.value)}
                  placeholder="No 'dive in', 'unlock', or 'game-changer'\nNo hype emoji\nNever stack more than 2 questions"
                />
              </Field>
              <Field label="Recurring motifs" hint="Visual or written threads the account returns to.">
                <Textarea
                  rows={3}
                  value={motifs}
                  onChange={(e) => setMotifs(e.target.value)}
                  placeholder="Film grain\nHandheld B-roll\nOpen with a question"
                />
              </Field>
              <Field label="Banned phrases" hint="Strings the script must never contain (on top of the built-in list).">
                <Textarea
                  rows={3}
                  value={bannedPhrases}
                  onChange={(e) => setBannedPhrases(e.target.value)}
                  placeholder="let me explain\nmind-blowing\nyou won't believe"
                />
              </Field>
            </div>
            <Field label="Copy samples" hint="Paste 3-8 lines of captions you love. The AI will mimic the rhythm and word choice.">
              <Textarea
                rows={5}
                value={copySamples}
                onChange={(e) => setCopySamples(e.target.value)}
                placeholder='e.g. "Bought a bond you cant touch for 10 years. Made peace with that."\n"The index fund is boring. That is the point."'
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* ── Character attach ───────────────────────────── */}
      <Card>
        <CardContent className="p-6">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-600">
            On-camera persona
          </h3>
          <p className="mb-3 text-xs text-slate-500">
            Attach an AI influencer character. Every image/video for this account will use its face, wardrobe, and voice.
          </p>
          <select
            value={characterId}
            onChange={(e) => setCharacterId(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">— no character (content only) —</option>
            {characters.map((c) => (
              <option key={c.id} value={c.id} disabled={c.status !== 'ready'}>
                {c.name}{' '}
                {c.status !== 'ready' ? ` · ${c.status} (not ready)` : ` · ${c.referenceImageCount} refs`}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {/* ── Custom audio ───────────────────────────────── */}
      <CustomAudioCard account={account} onChanged={onChanged} />

      {/* ── Generator config ───────────────────────────── */}
      <Card>
        <CardContent className="p-6">
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-rose-500 text-white">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-600">
                Generator settings
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Pick models, toggle features, decide the minimum quality bar. Defaults are sensible — leave blank to auto-pick.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Feature toggles */}
            <div className="space-y-2 rounded-xl bg-slate-50 p-4">
              <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-600">
                Features
              </div>
              <Toggle
                label="Voiceover"
                hint="TTS narration over the video"
                value={gen.useVoiceover ?? true}
                onChange={(v) => setGen({ ...gen, useVoiceover: v })}
              />
              <Toggle
                label="Background music"
                hint="Auto-pick a royalty-free track"
                value={gen.useMusic ?? true}
                onChange={(v) => setGen({ ...gen, useMusic: v })}
              />
              <Toggle
                label="Burned-in subtitles"
                hint="On-screen captions for silent viewers"
                value={gen.useSubtitles ?? true}
                onChange={(v) => setGen({ ...gen, useSubtitles: v })}
              />
              <Toggle
                label="Use scraped media"
                hint="Pexels / Unsplash / Wikipedia / News"
                value={gen.useScrapedMedia ?? true}
                onChange={(v) => setGen({ ...gen, useScrapedMedia: v })}
              />
              <Toggle
                label="Generate AI images"
                hint="Fall back to Flux / Nano Banana / Ideogram"
                value={gen.useAiImages ?? true}
                onChange={(v) => setGen({ ...gen, useAiImages: v })}
              />
              <Toggle
                label="Generate AI video"
                hint="Sora / Veo / Kling / Runway for clips (expensive)"
                value={gen.useAiVideo ?? false}
                onChange={(v) => setGen({ ...gen, useAiVideo: v })}
              />
              <Toggle
                label="Use attached character"
                hint="Inject character refs into every generation"
                value={gen.useCharacter ?? true}
                onChange={(v) => setGen({ ...gen, useCharacter: v })}
              />
              <Toggle
                label="Web research before scripting"
                hint="Let Claude browse recent headlines"
                value={gen.allowWebResearch ?? false}
                onChange={(v) => setGen({ ...gen, allowWebResearch: v })}
              />
              <Toggle
                label="Director mode (multi-shot)"
                hint="Plan a shot list, stitch real cuts — more engaging, a bit slower"
                value={gen.useDirector ?? true}
                onChange={(v) => setGen({ ...gen, useDirector: v })}
              />
              <Toggle
                label="Film grain overlay"
                hint="Adds subtle cinematic grain"
                value={gen.filmGrain ?? false}
                onChange={(v) => setGen({ ...gen, filmGrain: v })}
              />
              <Toggle
                label="Letterbox"
                hint="Black cinema bars top + bottom"
                value={gen.letterbox ?? false}
                onChange={(v) => setGen({ ...gen, letterbox: v })}
              />
            </div>

            {/* Model picker + quality */}
            <div className="space-y-3 rounded-xl bg-slate-50 p-4">
              <div className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-600">
                Models & quality
              </div>
              <Field label="Quality tier" hint="'max' forces premium models; 'budget' forces cheapest.">
                <select
                  value={gen.qualityTier ?? 'balanced'}
                  onChange={(e) =>
                    setGen({ ...gen, qualityTier: e.target.value as 'max' | 'balanced' | 'budget' })
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="max">Max — premium models</option>
                  <option value="balanced">Balanced — best mid-tier</option>
                  <option value="budget">Budget — cheapest</option>
                </select>
              </Field>
              <Field label="Image model" hint="Overrides tier for stills.">
                <ModelSelect
                  models={imageModels}
                  value={gen.imageModelId ?? ''}
                  onChange={(v) => setGen({ ...gen, imageModelId: v || undefined })}
                />
              </Field>
              <Field label="Video model" hint="Overrides tier for AI video.">
                <ModelSelect
                  models={videoModels}
                  value={gen.videoModelId ?? ''}
                  onChange={(v) => setGen({ ...gen, videoModelId: v || undefined })}
                />
              </Field>
              <Field label="TTS provider" hint="Which voice engine narrates.">
                <select
                  value={gen.ttsProvider ?? 'elevenlabs'}
                  onChange={(e) =>
                    setGen({
                      ...gen,
                      ttsProvider: e.target.value as 'elevenlabs' | 'openai' | 'cartesia' | 'none',
                    })
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="elevenlabs">ElevenLabs (premium)</option>
                  <option value="openai">OpenAI TTS (good)</option>
                  <option value="none">None (use on-screen text only)</option>
                </select>
              </Field>
              <Field label="Aspect ratio">
                <select
                  value={gen.aspectRatio ?? '9:16'}
                  onChange={(e) =>
                    setGen({ ...gen, aspectRatio: e.target.value as '9:16' | '1:1' | '16:9' | '4:5' })
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="9:16">9:16 — Reels/TikTok/Shorts</option>
                  <option value="1:1">1:1 — feed</option>
                  <option value="16:9">16:9 — YouTube</option>
                  <option value="4:5">4:5 — IG portrait</option>
                </select>
              </Field>
              <Field label="Output format" hint="What kind of post this account ships.">
                <select
                  value={account.formatKind}
                  onChange={(e) => {
                    const fk = e.target.value as 'video' | 'slideshow' | 'static_image';
                    api
                      .updatePersonalAccount(account.id, { formatKind: fk })
                      .then(() => {
                        toast.success('Format updated');
                        onChanged();
                      })
                      .catch((err) => toast.error('Could not update', (err as Error).message));
                  }}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="video">Video — full narrated short</option>
                  <option value="slideshow">Slideshow — image carousel</option>
                  <option value="static_image">Static image — single post</option>
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Clip min (s)">
                  <Input
                    type="number"
                    value={gen.clipMinSeconds ?? 2}
                    onChange={(e) =>
                      setGen({ ...gen, clipMinSeconds: Number(e.target.value) || undefined })
                    }
                    min={1}
                    max={20}
                  />
                </Field>
                <Field label="Clip max (s)">
                  <Input
                    type="number"
                    value={gen.clipMaxSeconds ?? 5}
                    onChange={(e) =>
                      setGen({ ...gen, clipMaxSeconds: Number(e.target.value) || undefined })
                    }
                    min={1}
                    max={30}
                  />
                </Field>
              </div>
              <Field
                label="Minimum quality score (0-100)"
                hint="Posts below this are killed before render. 65 is a strict baseline."
              >
                <Input
                  type="number"
                  value={gen.minQualityScore ?? 65}
                  onChange={(e) =>
                    setGen({ ...gen, minQualityScore: Number(e.target.value) || undefined })
                  }
                  min={0}
                  max={100}
                />
              </Field>
              <Field label="Colour grade" hint="Cinematic tint applied after stitching.">
                <select
                  value={gen.colourGrade ?? 'natural'}
                  onChange={(e) =>
                    setGen({
                      ...gen,
                      colourGrade: e.target.value as PersonalGeneratorConfig['colourGrade'],
                    })
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="natural">Natural (no grade)</option>
                  <option value="warm">Warm (golden hour)</option>
                  <option value="cool">Cool (morning blue)</option>
                  <option value="teal_orange">Teal & Orange (cinematic)</option>
                  <option value="film">Film (vintage curve)</option>
                  <option value="bw">Black &amp; White</option>
                  <option value="high_contrast">High contrast punch</option>
                </select>
              </Field>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4">
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <Info className="h-3 w-3" />
              Any model marked unavailable needs its API key set in .env.
            </div>
            <Button onClick={save} disabled={busy}>
              {busy ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              Save configuration
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Helpers ────────────────────────────────────────────── */

function splitLines(s: string): string[] {
  return s
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-slate-700">
        {label}
        {hint ? <span className="ml-1 font-normal text-slate-400">· {hint}</span> : null}
      </label>
      {children}
    </div>
  );
}

function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-slate-300"
      />
      <span className="flex-1">
        <span className="font-medium text-slate-700">{label}</span>
        {hint ? <span className="ml-1 text-[11px] text-slate-400">— {hint}</span> : null}
      </span>
    </label>
  );
}

function ModelSelect({
  models,
  value,
  onChange,
}: {
  models: PersonalAiModel[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
    >
      <option value="">Auto (based on tier)</option>
      {models.map((m) => (
        <option key={m.id} value={m.id} disabled={!m.available}>
          {m.displayName} · {m.qualityTier}
          {m.available ? '' : ' · unavailable'}
        </option>
      ))}
    </select>
  );
}


/* ═══════════════════════════════════════════════════════════════════ */
/* Custom audio upload                                                  */
/* ═══════════════════════════════════════════════════════════════════ */

function CustomAudioCard({
  account,
  onChanged,
}: {
  account: PersonalAccount;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [attribution, setAttribution] = useState(account.customAudioAttribution ?? '');
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function upload(file: File) {
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      if (attribution.trim()) form.append('attribution', attribution.trim());
      const base = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
      const res = await fetch(`${base}/api/v1/personal/accounts/${account.id}/audio`, {
        method: 'POST',
        credentials: 'include',
        body: form,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(body.error?.message ?? `Upload failed (${res.status})`);
      }
      toast.success('Audio uploaded', 'Every generated post will use this track.');
      onChanged();
    } catch (e) {
      toast.error('Upload failed', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function clearAudio() {
    if (!confirm('Remove the custom audio for this account?')) return;
    setBusy(true);
    try {
      const base = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
      const res = await fetch(`${base}/api/v1/personal/accounts/${account.id}/audio`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(body.error?.message ?? `Remove failed (${res.status})`);
      }
      toast.success('Custom audio removed');
      onChanged();
    } catch (e) {
      toast.error('Could not remove', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-600">
          Custom audio
        </h3>
        <p className="mb-3 text-xs text-slate-500">
          Upload your own music bed (mp3/wav/m4a, ≤25MB). When present, every generated post uses this track instead of the theme music.
        </p>

        {account.customAudioUrl ? (
          <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-emerald-800">Active audio</div>
                <div className="truncate text-xs text-emerald-700">{account.customAudioUrl}</div>
              </div>
              <button
                onClick={clearAudio}
                className="shrink-0 rounded-md bg-white px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50"
                disabled={busy}
              >
                Remove
              </button>
            </div>
            <audio controls src={account.customAudioUrl} className="mt-2 w-full" />
          </div>
        ) : null}

        <div className="space-y-2">
          <label className="block text-xs font-semibold text-slate-700">
            Attribution (optional)
          </label>
          <Input
            value={attribution}
            onChange={(e) => setAttribution(e.target.value)}
            placeholder='e.g. "Song name · Artist — licensed"'
          />
          <input
            ref={inputRef}
            type="file"
            accept="audio/mpeg,audio/wav,audio/mp4,audio/m4a,audio/x-m4a"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
              e.target.value = '';
            }}
          />
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {account.customAudioUrl ? 'Replace audio' : 'Upload audio'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
