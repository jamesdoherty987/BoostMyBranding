/**
 * Curated TTS presets for the personal generator. Each row sets both
 * `ttsProvider` and `ttsVoiceId` so OpenAI voice names are not sent to ElevenLabs raw.
 */
export type TtsVoicePreset = {
  id: string;
  /** Short label (provider prefix stripped in the UI dropdown). */
  label: string;
  /**
   * Plain-language vibe — how it tends to sound (not a guarantee; providers change models).
   */
  soundLike: string;
  provider: 'elevenlabs' | 'openai';
  voiceId: string;
};

export const TTS_VOICE_PRESETS: readonly TtsVoicePreset[] = [
  {
    id: 'el-rachel',
    label: 'ElevenLabs — Rachel',
    soundLike: 'Warm adult female (US); smooth, friendly—great for explainers and soft sells.',
    provider: 'elevenlabs',
    voiceId: '21m00Tcm4TlvDq8ikWAM',
  },
  {
    id: 'el-adam',
    label: 'ElevenLabs — Adam',
    soundLike: 'Deep adult male (US); steady, serious—documentary / authority tone.',
    provider: 'elevenlabs',
    voiceId: 'pNInz6obpgDQGcFmaJgB',
  },
  {
    id: 'el-charlotte',
    label: 'ElevenLabs — Charlotte',
    soundLike: 'Polished adult female (UK); crisp, articulate—news or premium brand read.',
    provider: 'elevenlabs',
    voiceId: 'XB0fDUnXU5powFXDhCwa',
  },
  {
    id: 'el-arnold',
    label: 'ElevenLabs — Arnold',
    soundLike: 'Deep mature male (UK); gravelly “BBC narrator” gravitas.',
    provider: 'elevenlabs',
    voiceId: 'VR6AewLTigWG4xSOukaG',
  },
  {
    id: 'el-sam',
    label: 'ElevenLabs — Sam',
    soundLike: 'Easygoing adult male; casual podcast / “guy next door” energy.',
    provider: 'elevenlabs',
    voiceId: 'yoZ06aMxZJJ28mfd3POQ',
  },
  {
    id: 'el-josh',
    label: 'ElevenLabs — Josh',
    soundLike: 'Younger adult male; bright, clear—good for upbeat shorts.',
    provider: 'elevenlabs',
    voiceId: 'TxGEqnHWrfWFTfGW9XjX',
  },
  {
    id: 'el-antoni',
    label: 'ElevenLabs — Antoni',
    soundLike: 'Balanced adult male; warm and versatile—works across many topics.',
    provider: 'elevenlabs',
    voiceId: 'ErXwobaYiN019PkySvjV',
  },
  {
    id: 'oa-nova',
    label: 'OpenAI — Nova',
    soundLike: 'Bright young-adult female; lively and expressive.',
    provider: 'openai',
    voiceId: 'nova',
  },
  {
    id: 'oa-onyx',
    label: 'OpenAI — Onyx',
    soundLike: 'Very deep male; slow, weighty—closest to “movie trailer / old wise man” vibes.',
    provider: 'openai',
    voiceId: 'onyx',
  },
  {
    id: 'oa-alloy',
    label: 'OpenAI — Alloy',
    soundLike: 'Neutral, androgynous; calm “default assistant” read—least characterful.',
    provider: 'openai',
    voiceId: 'alloy',
  },
  {
    id: 'oa-echo',
    label: 'OpenAI — Echo',
    soundLike: 'Clear adult male; straightforward, slightly resonant.',
    provider: 'openai',
    voiceId: 'echo',
  },
  {
    id: 'oa-fable',
    label: 'OpenAI — Fable',
    soundLike: 'British-leaning male; animated, storytime / character energy.',
    provider: 'openai',
    voiceId: 'fable',
  },
  {
    id: 'oa-shimmer',
    label: 'OpenAI — Shimmer',
    soundLike: 'Soft young-adult female; gentle, optimistic, easy on the ears.',
    provider: 'openai',
    voiceId: 'shimmer',
  },
] as const;

function presetShortName(p: TtsVoicePreset): string {
  return p.label.replace(/^ElevenLabs — /, '').replace(/^OpenAI — /, '');
}

/** Text shown in `<option>` labels (name + vibe). */
export function ttsPresetOptionLabel(p: TtsVoicePreset): string {
  return `${presetShortName(p)} — ${p.soundLike}`;
}

export function matchTtsPresetId(gen: {
  ttsProvider?: string;
  ttsVoiceId?: string;
}): string {
  const prov = gen.ttsProvider ?? 'elevenlabs';
  const vid = (gen.ttsVoiceId ?? '').trim();
  if (!vid) return '';
  const hit = TTS_VOICE_PRESETS.find((p) => p.provider === prov && p.voiceId === vid);
  return hit?.id ?? '';
}
