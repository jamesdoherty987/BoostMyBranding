'use client';

/**
 * Character Studio — AI influencer persona manager.
 *
 * Lets the user:
 *   - Create a new persona with name + tagline + backstory
 *   - Upload reference images tagged as 'avatar_reference'
 *   - Run "analyze references" to distill the character sheet
 *   - Review and edit the auto-generated prompt fragment / negative prompt
 *
 * The resulting character can be attached to any account. When selected
 * on an account, every generation injects the sheet + reference images
 * so the same face shows up across videos.
 */

import { useState } from 'react';
import useSWR from 'swr';
import {
  Plus,
  Sparkles,
  Trash2,
  Save,
  Edit3,
  Loader2,
  CheckCircle2,
  AlertCircle,
  User,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  Textarea,
  Spinner,
  toast,
} from '@boost/ui';
import type { PersonalCharacter } from '@boost/api-client';
import { api } from '@/lib/dashboard/api';

export function CharacterStudio() {
  const {
    data: characters,
    mutate,
    isLoading,
  } = useSWR('personal:characters', () => api.listCharacters());
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = characters?.find((c) => c.id === selectedId) ?? null;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-600">
              AI influencers
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Create reusable on-camera personas. Upload reference images, let Claude Vision build a character sheet, then attach to any channel.
            </p>
          </div>
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> New character
          </Button>
        </div>

        {creating ? (
          <CharacterCreate onCancel={() => setCreating(false)} onCreated={() => { setCreating(false); mutate(); }} />
        ) : null}

        {isLoading ? (
          <div className="py-10 text-center text-sm text-slate-400">
            <Spinner className="mx-auto h-6 w-6" />
          </div>
        ) : characters?.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 px-6 py-10 text-center text-sm text-slate-500">
            No characters yet. Create one to build a consistent AI persona.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {characters?.map((c) => (
              <CharacterCard
                key={c.id}
                character={c}
                active={selectedId === c.id}
                onClick={() => setSelectedId(c.id === selectedId ? null : c.id)}
              />
            ))}
          </div>
        )}

        {selected ? (
          <CharacterDetail character={selected} onChanged={() => mutate()} />
        ) : null}
      </CardContent>
    </Card>
  );
}

/* ─── Create ─────────────────────────────────────────────── */

