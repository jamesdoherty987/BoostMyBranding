'use client';

/**
 * Per-account media library panel.
 *
 * Displays every asset the user has uploaded for an account. Each asset
 * has:
 *   - a role (style_reference, avatar_reference, brand_asset, etc)
 *   - a free-text description — the single most important anti-slop
 *     signal, because it lets the user tell the generator exactly what
 *     vibe the asset represents
 *   - tags (short keywords for filtering)
 *   - pinned / archived flags
 *
 * The dropzone accepts multiple files at once and prompts for a default
 * role and description before uploading.
 */

import { useRef, useState } from 'react';
import useSWR from 'swr';
import {
  Upload,
  Image as ImageIcon,
  Video as VideoIcon,
  Music2,
  Pin,
  PinOff,
  Trash2,
  Edit3,
  Save,
  X,
  Star,
  Loader2,
  Archive,
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
  confirmDialog,
} from '@boost/ui';
import type {
  PersonalAccount,
  PersonalAccountMediaItem,
  PersonalCharacter,
  PersonalMediaRole,
} from '@boost/api-client';
import { ApiError } from '@boost/api-client';
import { api } from '@/lib/dashboard/api';

/** Must match `mediaUpload.array('files', 10)` / multer `limits.files` on the API. */
const MAX_FILES_PER_UPLOAD = 10;
const MAX_FILE_MB = 50;

const ROLES: Array<{ value: PersonalMediaRole; label: string; hint: string }> = [
  { value: 'style_reference', label: 'Style reference', hint: 'This is the vibe — palette, lighting, composition.' },
  { value: 'avatar_reference', label: 'Avatar / character', hint: 'Reference face/body for character consistency.' },
  { value: 'brand_asset', label: 'Brand asset', hint: 'Logo, watermark, title card — shown in every video.' },
  { value: 'broll', label: 'B-roll footage', hint: 'General footage the generator can splice in.' },
  { value: 'voice_sample', label: 'Voice sample', hint: 'Clip used to clone a TTS voice.' },
  { value: 'music', label: 'Music bed', hint: 'Custom background music.' },
  { value: 'inspiration', label: 'Inspiration', hint: '"Make content like this" — general muse.' },
  { value: 'location', label: 'Location', hint: 'Background or environment reference.' },
  { value: 'product', label: 'Product', hint: 'Product being featured in the content.' },
];

