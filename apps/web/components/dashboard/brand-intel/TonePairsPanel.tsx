'use client';

import { useState } from 'react';
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
} from '@boost/ui';
import {
  Plus,
  MessageSquareQuote,
  Loader2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';
import type { TonePair } from '@boost/api-client';
import { api } from '@/lib/dashboard/api';

const COMMON_CATEGORIES = [
  'instagram_caption',
  'tiktok_hook',
  'email_subject',
  'ad_headline',
  'product_description',
  'customer_service',
  'promotional',
];

export function TonePairsPanel({ clientId }: { clientId: string }) {
  const key = `tone-pairs:${clientId}`;
  const { data: pairs, isLoading } = useSWR<TonePair[]>(key, () => api.listTonePairs(clientId));
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
            {pairs?.length ?? 0} voice example{(pairs?.length ?? 0) === 1 ? '' : 's'}
          </h3>
          <p className="text-xs text-slate-500">
            Show the AI exactly what on-brand and off-brand copy looks like.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />
          Add example
        </Button>
      </div>

      {creating ? (
        <CreatePairCard
          clientId={clientId}
          onCancel={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            mutate(key);
          }}
        />
      ) : null}

      {pairs && pairs.length === 0 && !creating ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-10 text-center">
            <MessageSquareQuote className="h-10 w-10 text-slate-300" />
            <p className="text-sm font-medium text-slate-700">No voice examples yet</p>
            <p className="max-w-md text-xs text-slate-500">
              Paste any caption or headline this brand loves, plus one it would reject.
              Even 3-5 pairs steer the AI dramatically more than a prose voice guide.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-3">
        {pairs?.map((p) => (
          <PairCard key={p.id} pair={p} clientId={clientId} onMutated={() => mutate(key)} />
        ))}
      </div>
    </div>
  );
}

function CreatePairCard({
  clientId,
  onCancel,
  onCreated,
}: {
  clientId: string;
  onCancel: () => void;
  onCreated: () => void;
}) {
  const [category, setCategory] = useState('');
  const [goodExample, setGoodExample] = useState('');
  const [badExample, setBadExample] = useState('');
  const [explanation, setExplanation] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!goodExample.trim()) return;
    setSaving(true);
    try {
      await api.createTonePair(clientId, {
        category: category.trim() || undefined,
        goodExample: goodExample.trim(),
        badExample: badExample.trim() || undefined,
        explanation: explanation.trim() || undefined,
      });
      toast.success('Voice example added');
      onCreated();
    } catch (e) {
      toast.error('Could not save', (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <h4 className="text-sm font-semibold text-slate-900">New voice example</h4>
        <div>
          <label className="text-xs font-semibold text-slate-600">Category (optional)</label>
          <Input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. instagram_caption"
            className="mt-1"
            list="tone-pair-categories"
          />
          <datalist id="tone-pair-categories">
            {COMMON_CATEGORIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
              <ThumbsUp className="h-3 w-3" /> Good copy (required)
            </label>
            <Textarea
              value={goodExample}
              onChange={(e) => setGoodExample(e.target.value)}
              placeholder="A caption or headline you'd actually post."
              rows={4}
              className="mt-1"
            />
          </div>
          <div>
            <label className="flex items-center gap-1 text-xs font-semibold text-rose-600">
              <ThumbsDown className="h-3 w-3" /> Bad copy (optional)
            </label>
            <Textarea
              value={badExample}
              onChange={(e) => setBadExample(e.target.value)}
              placeholder="What would feel off-brand or corporate."
              rows={4}
              className="mt-1"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-600">Why? (optional)</label>
          <Textarea
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            placeholder="e.g. We prefer sensory verbs and avoid superlatives."
            rows={2}
            className="mt-1"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={save} disabled={saving || !goodExample.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {saving ? 'Saving…' : 'Save example'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PairCard({
  pair,
  clientId,
  onMutated,
}: {
  pair: TonePair;
  clientId: string;
  onMutated: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      await api.updateTonePair(clientId, pair.id, { isEnabled: !pair.isEnabled });
      onMutated();
    } catch (e) {
      toast.error('Could not update', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm('Remove this voice example?')) return;
    setBusy(true);
    try {
      await api.deleteTonePair(clientId, pair.id);
      toast.success('Removed');
      onMutated();
    } catch (e) {
      toast.error('Delete failed', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className={!pair.isEnabled ? 'opacity-60' : ''}>
      <CardContent className="space-y-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {pair.category ? (
              <Badge tone="brand">{pair.category}</Badge>
            ) : (
              <Badge tone="default">General</Badge>
            )}
            {!pair.isEnabled ? <Badge tone="default">Disabled</Badge> : null}
          </div>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={toggle}
              disabled={busy}
              title={pair.isEnabled ? 'Click to disable — the AI will ignore this example' : 'Click to enable — include in future generations'}
              aria-label={pair.isEnabled ? 'Disable voice example' : 'Enable voice example'}
            >
              {pair.isEnabled ? (
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
              title="Delete"
              aria-label="Delete voice example"
            >
              <Trash2 className="h-3.5 w-3.5 text-rose-500" />
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl bg-emerald-50 p-3">
            <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-emerald-700">
              <ThumbsUp className="h-3 w-3" />
              Good
            </div>
            <p className="mt-1 whitespace-pre-line text-sm text-emerald-900">
              {pair.goodExample}
            </p>
          </div>
          {pair.badExample ? (
            <div className="rounded-xl bg-rose-50 p-3">
              <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-rose-700">
                <ThumbsDown className="h-3 w-3" />
                Avoid
              </div>
              <p className="mt-1 whitespace-pre-line text-sm text-rose-900">{pair.badExample}</p>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 p-3 text-xs text-slate-400">
              No counter-example set
            </div>
          )}
        </div>

        {pair.explanation ? (
          <p className="text-xs italic text-slate-500">→ {pair.explanation}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
