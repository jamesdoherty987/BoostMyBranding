'use client';

/**
 * Posts Panel — for a single client. Lets the agency:
 *   • See every post regardless of status
 *   • Create N posts on demand (auto-fills the month)
 *   • Inline-edit caption, hashtags, scheduledAt
 *   • Approve (→ scheduled), Reject, Delete
 *   • Batch-approve multiple pending posts
 */

import { useMemo, useState } from 'react';
import Image from 'next/image';
import useSWR from 'swr';
import { mockPosts, postImageUrl, postScheduledAt, type Post } from '@boost/core';
import {
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  Spinner,
  Textarea,
  toast,
  confirmDialog,
} from '@boost/ui';
import {
  Sparkles,
  Plus,
  Check,
  X,
  Trash2,
  Edit3,
  Calendar as CalendarIcon,
  Clock,
  Loader2,
  Instagram,
  Facebook,
  Linkedin,
  Music2,
  Twitter,
} from 'lucide-react';
import { api } from '@/lib/api';

const PLATFORM_ICONS: Record<string, typeof Instagram> = {
  instagram: Instagram,
  facebook: Facebook,
  linkedin: Linkedin,
  tiktok: Music2,
  x: Twitter,
};

const STATUS_TONES: Record<string, 'success' | 'warning' | 'danger' | 'brand' | 'default'> = {
  published: 'success',
  scheduled: 'brand',
  approved: 'brand',
  pending_approval: 'warning',
  pending_internal: 'default',
  rejected: 'danger',
  failed: 'danger',
  publishing: 'warning',
  draft: 'default',
};

const PLATFORMS = ['instagram', 'facebook', 'linkedin', 'tiktok', 'x'] as const;

interface Props {
  clientId: string;
  businessName: string;
}