export function MediaLibrary({
  account,
  characters,
}: {
  account: PersonalAccount;
  characters: PersonalCharacter[];
}) {
  const [filterRole, setFilterRole] = useState<PersonalMediaRole | 'all'>('all');
  const { data, mutate, isLoading } = useSWR(
    ['personal:media', account.id, filterRole],
    () =>
      api.listPersonalMedia(account.id, {
        role: filterRole === 'all' ? undefined : filterRole,
      }),
  );

  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-4 flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-600">
              Media library
            </h3>
            <p className="mt-0.5 text-pretty text-xs leading-relaxed text-slate-500">
              Upload reference images, video, audio. Describe each so the AI matches your vibe.
            </p>
          </div>
          <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value as PersonalMediaRole | 'all')}
              className="w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs sm:max-w-[220px] sm:shrink-0"
            >
              <option value="all">All roles</option>
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <UploadDropzone
          account={account}
          characters={characters}
          onUploaded={() => mutate()}
        />

        <div className="mt-5">
          {isLoading ? (
            <div className="py-10 text-center text-sm text-slate-400">
              <Spinner className="mx-auto h-6 w-6" />
            </div>
          ) : !data || data.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 px-6 py-10 text-center text-sm text-slate-500">
              No media yet. Upload a few style references and describe the vibe you want.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {data.map((m) => (
                <MediaCard
                  key={m.id}
                  item={m}
                  characters={characters}
                  onChanged={() => mutate()}
                />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Upload dropzone ─────────────────────────────────────────── */

function UploadDropzone({
  account,
  characters,
  onUploaded,
}: {
  account: PersonalAccount;
  characters: PersonalCharacter[];
  onUploaded: () => void;
}) {
  const [role, setRole] = useState<PersonalMediaRole>('style_reference');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [characterId, setCharacterId] = useState<string>('');
  const [pinned, setPinned] = useState(false);
  const [pending, setPending] = useState<File[]>([]);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  function addFiles(files: FileList | File[]) {
    const incoming = Array.from(files);
    if (incoming.length === 0) return;
    setPending((prev) => {
      const room = MAX_FILES_PER_UPLOAD - prev.length;
      if (room <= 0) {
        queueMicrotask(() =>
          toast.error(
            'Too many files',
            `Max ${MAX_FILES_PER_UPLOAD} files per upload. Remove some from the queue or upload first.`,
          ),
        );
        return prev;
      }
      if (incoming.length > room) {
        queueMicrotask(() =>
          toast.error(
            'Too many files',
            `Max ${MAX_FILES_PER_UPLOAD} files per upload. Added ${room}, skipped ${incoming.length - room}.`,
          ),
        );
      }
      return [...prev, ...incoming.slice(0, room)];
    });
  }

  async function submit() {
    if (pending.length === 0) return;
    if (pending.length > MAX_FILES_PER_UPLOAD) {
      toast.error(
        'Too many files',
        `Max ${MAX_FILES_PER_UPLOAD} files per upload. Remove some, then try again.`,
      );
      return;
    }
    setBusy(true);
    try {
      const { uploaded, skipped } = await api.uploadPersonalMedia(
        account.id,
        pending,
        {
          role,
          description: description.trim() || undefined,
          tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
          characterId:
            role === 'avatar_reference' && characterId ? characterId : undefined,
          pinned,
        },
        (pct) => setProgress(pct),
      );
      if (uploaded.length > 0) {
        const extra =
          skipped.length > 0 ? ` (${skipped.length} skipped — see toast)` : '';
        toast.success('Uploaded', `${uploaded.length} file(s) added to library${extra}`);
      }
      if (skipped.length > 0) {
        const preview = skipped
          .slice(0, 3)
          .map((s) => `${s.fileName}: ${s.message}`)
          .join(' · ');
        const more = skipped.length > 3 ? ` (+${skipped.length - 3} more)` : '';
        toast.info('Some files were skipped', `${preview}${more}`);
      }
      if (uploaded.length === 0 && skipped.length > 0) {
        toast.error(
          'Nothing uploaded',
          skipped[0]?.message ?? 'Every file in this batch was skipped.',
        );
      }
      if (uploaded.length > 0) {
        setPending([]);
        setDescription('');
        setTags('');
        setCharacterId('');
        setPinned(false);
        onUploaded();
      }
      setProgress(0);
    } catch (e) {
      const err = e as ApiError;
      const detail =
        err.code === 'LIMIT_FILE_COUNT'
          ? `Max ${MAX_FILES_PER_UPLOAD} files per upload. Remove some from the queue or upload in batches.`
          : err.code === 'LIMIT_FILE_SIZE'
            ? `Each file must be ${MAX_FILE_MB}MB or smaller.`
            : err.message || 'Upload failed';
      toast.error('Upload failed', detail);
      setProgress(0);
    } finally {
      setBusy(false);
    }
  }

  const roleHint = ROLES.find((r) => r.value === role)?.hint ?? '';

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
      }}
      className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-4 transition hover:border-slate-400"
    >
      <div className="flex flex-col gap-3">
        {/* Role + character picker */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as PersonalMediaRole)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-500">{roleHint}</p>
          </div>
          {role === 'avatar_reference' ? (
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">
                Character (optional)
              </label>
              <select
                value={characterId}
                onChange={(e) => setCharacterId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">— new / unassigned —</option>
                {characters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>

        {/* Description + tags */}
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">
            Description — tell the AI exactly what this is and why
          </label>
          <Textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. 'Golden hour, 35mm film grain, slightly desaturated — every video should feel like this.'"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">
            Tags (comma-separated)
          </label>
          <Input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="e.g. moody, portrait, cinematic"
          />
        </div>

        {/* Dropzone + picker */}
        <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <div className="min-w-0 flex-1 break-words text-xs text-slate-500">
            Drop files here or
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="ml-1 font-semibold text-slate-900 underline"
            >
              browse
            </button>
            <span className="ml-2 block text-slate-400 sm:mt-0 sm:inline">
              (jpg, png, webp, mp4, mov, webm, mp3, wav — max {MAX_FILE_MB}MB each,{' '}
              {MAX_FILES_PER_UPLOAD} files per upload)
            </span>
          </div>
          <label className="flex shrink-0 items-center gap-1 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
              className="h-3 w-3 rounded border-slate-300"
            />
            Pin
          </label>
        </div>
        <input
          ref={fileInput}
          type="file"
          multiple
          accept="image/*,video/*,audio/*"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = '';
          }}
        />

        {pending.length > 0 ? (
          <div className="flex flex-wrap gap-2 rounded-lg bg-white p-2">
            {pending.map((f, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[11px] text-slate-700"
              >
                {f.name.length > 20 ? f.name.slice(0, 17) + '…' : f.name}
                <button
                  type="button"
                  onClick={() => setPending((prev) => prev.filter((_, j) => j !== i))}
                  className="text-slate-400 hover:text-slate-700"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        ) : null}

        {busy ? (
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
            <div className="mb-1 flex min-w-0 items-center justify-between gap-2 text-xs">
              <span className="min-w-0 truncate text-slate-600">Uploading…</span>
              <span className="shrink-0 font-semibold text-slate-900">{progress}%</span>
            </div>
            <div className="h-1.5 min-w-0 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full bg-gradient-cta transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : null}

        <div className="flex justify-end">
          <Button onClick={submit} disabled={busy || pending.length === 0}>
            {busy ? <Spinner className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
            Upload {pending.length > 0 ? `(${pending.length})` : ''}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─── Single media card ───────────────────────────────────── */

function MediaCard({
  item,
  characters,
  onChanged,
}: {
  item: PersonalAccountMediaItem;
  characters: PersonalCharacter[];
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [description, setDescription] = useState(item.description ?? '');
  const [tags, setTags] = useState(item.tags.join(', '));
  const [role, setRole] = useState<PersonalMediaRole>(item.role);
  const [characterId, setCharacterId] = useState<string>(item.characterId ?? '');
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await api.updatePersonalMedia(item.id, {
        description: description.trim() || null,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        role,
        characterId: characterId || null,
      });
      toast.success('Updated');
      setEditing(false);
      onChanged();
    } catch (e) {
      toast.error('Could not save', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function togglePin() {
    try {
      await api.updatePersonalMedia(item.id, { isPinned: !item.isPinned });
      onChanged();
    } catch (e) {
      toast.error('Could not pin', (e as Error).message);
    }
  }

  async function remove() {
    if (
      !(await confirmDialog({
        title: 'Delete this asset?',
        description: 'This removes the file from your library for this channel.',
        confirmLabel: 'Delete',
        danger: true,
      }))
    ) {
      return;
    }
    try {
      await api.deletePersonalMedia(item.id);
      onChanged();
    } catch (e) {
      toast.error('Could not delete', (e as Error).message);
    }
  }

  const IconKind =
    item.kind === 'video' ? VideoIcon : item.kind === 'audio' ? Music2 : ImageIcon;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="relative aspect-square overflow-hidden bg-slate-100">
        {item.kind === 'image' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.fileUrl}
            alt={item.description ?? ''}
            className="h-full w-full object-cover"
          />
        ) : item.kind === 'video' ? (
          <video src={item.fileUrl} className="h-full w-full object-cover" muted loop />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Music2 className="h-8 w-8 text-slate-400" />
          </div>
        )}
        <div className="absolute left-2 top-2 flex gap-1">
          <Badge tone="default">
            <IconKind className="mr-1 h-3 w-3" /> {item.role.replace('_', ' ')}
          </Badge>
          {item.isPinned ? (
            <Badge tone="warning">
              <Star className="h-3 w-3" />
            </Badge>
          ) : null}
        </div>
        <div className="absolute right-2 top-2 flex gap-1">
          <button
            onClick={togglePin}
            className="rounded-md bg-black/60 p-1 text-white hover:bg-black/80"
            title={item.isPinned ? 'Unpin' : 'Pin'}
          >
            {item.isPinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
          </button>
          <button
            onClick={() => setEditing(true)}
            className="rounded-md bg-black/60 p-1 text-white hover:bg-black/80"
          >
            <Edit3 className="h-3 w-3" />
          </button>
          <button
            onClick={remove}
            className="rounded-md bg-black/60 p-1 text-white hover:bg-rose-500/90"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      <div className="p-2.5">
        {editing ? (
          <div className="space-y-2">
            <Textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this? What vibe should the AI take from it?"
              className="text-xs"
            />
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="tags, comma, sep"
              className="text-xs"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as PersonalMediaRole)}
              className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            {role === 'avatar_reference' ? (
              <select
                value={characterId}
                onChange={(e) => setCharacterId(e.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
              >
                <option value="">— no character —</option>
                {characters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            ) : null}
            <div className="flex justify-end gap-1">
              <button
                className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"
                onClick={() => setEditing(false)}
              >
                Cancel
              </button>
              <button
                className="rounded-md bg-slate-900 px-2 py-1 text-xs font-semibold text-white hover:bg-black disabled:opacity-50"
                onClick={save}
                disabled={busy}
              >
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="line-clamp-3 min-w-0 break-words text-xs text-slate-700">
              {item.description ?? (
                <span className="italic text-slate-400">
                  {item.aiDescription ?? 'no description'}
                </span>
              )}
            </div>
            {item.tags.length > 0 ? (
              <div className="mt-1 flex flex-wrap gap-1">
                {item.tags.slice(0, 3).map((t, ti) => (
                  <span
                    key={`${item.id}-tag-${ti}-${t}`}
                    className="rounded-md bg-slate-100 px-1 py-0.5 text-[10px] text-slate-600"
                  >
                    {t}
                  </span>
                ))}
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
