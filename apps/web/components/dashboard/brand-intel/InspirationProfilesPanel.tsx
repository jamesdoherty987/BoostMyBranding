'use client';

import { useState, useRef } from 'react';
import useSWR, { mutate } from 'swr';
import {
  Button,
  Card,
  CardContent,
  Input,
  Textarea,
  Spinner,
  Badge,
  toast,
  confirmDialog,
} from '@boost/ui';
import {
  Plus,
  Globe,
  Loader2,
  Trash2,
  RefreshCw,
  Upload,
  X,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import type { InspirationProfile } from '@boost/api-client';
import { api } from '@/lib/dashboard/api';

export function InspirationProfilesPanel({ clientId }: { clientId: string }) {
  const key = `inspiration-profiles:${clientId}`;
  const { data: profiles, isLoading } = useSWR<InspirationProfile[]>(
    key,
    () => api.listInspirationProfiles(clientId),
    {
      // Poll while any profile is actively scraping so the UI flips
      // from "Scraping" to "Ready" without a manual refresh.
      refreshInterval: (data) =>
        data?.some((p) => p.status === 'scraping') ? 2000 : 0,
    },
  );
  const [creating, setCreating] = useState(false);

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size={24} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            {profiles?.length ?? 0} inspiration profile{(profiles?.length ?? 0) === 1 ? '' : 's'}
          </h3>
          <p className="text-xs text-slate-500">
            Add brands whose style you want the AI to learn from.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />
          Add inspiration
        </Button>
      </div>

      {creating ? (
        <CreateProfileCard
          clientId={clientId}
          onCancel={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            mutate(key);
          }}
        />
      ) : null}

      {profiles && profiles.length === 0 && !creating ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-10 text-center">
            <Globe className="h-10 w-10 text-slate-300" />
            <p className="text-sm font-medium text-slate-700">
              No inspiration profiles yet
            </p>
            <p className="max-w-sm text-xs text-slate-500">
              Drop a link to any brand you admire (e.g. starbucks.com) and the AI will
              learn their visual style and copy tone, then apply it to your content
              without copying their logos or names.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-3">
        {profiles?.map((p) => (
          <ProfileCard
            key={p.id}
            profile={p}
            clientId={clientId}
            onMutated={() => mutate(key)}
          />
        ))}
      </div>
    </div>
  );
}