export function PostsPanel({ clientId, businessName }: Props) {
  const { data = [], isLoading, mutate } = useSWR<Post[]>(
    `posts:${clientId}`,
    async () => {
      try {
        const rows = await api.listPosts({ clientId });
        return rows.length > 0 ? rows : mockPosts.filter((p) => p.clientId === clientId);
      } catch {
        return mockPosts.filter((p) => p.clientId === clientId);
      }
    },
    { refreshInterval: 15000 },
  );

  const [filter, setFilter] = useState<'all' | 'pending' | 'scheduled' | 'published' | 'needs_action'>('all');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ caption: string; hashtags: string; scheduledAt: string }>({
    caption: '',
    hashtags: '',
    scheduledAt: '',
  });

  // Create-N form
  const [createOpen, setCreateOpen] = useState(false);
  const [count, setCount] = useState(10);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [platforms, setPlatforms] = useState<Set<string>>(
    new Set(['instagram', 'facebook']),
  );
  const [direction, setDirection] = useState('');

  const counts = useMemo(() => {
    const out = { all: data.length, pending: 0, scheduled: 0, published: 0, needs_action: 0 };
    for (const p of data) {
      if (p.status === 'pending_approval' || p.status === 'pending_internal') out.pending++;
      if (p.status === 'scheduled' || p.status === 'approved') out.scheduled++;
      if (p.status === 'published') out.published++;
      if (p.status === 'rejected' || p.status === 'failed') out.needs_action++;
    }
    return out;
  }, [data]);

  const filtered = useMemo(() => {
    const sorted = [...data].sort(
      (a, b) => postScheduledAt(b).getTime() - postScheduledAt(a).getTime(),
    );
    if (filter === 'all') return sorted;
    if (filter === 'pending')
      return sorted.filter((p) => p.status === 'pending_approval' || p.status === 'pending_internal');
    if (filter === 'scheduled')
      return sorted.filter((p) => p.status === 'scheduled' || p.status === 'approved');
    if (filter === 'published') return sorted.filter((p) => p.status === 'published');
    if (filter === 'needs_action')
      return sorted.filter((p) => p.status === 'rejected' || p.status === 'failed');
    return sorted;
  }, [data, filter]);

  const createPosts = async () => {
    if (platforms.size === 0) {
      toast.error('Pick at least one platform');
      return;
    }
    setCreating(true);
    try {
      const res = await api.generate({
        clientId,
        month,
        postsCount: count,
        platforms: Array.from(platforms),
        direction: direction || undefined,
      });
      toast.success('Batch ready', `${res.postsGenerated} posts drafted`);
      setCreateOpen(false);
      mutate();
    } catch (e) {
      toast.error('Generation failed', (e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const approve = async (p: Post) => {
    mutate((prev) => prev?.map((x) => (x.id === p.id ? { ...x, status: 'scheduled' as const } : x)), false);
    try {
      await api.approvePost(p.id);
      toast.success('Approved & scheduled');
    } catch (e) {
      toast.error('Could not approve', (e as Error).message);
      mutate();
    }
  };

  const reject = async (p: Post) => {
    const note = prompt('Feedback for the team (optional):') ?? 'Revise';
    mutate((prev) => prev?.map((x) => (x.id === p.id ? { ...x, status: 'rejected' as const } : x)), false);
    try {
      await api.rejectPost(p.id, note);
      toast.success('Sent back for revision');
    } catch (e) {
      toast.error('Could not reject', (e as Error).message);
      mutate();
    }
  };

  const del = async (p: Post) => {
    if (
      !(await confirmDialog({
        title: 'Delete this post?',
        description: 'This cannot be undone.',
        confirmLabel: 'Delete',
        danger: true,
      }))
    )
      return;
    mutate((prev) => prev?.filter((x) => x.id !== p.id), false);
    try {
      await api.deletePost(p.id);
      toast.success('Post deleted');
    } catch (e) {
      toast.error('Delete failed', (e as Error).message);
      mutate();
    }
  };

  const startEdit = (p: Post) => {
    setEditingId(p.id);
    setEditDraft({
      caption: p.caption,
      hashtags: (p.hashtags ?? []).join(' '),
      scheduledAt: postScheduledAt(p).toISOString().slice(0, 16),
    });
  };

  const saveEdit = async (p: Post) => {
    const tags = editDraft.hashtags
      .split(/\s+/)
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 30);
    const patch: Parameters<typeof api.updatePost>[1] = {
      caption: editDraft.caption,
      hashtags: tags,
    };
    if (editDraft.scheduledAt) patch.scheduledAt = new Date(editDraft.scheduledAt).toISOString();

    mutate(
      (prev) =>
        prev?.map((x) =>
          x.id === p.id
            ? {
                ...x,
                caption: patch.caption ?? x.caption,
                hashtags: patch.hashtags ?? x.hashtags,
                scheduledAt: patch.scheduledAt ?? x.scheduledAt,
              }
            : x,
        ),
      false,
    );
    setEditingId(null);
    try {
      await api.updatePost(p.id, patch);
      toast.success('Saved');
    } catch (e) {
      toast.error('Save failed', (e as Error).message);
      mutate();
    }
  };

  const approveAllPending = async () => {
    const ids = data
      .filter((p) => p.status === 'pending_approval' || p.status === 'pending_internal')
      .map((p) => p.id);
    if (ids.length === 0) return;
    if (
      !(await confirmDialog({
        title: `Approve ${ids.length} pending post${ids.length === 1 ? '' : 's'}?`,
        description: 'All selected posts will be marked as approved and scheduled.',
        confirmLabel: 'Approve all',
      }))
    )
      return;
    try {
      await api.batchApprove(ids);
      toast.success('Batch approved', `${ids.length} post${ids.length === 1 ? '' : 's'} scheduled`);
      mutate();
    } catch (e) {
      toast.error('Batch failed', (e as Error).message);
    }
  };

  const togglePlatform = (p: string) =>
    setPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });

  return (
    <div className="space-y-4">
      {/* Header row with create button + batch approve */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setFilter('all')} className={chipClass(filter === 'all')}>
            All ({counts.all})
          </button>
          <button onClick={() => setFilter('pending')} className={chipClass(filter === 'pending')}>
            Pending ({counts.pending})
          </button>
          <button onClick={() => setFilter('scheduled')} className={chipClass(filter === 'scheduled')}>
            Scheduled ({counts.scheduled})
          </button>
          <button onClick={() => setFilter('published')} className={chipClass(filter === 'published')}>
            Published ({counts.published})
          </button>
          {counts.needs_action > 0 ? (
            <button
              onClick={() => setFilter('needs_action')}
              className={chipClass(filter === 'needs_action')}
            >
              Needs action ({counts.needs_action})
            </button>
          ) : null}
        </div>

        <div className="flex gap-2">
          {counts.pending > 0 ? (
            <Button size="sm" variant="outline" onClick={approveAllPending}>
              <Check className="h-3.5 w-3.5" />
              Approve all ({counts.pending})
            </Button>
          ) : null}
          <Button size="sm" onClick={() => setCreateOpen((v) => !v)}>
            <Plus className="h-3.5 w-3.5" />
            Create posts
          </Button>
        </div>
      </div>

      {/* Create form */}
      {createOpen ? (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Sparkles className="h-4 w-4 text-[#1D9CA1]" />
              Generate posts for {businessName}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Claude writes captions, picks images, and schedules across the month.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600">How many?</label>
                <Input
                  type="number"
                  min={1}
                  max={60}
                  value={count}
                  onChange={(e) => setCount(Math.min(60, Math.max(1, Number(e.target.value) || 1)))}
                  className="mt-1 no-zoom"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Month</label>
                <Input
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="mt-1 no-zoom"
                />
              </div>
            </div>

            <div className="mt-3">
              <label className="text-xs font-medium text-slate-600">Platforms</label>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {PLATFORMS.map((p) => {
                  const Icon = PLATFORM_ICONS[p];
                  return (
                    <button
                      key={p}
                      onClick={() => togglePlatform(p)}
                      className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium capitalize transition ${
                        platforms.has(p)
                          ? 'bg-gradient-cta text-white shadow-brand'
                          : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {Icon ? <Icon className="h-3 w-3" /> : null}
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-3">
              <label className="text-xs font-medium text-slate-600">Direction (optional)</label>
              <Textarea
                className="mt-1 no-zoom"
                rows={2}
                placeholder="Lean into weekend specials, showcase the team, etc."
                value={direction}
                onChange={(e) => setDirection(e.target.value)}
              />
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setCreateOpen(false)} disabled={creating}>
                Cancel
              </Button>
              <Button size="sm" onClick={createPosts} disabled={creating}>
                {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {creating ? 'Generating…' : `Generate ${count}`}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Posts grid */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <Sparkles className="h-10 w-10 text-slate-300" />
          <p className="text-sm font-medium text-slate-700">No posts match this filter</p>
          <p className="text-xs text-slate-500">Create some to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => {
            const Icon = PLATFORM_ICONS[p.platform] ?? Instagram;
            const tone = STATUS_TONES[p.status] ?? 'default';
            const isEditing = editingId === p.id;
            const scheduled = postScheduledAt(p);
            return (
              <Card key={p.id} className="overflow-hidden">
                <div className="relative aspect-square bg-slate-100">
                  {postImageUrl(p) ? (
                    <Image src={postImageUrl(p)} alt="" fill className="object-cover" unoptimized />
                  ) : null}
                  <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">
                    <Icon className="h-3 w-3" />
                    {p.platform}
                  </div>
                  <div className="absolute right-2 top-2">
                    <Badge tone={tone} className="capitalize">
                      {p.status.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>

                <CardContent className="p-3 space-y-2">
                  {isEditing ? (
                    <>
                      <Textarea
                        rows={3}
                        value={editDraft.caption}
                        onChange={(e) => setEditDraft((s) => ({ ...s, caption: e.target.value }))}
                        className="text-xs"
                      />
                      <Input
                        value={editDraft.hashtags}
                        onChange={(e) => setEditDraft((s) => ({ ...s, hashtags: e.target.value }))}
                        placeholder="#tag1 #tag2"
                        className="text-xs"
                      />
                      <Input
                        type="datetime-local"
                        value={editDraft.scheduledAt}
                        onChange={(e) => setEditDraft((s) => ({ ...s, scheduledAt: e.target.value }))}
                        className="text-xs"
                      />
                      <div className="flex gap-1.5">
                        <Button size="sm" className="flex-1" onClick={() => saveEdit(p)}>
                          <Check className="h-3 w-3" />
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                          Cancel
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="line-clamp-3 text-xs text-slate-700">{p.caption}</p>
                      {p.hashtags && p.hashtags.length > 0 ? (
                        <p className="line-clamp-1 text-[10px] text-[#1D9CA1]">
                          {p.hashtags.slice(0, 5).join(' ')}
                        </p>
                      ) : null}
                      <div className="flex items-center gap-1 text-[10px] text-slate-500">
                        <CalendarIcon className="h-2.5 w-2.5" />
                        {scheduled.toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                        <Clock className="ml-1 h-2.5 w-2.5" />
                        {scheduled.toLocaleTimeString(undefined, {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                      <div className="flex items-center gap-1 border-t border-slate-100 pt-2">
                        {(p.status === 'pending_internal' || p.status === 'pending_approval' || p.status === 'rejected') ? (
                          <Button size="sm" variant="outline" onClick={() => approve(p)} className="flex-1 text-emerald-700 border-emerald-200 hover:bg-emerald-50">
                            <Check className="h-3 w-3" />
                            Approve
                          </Button>
                        ) : null}
                        {(p.status === 'pending_internal' || p.status === 'pending_approval' || p.status === 'scheduled') ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => reject(p)}
                            className="text-amber-700 border-amber-200 hover:bg-amber-50"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        ) : null}
                        <Button size="sm" variant="outline" onClick={() => startEdit(p)}>
                          <Edit3 className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => del(p)}
                          className="text-rose-600 border-rose-200 hover:bg-rose-50"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function chipClass(active: boolean) {
  return [
    'rounded-full px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap',
    active
      ? 'bg-slate-900 text-white'
      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200',
  ].join(' ');
}
