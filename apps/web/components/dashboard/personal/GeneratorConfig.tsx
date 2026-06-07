'use client';

/**
 * Generator configuration — per-account.
 *
 * Two blocks:
 *   1. Style Bible — free-form "this is the vibe" guide, dos, donts, title examples,
 *      and optional full reference scripts. The biggest anti-slop lever we have.
 *   2. Generator settings — which AI models, which features on/off, quality
 *      tier, aspect ratio, web research toggle. Every knob is optional; we
 *      auto-pick sensible defaults.
 */

import { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { Plus, Save, Sparkles, Info, Trash2, Zap } from 'lucide-react';
import { Button, Card, CardContent, Input, Textarea, Spinner, toast, confirmDialog } from '@boost/ui';
import type {
  PersonalAccount,
  PersonalAccountStyleBible,
  PersonalAiModel,
  PersonalCharacter,
  PersonalGeneratorConfig,
} from '@boost/api-client';
import { ApiError } from '@boost/api-client';
import { api } from '@/lib/dashboard/api';
import { TTS_VOICE_PRESETS, matchTtsPresetId, ttsPresetOptionLabel } from '@/lib/ttsVoicePresets';

type TitleExampleRow = { id: string; text: string };

function newTitleExampleRowId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `title-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function initExampleTitleRows(bible: PersonalAccountStyleBible): TitleExampleRow[] {
  const titles = (bible.exampleVideoTitles ?? []).map((s) => s.trim()).filter(Boolean);
  if (titles.length === 0) return [{ id: newTitleExampleRowId(), text: '' }];
  return titles.map((text) => ({ id: newTitleExampleRowId(), text }));
}

/** Tiny mock of in-edit slate lower-thirds (not full-screen). */
function NamesNumbersSlatePreview() {
  return (
    <div className="mt-1 rounded-lg border border-slate-200 bg-slate-100/70 p-3">
      <p className="mb-2 text-xs font-semibold text-slate-600">Preview — short lower-third cards</p>
      <div className="relative mx-auto aspect-[9/16] max-h-[200px] w-full max-w-[120px] overflow-hidden rounded-md bg-gradient-to-b from-slate-800 to-slate-950 shadow-inner">
        <div className="absolute bottom-[12%] left-1/2 flex w-[88%] -translate-x-1/2 flex-col items-center gap-1">
          <span className="w-full rounded-md bg-white/95 px-1.5 py-0.5 text-center text-[9px] font-semibold leading-tight tracking-tight text-slate-900 shadow-sm">
            Marie Curie
          </span>
          <span className="w-full rounded-md bg-white/95 px-1.5 py-0.5 text-center text-[9px] font-semibold leading-tight tracking-tight text-slate-900 shadow-sm">
            76%
          </span>
        </div>
      </div>
      <p className="mt-2 text-[11px] leading-snug text-slate-500">
        Shown only when narration hits a high-signal name, date, or figure — each flash is brief. Keyword pop-ups → Bold
        slightly enlarges the card.
      </p>
    </div>
  );
}

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
  const [exampleTitleRows, setExampleTitleRows] = useState<TitleExampleRow[]>(() =>
    initExampleTitleRows(initBible),
  );
  const [videoTitleGuidance, setVideoTitleGuidance] = useState(initBible.videoTitleGuidance ?? '');
  const [referenceScriptSlots, setReferenceScriptSlots] = useState(() =>
    initReferenceScriptSlots(initBible.referenceFullScripts),
  );

  const [gen, setGen] = useState<PersonalGeneratorConfig>(initGen);
  const [characterId, setCharacterId] = useState<string>(account.characterId ?? '');

  const [busy, setBusy] = useState(false);

  // Sort keys so Postgres JSON key order does not thrash the fingerprint and reset the form mid-edit.
  const styleBibleFingerprint = stableRecordFingerprint(account.styleBible);
  const generatorFingerprint = stableRecordFingerprint(account.generatorConfig);

  useEffect(() => {
    const bible = account.styleBible ?? {};
    setVibe(bible.vibe ?? '');
    setDos((bible.dos ?? []).join('\n'));
    setDonts((bible.donts ?? []).join('\n'));
    setExampleTitleRows(initExampleTitleRows(bible));
    setVideoTitleGuidance(bible.videoTitleGuidance ?? '');
    setReferenceScriptSlots(initReferenceScriptSlots(bible.referenceFullScripts));
  }, [account.id, styleBibleFingerprint]);

  useEffect(() => {
    setGen(account.generatorConfig ?? {});
  }, [account.id, generatorFingerprint]);

  useEffect(() => {
    setCharacterId(account.characterId ?? '');
  }, [account.id, account.characterId]);

  async function save() {
    setBusy(true);
    try {
      await api.updatePersonalAccount(account.id, {
        characterId: characterId || null,
        styleBible: {
          ...(account.styleBible ?? {}),
          // Always send (even '') so merge overwrites DB; omitting the key would preserve an old vibe.
          vibe: vibe.trim(),
          dos: splitLines(dos),
          donts: splitLines(donts),
          exampleVideoTitles: exampleTitleRows.map((r) => r.text.trim()).filter(Boolean),
          // Always send a string (may be '') so JSON merge overwrites; omitting the key would leave old DB text.
          videoTitleGuidance: videoTitleGuidance.trim(),
          referenceFullScripts: packReferenceFullScripts(referenceScriptSlots),
        },
        generatorConfig: omitNullShallow(gen as unknown as Record<string, unknown>) as PersonalGeneratorConfig,
      });
      toast.success('Configuration saved');
      onChanged();
    } catch (e) {
      toast.error('Could not save', formatSaveValidationError(e));
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
            </div>
            <Field
              label="Example video titles"
              hint="One field per example. The model studies these for tone, length, and punctuation — then writes a new title per topic. Save configuration before generating."
            >
              <div className="space-y-2">
                {exampleTitleRows.map((row, index) => (
                  <div key={row.id} className="flex gap-2">
                    <Input
                      value={row.text}
                      onChange={(e) => {
                        const v = e.target.value;
                        setExampleTitleRows((rows) =>
                          rows.map((r) => (r.id === row.id ? { ...r, text: v } : r)),
                        );
                      }}
                      placeholder={
                        index === 0
                          ? 'e.g. How Did Ancient Humans Survive Deadly Winters?'
                          : 'Another title in the same style'
                      }
                      className="min-w-0 flex-1 text-sm"
                      maxLength={200}
                    />
                    {exampleTitleRows.length > 1 ? (
                      <button
                        type="button"
                        className="inline-flex shrink-0 items-center justify-center rounded-lg border border-slate-200 px-2 text-rose-600 hover:bg-rose-50"
                        title="Remove this example"
                        onClick={() =>
                          setExampleTitleRows((rows) => rows.filter((r) => r.id !== row.id))
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                ))}
                <Button
                  type="button"
                  variant="secondary"
                  className="h-8 gap-1 px-2 text-xs"
                  disabled={exampleTitleRows.length >= 25}
                  onClick={() =>
                    setExampleTitleRows((rows) =>
                      rows.length >= 25 ? rows : [...rows, { id: newTitleExampleRowId(), text: '' }],
                    )
                  }
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add another title example
                </Button>
              </div>
            </Field>
            <Field
              label="What you want in a title (optional)"
              hint="Extra direction for the headline-only step — e.g. always a question, no clickbait numbers, two-part titles OK. Shown to the model with your examples."
            >
              <Textarea
                rows={3}
                value={videoTitleGuidance}
                onChange={(e) => setVideoTitleGuidance(e.target.value)}
                placeholder='e.g. "Curiosity questions only, no spoiler in the title" or "Match the dry documentary voice of the examples"'
                maxLength={1500}
                className="text-sm"
              />
            </Field>
            <div className="space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <label className="mb-0.5 block text-xs font-semibold text-slate-700">
                    Reference full scripts
                    <span className="ml-1 font-normal text-slate-400">
                      · Up to five. The model matches beat structure, line length, and tone for new topics — never copy lines, jokes, or stats.
                    </span>
                  </label>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="h-8 gap-1 px-2 text-xs"
                  disabled={referenceScriptSlots.length >= 5}
                  onClick={() =>
                    setReferenceScriptSlots((rows) =>
                      rows.length >= 5 ? rows : [...rows, { id: newScriptSlotId(), body: '' }],
                    )
                  }
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add another script
                </Button>
              </div>
              <div className="space-y-3">
                {referenceScriptSlots.map((slot, index) => (
                  <div
                    key={slot.id}
                    className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 shadow-sm"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-600">
                        Script {index + 1}
                        {referenceScriptSlots.length > 1 ? (
                          <span className="ml-1 font-normal text-slate-400">
                            ({slot.body.trim().length} chars)
                          </span>
                        ) : null}
                      </span>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:pointer-events-none disabled:opacity-40"
                        disabled={referenceScriptSlots.length <= 1 && !slot.body.trim()}
                        title={
                          referenceScriptSlots.length <= 1
                            ? 'Clear this script or add another, then remove'
                            : 'Remove this script'
                        }
                        onClick={() =>
                          setReferenceScriptSlots((rows) => {
                            if (rows.length <= 1) {
                              return [{ id: slot.id, body: '' }];
                            }
                            return rows.filter((r) => r.id !== slot.id);
                          })
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove
                      </button>
                    </div>
                    <Textarea
                      rows={8}
                      className="font-mono text-xs"
                      value={slot.body}
                      onChange={(e) => {
                        const v = e.target.value;
                        setReferenceScriptSlots((rows) =>
                          rows.map((r) => (r.id === slot.id ? { ...r, body: v } : r)),
                        );
                      }}
                      placeholder="Paste a full script or transcript. Save configuration when done — the AI uses every non-empty script for inspiration."
                    />
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-slate-500">
                Save configuration at the bottom of this tab to persist scripts. Empty boxes are ignored.
              </p>
            </div>
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
                hint="Off = no bed track in the final mix (custom URL below is ignored while off). On = your custom audio URL if set, otherwise auto-pick a royalty-free track."
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
                label="Live web research before scripting"
                hint="Fetches real Google News headlines + Wikipedia summary for the video topic (internet-backed facts, not the model guessing)"
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
                hint="Final render; when toggled, overrides the director storyboard grain flag."
                value={gen.filmGrain ?? false}
                onChange={(v) => setGen({ ...gen, filmGrain: v })}
              />
              <Toggle
                label="Letterbox"
                hint="Final render; when toggled, overrides the director storyboard letterbox flag."
                value={gen.letterbox ?? false}
                onChange={(v) => setGen({ ...gen, letterbox: v })}
              />
              <Toggle
                label="Ken Burns on stills"
                hint="Subtle zoom on AI/stock photos in the final stitch. Turn off for completely static images."
                value={gen.kenBurnsOnStills !== false}
                onChange={(v) => setGen({ ...gen, kenBurnsOnStills: v })}
              />
              <Toggle
                label="Names & numbers on video"
                hint="Director mode: brief white-panel / dark-text lower-thirds when narration hits an important name, date, or figure — snappy, not full-screen, no opening title reel. Keyword pop-ups (subtle/bold) sets card size."
                value={gen.namesNumbersTitleCard === true}
                onChange={(v) => setGen({ ...gen, namesNumbersTitleCard: v })}
              />
              {gen.namesNumbersTitleCard === true ? <NamesNumbersSlatePreview /> : null}
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
              <Field
                label="Narration voice"
                hint="Each preset sets provider + voice. The text after the em dash is a plain-language sketch of how it usually sounds (not a guarantee). Stock accent/gender applies when this is “Default”. OpenAI presets only work when TTS provider is OpenAI."
              >
                <select
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={matchTtsPresetId(gen)}
                  onChange={(e) => {
                    const id = e.target.value;
                    if (!id) {
                      setGen({ ...gen, ttsVoiceId: undefined });
                      return;
                    }
                    const p = TTS_VOICE_PRESETS.find((x) => x.id === id);
                    if (!p) return;
                    setGen({
                      ...gen,
                      ttsProvider: p.provider,
                      ttsVoiceId: p.voiceId,
                    });
                  }}
                >
                  <option value="">Default (accent/gender below)</option>
                  <optgroup label="ElevenLabs">
                    {TTS_VOICE_PRESETS.filter((x) => x.provider === 'elevenlabs').map((p) => (
                      <option key={p.id} value={p.id}>
                        {ttsPresetOptionLabel(p)}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="OpenAI TTS">
                    {TTS_VOICE_PRESETS.filter((x) => x.provider === 'openai').map((p) => (
                      <option key={p.id} value={p.id}>
                        {ttsPresetOptionLabel(p)}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </Field>
              <Field
                label="Stock voice accent"
                hint="Used when no custom voice ID is set below. British maps to UK-leaning stock voices per provider."
              >
                <select
                  value={gen.voiceAccent ?? 'american'}
                  onChange={(e) =>
                    setGen({ ...gen, voiceAccent: e.target.value as 'american' | 'british' })
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="american">American</option>
                  <option value="british">British (English)</option>
                </select>
              </Field>
              <Field label="Stock voice gender" hint="Used when no custom voice ID is set.">
                <select
                  value={gen.voiceGender ?? 'female'}
                  onChange={(e) =>
                    setGen({ ...gen, voiceGender: e.target.value as 'female' | 'male' })
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                </select>
              </Field>
              <Field
                label="Custom voice ID (optional)"
                hint="Overrides the preset above when set: ElevenLabs voice UUID, or OpenAI name (alloy, echo, fable, onyx, nova, shimmer). Clear this field to use the narration voice dropdown or stock accent/gender."
              >
                <Input
                  value={gen.ttsVoiceId ?? ''}
                  onChange={(e) => setGen({ ...gen, ttsVoiceId: e.target.value.trim() || undefined })}
                  placeholder="default"
                  className="w-full"
                />
              </Field>
              <Field
                label="Speech speed"
                hint="Narration speed where the provider supports it (0.7–1.2). Leave blank for 1.0."
              >
                <Input
                  type="number"
                  step={0.05}
                  value={gen.ttsSpeed ?? ''}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setGen({
                      ...gen,
                      ttsSpeed: raw === '' ? undefined : Number(raw) || undefined,
                    });
                  }}
                  min={0.7}
                  max={1.2}
                  placeholder="1"
                  className="w-full"
                />
              </Field>
              <Toggle
                label="True stories only"
                hint="Scripts must stick to verifiable facts — no invented anecdotes."
                value={gen.trueStoriesOnly ?? false}
                onChange={(v) => setGen({ ...gen, trueStoriesOnly: v })}
              />
              <Field label="Extra content rules" hint="Freeform instructions appended to every script and director run.">
                <Textarea
                  rows={3}
                  value={gen.extraContentRules ?? ''}
                  onChange={(e) => setGen({ ...gen, extraContentRules: e.target.value || undefined })}
                  placeholder="Never name competitors. Always cite the decade for historical clips."
                />
              </Field>
              <Field label="Visual sourcing" hint="Director + legacy pipeline try to honor this.">
                <select
                  value={gen.mediaPreference ?? 'mixed'}
                  onChange={(e) =>
                    setGen({
                      ...gen,
                      mediaPreference: e.target.value as
                        | 'mixed'
                        | 'stills_only'
                        | 'motion_preferred'
                        | 'video_only',
                    })
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="mixed">Mixed — stills + video as fits</option>
                  <option value="stills_only">Images only — no AI/stock video clips</option>
                  <option value="motion_preferred">Motion preferred — lean on video when it helps</option>
                  <option value="video_only">Video only — prefer motion clips over stills</option>
                </select>
              </Field>
              <Field
                label="Cut pace"
                hint="Director: relaxed = longer holds; rapid = more frequent scene changes."
              >
                <select
                  value={gen.cutPace ?? 'normal'}
                  onChange={(e) =>
                    setGen({
                      ...gen,
                      cutPace: e.target.value as 'relaxed' | 'normal' | 'rapid',
                    })
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="relaxed">Relaxed — fewer, longer shots</option>
                  <option value="normal">Normal</option>
                  <option value="rapid">Rapid — quicker cuts</option>
                </select>
              </Field>
              <Field
                label="Keyword pop-ups"
                hint="Short on-screen cards for names, places, stats — not full captions. When “Names & numbers on video” is on, the director uses timed slate-style cards for narration anchors; this control sets subtle vs bold sizing for those (and for classic dark lower-thirds when that mode is off)."
              >
                <select
                  value={gen.keywordPopStyle ?? 'off'}
                  onChange={(e) =>
                    setGen({
                      ...gen,
                      keywordPopStyle: e.target.value as 'off' | 'subtle' | 'bold',
                    })
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="off">Off</option>
                  <option value="subtle">Subtle — refined documentary look</option>
                  <option value="bold">Bold — high-contrast emphasis</option>
                </select>
              </Field>
              <Toggle
                label="Fact labels on AI stills"
                hint="When on, the director adds short on-image text for important spoken facts — dates, years, names, places, money, percentages — up to four words per label."
                value={gen.allowSparseImageText ?? false}
                onChange={(v) => setGen({ ...gen, allowSparseImageText: v })}
              />
              <Field
                label="Avg seconds per clip / beat"
                hint="Target seconds per on-screen beat (1–12). With voiceover, clips must add up to narration length, so the true average is `voice length ÷ number of shots` — each clip is capped near this value ×1.32; if the storyboard does not plan enough shots for your narration, the run will stop with a clear error instead of holding one image for minutes."
              >
                <Input
                  type="number"
                  step={0.5}
                  value={gen.averageClipSeconds ?? ''}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setGen({
                      ...gen,
                      averageClipSeconds: raw === '' ? undefined : Number(raw) || undefined,
                    });
                  }}
                  min={1}
                  max={12}
                  placeholder="e.g. 3.5"
                  className="w-full"
                />
              </Field>
              <Field
                label="Background music level"
                hint="1 = very subtle bed behind voice; 10 = loudest allowed. Advanced numeric fields below override automatic mix if you set them."
              >
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={1}
                    max={10}
                    step={1}
                    className="min-w-0 flex-1 accent-violet-600"
                    value={gen.musicBackgroundLevel ?? 2}
                    onChange={(e) =>
                      setGen({
                        ...gen,
                        musicBackgroundLevel: Math.min(
                          10,
                          Math.max(1, Math.round(Number(e.target.value)) || 2),
                        ),
                      })
                    }
                  />
                  <span className="w-8 shrink-0 text-right text-sm font-semibold tabular-nums text-slate-800">
                    {gen.musicBackgroundLevel ?? 2}
                  </span>
                </div>
              </Field>
              <details className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2">
                <summary className="cursor-pointer select-none text-xs font-semibold text-slate-700">
                  Advanced music mix (optional overrides)
                </summary>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <Field
                    label="Music under voice (FFmpeg)"
                    hint="0.05–0.55 when VO + music mix. Default 0.22."
                  >
                    <Input
                      type="number"
                      step={0.02}
                      value={gen.musicDuckUnderVoice ?? ''}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setGen({
                          ...gen,
                          musicDuckUnderVoice: raw === '' ? undefined : Number(raw) || undefined,
                        });
                      }}
                      min={0.05}
                      max={0.55}
                      className="w-full"
                    />
                  </Field>
                  <Field label="Music solo (FFmpeg)" hint="0.1–0.85 when there is no VO. Default 0.55.">
                    <Input
                      type="number"
                      step={0.02}
                      value={gen.musicSoloVolume ?? ''}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setGen({
                          ...gen,
                          musicSoloVolume: raw === '' ? undefined : Number(raw) || undefined,
                        });
                      }}
                      min={0.1}
                      max={0.85}
                      className="w-full"
                    />
                  </Field>
                  <Field
                    label="Music in Remotion render"
                    hint="0.05–0.5 linear gain for slideshow / viral-short path. Leave blank for template default."
                  >
                    <Input
                      type="number"
                      step={0.02}
                      value={gen.musicBedVolume ?? ''}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setGen({
                          ...gen,
                          musicBedVolume: raw === '' ? undefined : Number(raw) || undefined,
                        });
                      }}
                      min={0.05}
                      max={0.5}
                      className="w-full"
                    />
                  </Field>
                </div>
              </details>
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
              <Field label="Colour grade" hint="Final FFmpeg look — overrides the director storyboard colour hint when set.">
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
                  <option value="bw">Black & White</option>
                  <option value="high_contrast">High contrast punch</option>
                </select>
              </Field>
              <Field label="Script AI model" hint="Director + script path. Opus is slower and costlier.">
                <select
                  value={gen.scriptModel ?? ''}
                  onChange={(e) =>
                    setGen({
                      ...gen,
                      scriptModel:
                        e.target.value === ''
                          ? undefined
                          : (e.target.value as 'sonnet' | 'opus'),
                    })
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Default (Sonnet)</option>
                  <option value="sonnet">Sonnet</option>
                  <option value="opus">Opus</option>
                </select>
              </Field>
              <Field
                label="Final encode quality (FFmpeg)"
                hint="Used when the server has not set PERSONAL_STITCH_PRESET. High = cleaner, more CPU time."
              >
                <select
                  value={gen.stitchEncodePreset ?? 'balanced'}
                  onChange={(e) =>
                    setGen({
                      ...gen,
                      stitchEncodePreset: e.target.value as 'fast' | 'balanced' | 'high',
                    })
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="fast">Fast — quickest encodes</option>
                  <option value="balanced">Balanced — recommended</option>
                  <option value="high">High — best quality</option>
                </select>
              </Field>
              <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Long-form (1–8 min)
                </div>
                <Toggle
                  label="Long-form mode"
                  hint="Chapter-style director; combine with a long-form-friendly theme or target length. Visual look comes from Media → Inspiration / Style reference (required), not a preset here. Set target length on the Long-form tab (single source of truth)."
                  value={gen.longformEnabled ?? false}
                  onChange={(v) => setGen({ ...gen, longformEnabled: v })}
                />
                <p className="text-xs leading-snug text-slate-600">
                  <span className="font-semibold text-slate-700">Target length (60–480s)</span> is configured on the{' '}
                  <span className="font-medium text-slate-800">Long-form</span> tab so it stays in sync with generation
                  and the director prompt.
                </p>
                <Toggle
                  label="Long-form cold open"
                  hint="When on, the first shot stays up a little longer and narration starts after a short beat (music only) so the video eases in before the script."
                  value={gen.longformIntroEnabled ?? false}
                  onChange={(v) => setGen({ ...gen, longformIntroEnabled: v })}
                />
                <Field
                  label="Cold open length (seconds)"
                  hint="Only when cold open is on. 1.5–5 seconds before voiceover begins."
                >
                  <Input
                    type="number"
                    step={0.25}
                    value={gen.longformIntroSeconds ?? ''}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setGen({
                        ...gen,
                        longformIntroSeconds: raw === '' ? undefined : Number(raw) || undefined,
                      });
                    }}
                    min={1.5}
                    max={5}
                    placeholder="2.5"
                    className="w-full"
                  />
                </Field>
                <Field
                  label="Max AI video clips (long-form)"
                  hint="0–30. Leave blank for automatic caps from quality tier."
                >
                  <Input
                    type="number"
                    value={gen.longformMaxAiVideoShots ?? ''}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === '') {
                        setGen({ ...gen, longformMaxAiVideoShots: undefined });
                        return;
                      }
                      const n = Math.round(Number(raw));
                      if (!Number.isFinite(n)) return;
                      setGen({ ...gen, longformMaxAiVideoShots: Math.min(20, Math.max(0, n)) });
                    }}
                    min={0}
                    max={30}
                    className="w-full"
                  />
                </Field>
              </div>
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
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

/** Deterministic fingerprint for JSON-like plain objects (styleBible / generatorConfig). */
function stableRecordFingerprint(
  value: PersonalAccountStyleBible | PersonalGeneratorConfig | null | undefined,
): string {
  if (value == null) return 'null';
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  return JSON.stringify(Object.fromEntries(entries));
}

/** JSON.stringify omits undefined but keeps null — API Zod rejects null on optional numbers. */
function omitNullShallow<T extends Record<string, unknown>>(obj: T): T {
  const out = {} as T;
  for (const [k, v] of Object.entries(obj)) {
    if (v !== null && v !== undefined) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

function formatSaveValidationError(e: unknown): string {
  if (e instanceof ApiError && Array.isArray(e.details) && e.details.length > 0) {
    const parts = (e.details as { path?: unknown[]; message?: string }[])
      .slice(0, 3)
      .map((issue) => {
        const path =
          Array.isArray(issue.path) && issue.path.length > 0
            ? issue.path
                .map((p) => (typeof p === 'string' || typeof p === 'number' ? String(p) : '?'))
                .join('.')
            : 'value';
        return `${path}: ${issue.message ?? 'invalid'}`;
      });
    return parts.join(' · ');
  }
  return (e as Error).message;
}

const MAX_REFERENCE_SCRIPTS = 5;

type ReferenceScriptSlot = { id: string; body: string };

function newScriptSlotId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `script-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function initReferenceScriptSlots(saved?: string[]): ReferenceScriptSlot[] {
  const trimmed = (saved ?? []).map((s) => s.trim()).filter(Boolean).slice(0, MAX_REFERENCE_SCRIPTS);
  if (trimmed.length === 0) {
    return [{ id: newScriptSlotId(), body: '' }];
  }
  return trimmed.map((body) => ({ id: newScriptSlotId(), body }));
}

function packReferenceFullScripts(slots: ReferenceScriptSlot[]): string[] {
  return slots
    .map((s) => s.body.trim())
    .filter(Boolean)
    .slice(0, MAX_REFERENCE_SCRIPTS);
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
    if (
      !(await confirmDialog({
        title: 'Remove custom audio?',
        description: 'Generated posts will go back to the default music picker for this channel.',
        confirmLabel: 'Remove audio',
        danger: true,
      }))
    ) {
      return;
    }
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