function CharacterCreate({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [backstory, setBackstory] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await api.createCharacter({
        name: name.trim(),
        tagline: tagline.trim() || undefined,
        backstory: backstory.trim() || undefined,
      });
      toast.success('Character created', 'Now upload reference images in the Media tab → role "avatar_reference".');
      onCreated();
    } catch (e) {
      toast.error('Could not create', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h4 className="mb-3 text-sm font-bold text-slate-900">Create character</h4>
      <div className="space-y-3">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name (e.g. Mira Chen)"
        />
        <Input
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          placeholder="Tagline (e.g. '26-year-old Seoul-based finance creator')"
        />
        <Textarea
          rows={3}
          value={backstory}
          onChange={(e) => setBackstory(e.target.value)}
          placeholder="Backstory — more context about the persona, their world, their voice. The AI reads this before writing scripts."
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button onClick={submit} disabled={busy || !name.trim()}>
            {busy ? <Spinner className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            Create
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─── Card ───────────────────────────────────────────────── */

function CharacterCard({
  character,
  active,
  onClick,
}: {
  character: PersonalCharacter;
  active: boolean;
  onClick: () => void;
}) {
  const statusTone: 'success' | 'warning' | 'danger' | 'default' =
    character.status === 'ready'
      ? 'success'
      : character.status === 'analyzing'
        ? 'warning'
        : character.status === 'failed'
          ? 'danger'
          : 'default';
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${
        active ? 'border-slate-900 bg-slate-50 shadow-sm' : 'border-slate-200 bg-white hover:bg-slate-50'
      }`}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-400 to-indigo-500 text-white">
        <User className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="truncate text-sm font-semibold text-slate-900">{character.name}</div>
          <Badge tone={statusTone}>{character.status}</Badge>
        </div>
        {character.tagline ? (
          <div className="mt-0.5 truncate text-[12px] text-slate-500">{character.tagline}</div>
        ) : null}
        <div className="mt-1 text-[11px] text-slate-400">
          {character.referenceImageCount} reference image{character.referenceImageCount === 1 ? '' : 's'}
        </div>
      </div>
    </button>
  );
}

/* ─── Detail / editor ─────────────────────────────────────── */

function CharacterDetail({
  character,
  onChanged,
}: {
  character: PersonalCharacter;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(character.name);
  const [tagline, setTagline] = useState(character.tagline ?? '');
  const [backstory, setBackstory] = useState(character.backstory ?? '');
  const [fragment, setFragment] = useState(character.promptFragment ?? '');
  const [negative, setNegative] = useState(character.negativePrompt ?? '');
  const [voiceId, setVoiceId] = useState(character.voiceId ?? '');
  const [busy, setBusy] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await api.updateCharacter(character.id, {
        name,
        tagline: tagline.trim() || null,
        backstory: backstory.trim() || null,
        promptFragment: fragment.trim() || null,
        negativePrompt: negative.trim() || null,
        voiceId: voiceId.trim() || null,
      });
      toast.success('Character saved');
      setEditing(false);
      onChanged();
    } catch (e) {
      toast.error('Could not save', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function analyze() {
    setAnalyzing(true);
    try {
      const updated = await api.analyzeCharacter(character.id);
      setFragment(updated.promptFragment ?? '');
      setNegative(updated.negativePrompt ?? '');
      toast.success('Character sheet built', 'Prompt fragment updated from your reference images.');
      onChanged();
    } catch (e) {
      toast.error('Analysis failed', (e as Error).message);
    } finally {
      setAnalyzing(false);
    }
  }

  async function remove() {
    if (!confirm(`Delete character "${character.name}"? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await api.deleteCharacter(character.id);
      toast.success('Character deleted');
      onChanged();
    } catch (e) {
      toast.error('Could not delete', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between">
        <h4 className="text-sm font-bold text-slate-900">{character.name} — details</h4>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={analyze}
            disabled={analyzing || character.referenceImageCount === 0}
            title={
              character.referenceImageCount === 0
                ? 'Upload avatar references first (Media tab → role: Avatar / character)'
                : 'Rebuild character sheet from reference images'
            }
          >
            {analyzing ? <Spinner className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
            Analyze refs
          </Button>
          {!editing ? (
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              <Edit3 className="h-4 w-4" /> Edit
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" onClick={remove}>
            <Trash2 className="h-4 w-4 text-rose-500" />
          </Button>
        </div>
      </div>

      {character.error ? (
        <div className="flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{character.error}</span>
        </div>
      ) : null}

      {editing ? (
        <div className="space-y-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
          <Input
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="Tagline"
          />
          <Textarea
            rows={3}
            value={backstory}
            onChange={(e) => setBackstory(e.target.value)}
            placeholder="Backstory"
          />
          <Textarea
            rows={4}
            value={fragment}
            onChange={(e) => setFragment(e.target.value)}
            placeholder="Prompt fragment — paste this into every image/video prompt to keep the same look."
          />
          <Textarea
            rows={2}
            value={negative}
            onChange={(e) => setNegative(e.target.value)}
            placeholder="Negative prompt — things to exclude (e.g. 'no neon lighting, no beard, no sunglasses')"
          />
          <Input
            value={voiceId}
            onChange={(e) => setVoiceId(e.target.value)}
            placeholder="Voice id (ElevenLabs / OpenAI voice to use for this character)"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
            <Button onClick={save} disabled={busy}>
              {busy ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              Save
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          {character.tagline ? (
            <div>
              <div className="text-xs font-semibold text-slate-500">Tagline</div>
              <div>{character.tagline}</div>
            </div>
          ) : null}
          {character.backstory ? (
            <div>
              <div className="text-xs font-semibold text-slate-500">Backstory</div>
              <div className="whitespace-pre-wrap text-[13px] text-slate-700">{character.backstory}</div>
            </div>
          ) : null}
          <div>
            <div className="text-xs font-semibold text-slate-500">Prompt fragment</div>
            <div className="rounded-md bg-slate-50 p-2 text-[13px] text-slate-700">
              {character.promptFragment ?? <span className="italic text-slate-400">Upload refs and click "Analyze refs" to build this automatically.</span>}
            </div>
          </div>
          {character.negativePrompt ? (
            <div>
              <div className="text-xs font-semibold text-slate-500">Never include</div>
              <div className="rounded-md bg-rose-50 p-2 text-[13px] text-rose-700">
                {character.negativePrompt}
              </div>
            </div>
          ) : null}
          {character.voiceId ? (
            <div>
              <div className="text-xs font-semibold text-slate-500">Voice ID</div>
              <code className="rounded bg-slate-100 px-1 py-0.5 text-[12px]">{character.voiceId}</code>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