function CreateProfileCard({
  clientId,
  onCancel,
  onCreated,
}: {
  clientId: string;
  onCancel: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [referenceUrl, setReferenceUrl] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const created = await api.createInspirationProfile(clientId, {
        name: name.trim(),
        referenceUrl: referenceUrl.trim() || undefined,
        description: description.trim() || undefined,
      });
      // Show success and close immediately so the user isn't blocked.
      // If they supplied a URL, kick off the scrape asynchronously —
      // the profile card shows a "Scraping…" badge while it runs and
      // swaps to "Ready" when the analysis lands via SWR revalidation.
      toast.success('Profile created');
      onCreated();
      if (referenceUrl.trim()) {
        toast.info('Analyzing reference…', 'The AI is reading the site. This takes 10-30s.');
        api
          .scrapeInspirationProfile(clientId, created.id)
          .then(() => {
            toast.success('Profile ready', `"${created.name}" analysed and saved.`);
            onCreated(); // Triggers SWR revalidation.
          })
          .catch((e) => {
            toast.info(
              'Scrape failed',
              (e as Error).message + ' — you can retry from the profile card.',
            );
            onCreated();
          });
      }
    } catch (e) {
      toast.error('Could not create profile', (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <h4 className="text-sm font-semibold text-slate-900">New inspiration profile</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-slate-600">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Starbucks voice"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Reference URL</label>
            <Input
              value={referenceUrl}
              onChange={(e) => setReferenceUrl(e.target.value)}
              placeholder="https://starbucks.com"
              className="mt-1"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-600">
            Why this brand? (optional)
          </label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Love their warm, inviting copy and earthy palette."
            rows={2}
            className="mt-1"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={save} disabled={saving || !name.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {saving ? 'Creating…' : 'Create profile'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ProfileCard({
  profile,
  clientId,
  onMutated,
}: {
  profile: InspirationProfile;
  clientId: string;
  onMutated: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(profile.name);
  const fileInput = useRef<HTMLInputElement>(null);

  async function rescrape() {
    if (!profile.referenceUrl) {
      toast.info('No URL set', 'Add a reference URL first.');
      return;
    }
    setBusy(true);
    try {
      await api.scrapeInspirationProfile(clientId, profile.id);
      toast.success('Analysis updated');
      onMutated();
    } catch (e) {
      toast.error('Scrape failed', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggle() {
    setBusy(true);
    try {
      await api.updateInspirationProfile(clientId, profile.id, {
        isEnabled: !profile.isEnabled,
      });
      onMutated();
    } catch (e) {
      toast.error('Could not update', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (
      !(await confirmDialog({
        title: `Delete “${profile.name}”?`,
        description: 'This removes the inspiration profile permanently.',
        confirmLabel: 'Delete',
        danger: true,
      }))
    ) {
      return;
    }
    setBusy(true);
    try {
      await api.deleteInspirationProfile(clientId, profile.id);
      toast.success('Profile removed');
      onMutated();
    } catch (e) {
      toast.error('Delete failed', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      await api.uploadInspirationProfileMedia(clientId, profile.id, Array.from(files));
      toast.success(`${files.length} file${files.length > 1 ? 's' : ''} added`);
      onMutated();
    } catch (e) {
      toast.error('Upload failed', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function removeMedia(mediaId: string) {
    setBusy(true);
    try {
      await api.deleteInspirationProfileMedia(clientId, profile.id, mediaId);
      onMutated();
    } catch (e) {
      toast.error('Remove failed', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveName() {
    if (busy) return;
    if (!nameDraft.trim() || nameDraft.trim() === profile.name) {
      setEditingName(false);
      setNameDraft(profile.name);
      return;
    }
    setBusy(true);
    try {
      await api.updateInspirationProfile(clientId, profile.id, { name: nameDraft.trim() });
      setEditingName(false);
      onMutated();
    } catch (e) {
      toast.error('Could not rename', (e as Error).message);
      setNameDraft(profile.name);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className={!profile.isEnabled ? 'opacity-60' : ''}>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {editingName ? (
              <Input
                value={nameDraft}
                autoFocus
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={() => {
                  // Only save on blur if we haven't already saved via
                  // Enter keydown (busy guard inside saveName handles
                  // the race but this skips the redundant call).
                  if (!busy) saveName();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    (e.target as HTMLInputElement).blur();
                  }
                  if (e.key === 'Escape') {
                    setNameDraft(profile.name);
                    setEditingName(false);
                  }
                }}
              />
            ) : (
              <button
                className="truncate text-left text-base font-semibold text-slate-900 hover:underline"
                onClick={() => setEditingName(true)}
              >
                {profile.name}
              </button>
            )}
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              {profile.referenceUrl ? (
                <a
                  href={profile.referenceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  {new URL(profile.referenceUrl).hostname}
                </a>
              ) : (
                <span className="text-slate-400">No URL</span>
              )}
              <StatusBadge status={profile.status} />
              {!profile.isEnabled ? <Badge tone="default">Disabled</Badge> : null}
            </div>
            {profile.description ? (
              <p className="mt-1.5 text-xs italic text-slate-500">{profile.description}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 gap-1">
            {profile.referenceUrl ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={rescrape}
                disabled={busy}
                title="Re-analyse the reference site"
                aria-label="Re-analyse reference"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} />
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="ghost"
              onClick={toggle}
              disabled={busy}
              title={profile.isEnabled ? 'Disable — stop using this profile in generations' : 'Enable — include in future generations'}
              aria-label={profile.isEnabled ? 'Disable profile' : 'Enable profile'}
            >
              {profile.isEnabled ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-[#1D9CA1]" />
              ) : (
                <AlertCircle className="h-3.5 w-3.5 text-slate-400" />
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={remove}
              disabled={busy}
              title="Delete profile"
              aria-label="Delete profile"
            >
              <Trash2 className="h-3.5 w-3.5 text-rose-500" />
            </Button>
          </div>
        </div>

        {profile.scrapeError ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            {profile.scrapeError}
          </div>
        ) : null}

        {profile.visualAnalysis || profile.copyVoice || profile.colorPalette ? (
          <div className="grid gap-3 rounded-xl bg-slate-50 p-3 md:grid-cols-2">
            {profile.visualAnalysis ? (
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                  Visual style
                </div>
                <p className="mt-1 text-xs text-slate-700">{profile.visualAnalysis.style}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {profile.visualAnalysis.mood} · {profile.visualAnalysis.composition}
                </p>
                {profile.visualAnalysis.visualMotifs.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {profile.visualAnalysis.visualMotifs.map((m, i) => (
                      <span
                        key={i}
                        className="rounded-full bg-white px-2 py-0.5 text-[10px] text-slate-600 ring-1 ring-slate-200"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            {profile.copyVoice ? (
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                  Copy voice
                </div>
                <p className="mt-1 text-xs text-slate-700">
                  {profile.copyVoice.toneDescriptors.join(', ')}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {profile.copyVoice.sentenceShape}
                </p>
                {profile.copyVoice.vocabulary.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {profile.copyVoice.vocabulary.slice(0, 8).map((w, i) => (
                      <span
                        key={i}
                        className="rounded-full bg-white px-2 py-0.5 text-[10px] text-slate-600 ring-1 ring-slate-200"
                      >
                        {w}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            {profile.colorPalette && profile.colorPalette.length > 0 ? (
              <div className="md:col-span-2">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                  Palette
                </div>
                <div className="mt-1.5 flex gap-1.5">
                  {profile.colorPalette.slice(0, 8).map((c, i) => (
                    <div
                      key={i}
                      title={c}
                      className="h-8 w-8 rounded-lg border border-slate-200"
                      style={{ backgroundColor: c.startsWith('#') ? c : undefined }}
                    >
                      {!c.startsWith('#') ? (
                        <span className="block p-1 text-[9px] text-slate-500">{c.slice(0, 5)}</span>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {profile.copySamples && profile.copySamples.length > 0 ? (
              <div className="md:col-span-2">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                  Copy samples
                </div>
                <ul className="mt-1 space-y-1">
                  {profile.copySamples.slice(0, 3).map((s, i) => (
                    <li key={i} className="text-xs italic text-slate-600">
                      “{s}”
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        <div>
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Reference media ({profile.media.length})
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => fileInput.current?.click()}
              disabled={busy}
            >
              <Upload className="h-3.5 w-3.5" />
              Add files
            </Button>
            <input
              ref={fileInput}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
              className="hidden"
              onChange={(e) => {
                upload(e.target.files);
                e.target.value = '';
              }}
            />
          </div>
          {profile.media.length > 0 ? (
            <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
              {profile.media.map((m) => (
                <div key={m.id} className="group relative aspect-square overflow-hidden rounded-lg bg-slate-100">
                  {m.mimeType?.startsWith('video/') ? (
                    <video src={m.fileUrl} className="h-full w-full object-cover" muted />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.fileUrl} alt={m.fileName ?? ''} className="h-full w-full object-cover" />
                  )}
                  <button
                    onClick={() => removeMedia(m.id)}
                    className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    aria-label="Remove"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: InspirationProfile['status'] }) {
  if (status === 'ready') return <Badge tone="success">Ready</Badge>;
  if (status === 'scraping')
    return (
      <Badge tone="warning">
        <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Scraping
      </Badge>
    );
  if (status === 'failed') return <Badge tone="danger">Failed</Badge>;
  return <Badge tone="default">Idle</Badge>;
}
