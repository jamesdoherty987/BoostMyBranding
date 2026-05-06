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
import { Plus, Package, Loader2, Trash2, Archive, Eye, EyeOff } from 'lucide-react';
import type { Product } from '@boost/api-client';
import { api } from '@/lib/dashboard/api';

export function ProductsPanel({ clientId }: { clientId: string }) {
  const key = `products:${clientId}`;
  const { data: products, isLoading } = useSWR<Product[]>(key, () => api.listProducts(clientId));
  const [creating, setCreating] = useState(false);

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size={24} />
      </div>
    );
  }

  const active = products?.filter((p) => p.status === 'active') ?? [];
  const drafts = products?.filter((p) => p.status === 'draft') ?? [];
  const archived = products?.filter((p) => p.status === 'archived') ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            {active.length} active · {drafts.length} draft · {archived.length} archived
          </h3>
          <p className="text-xs text-slate-500">
            Each product can be targeted individually when generating posts and ads.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />
          Add product
        </Button>
      </div>

      {creating ? (
        <CreateProductCard
          clientId={clientId}
          onCancel={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            mutate(key);
          }}
        />
      ) : null}

      {products && products.length === 0 && !creating ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-10 text-center">
            <Package className="h-10 w-10 text-slate-300" />
            <p className="text-sm font-medium text-slate-700">No products yet</p>
            <p className="max-w-md text-xs text-slate-500">
              Add the SKUs, services, or features you want to promote. The AI will reference
              their exact names and descriptions when generating content — no more invented
              specs.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {products && products.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} clientId={clientId} onMutated={() => mutate(key)} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CreateProductCard({
  clientId,
  onCancel,
  onCreated,
}: {
  clientId: string;
  onCancel: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [description, setDescription] = useState('');
  const [priceInput, setPriceInput] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [tagsInput, setTagsInput] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const parsedPrice = priceInput.trim() ? Math.round(parseFloat(priceInput) * 100) : NaN;
      const priceCents = Number.isFinite(parsedPrice) && parsedPrice >= 0 ? parsedPrice : undefined;
      await api.createProduct(clientId, {
        name: name.trim(),
        sku: sku.trim() || undefined,
        description: description.trim() || undefined,
        priceCents,
        currency,
        tags: tagsInput.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 25),
        status: 'active',
      });
      toast.success('Product added');
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
        <h4 className="text-sm font-semibold text-slate-900">New product</h4>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-slate-600">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Oat Milk Latte"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">SKU / code</label>
            <Input
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="optional"
              className="mt-1"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-600">Description</label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What it is, who it's for, key benefit."
            rows={3}
            className="mt-1"
          />
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="text-xs font-semibold text-slate-600">Price</label>
            <Input
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              placeholder="9.99"
              className="mt-1"
              inputMode="decimal"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Currency</label>
            <Input
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase().slice(0, 3))}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Tags (comma-separated)</label>
            <Input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="seasonal, vegan"
              className="mt-1"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={save} disabled={saving || !name.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {saving ? 'Saving…' : 'Save product'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ProductCard({
  product,
  clientId,
  onMutated,
}: {
  product: Product;
  clientId: string;
  onMutated: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function cycleStatus() {
    setBusy(true);
    try {
      const next =
        product.status === 'draft'
          ? 'active'
          : product.status === 'active'
            ? 'archived'
            : 'active';
      await api.updateProduct(clientId, product.id, { status: next });
      onMutated();
    } catch (e) {
      toast.error('Could not update', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`Delete product "${product.name}"?`)) return;
    setBusy(true);
    try {
      await api.deleteProduct(clientId, product.id);
      toast.success('Deleted');
      onMutated();
    } catch (e) {
      toast.error('Delete failed', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const tone =
    product.status === 'active'
      ? 'success'
      : product.status === 'draft'
        ? 'default'
        : 'default';

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h4 className="truncate text-base font-semibold text-slate-900">{product.name}</h4>
              <Badge tone={tone as any}>{product.status}</Badge>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              {product.sku ? <span>SKU {product.sku}</span> : null}
              {product.priceCents != null ? (
                <span>
                  {product.currency ?? 'EUR'} {(product.priceCents / 100).toFixed(2)}
                </span>
              ) : null}
              {product.media.length > 0 ? (
                <span>{product.media.length} media</span>
              ) : null}
            </div>
          </div>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={cycleStatus}
              disabled={busy}
              title={
                product.status === 'draft'
                  ? 'Publish — make this product available for AI generation'
                  : product.status === 'active'
                    ? 'Archive — hide from AI generation but keep history'
                    : 'Reactivate — make this product available again'
              }
              aria-label={
                product.status === 'draft'
                  ? 'Publish product'
                  : product.status === 'active'
                    ? 'Archive product'
                    : 'Reactivate product'
              }
            >
              {product.status === 'active' ? (
                <Eye className="h-3.5 w-3.5 text-[#1D9CA1]" />
              ) : product.status === 'archived' ? (
                <Archive className="h-3.5 w-3.5 text-slate-500" />
              ) : (
                <EyeOff className="h-3.5 w-3.5 text-slate-400" />
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={remove}
              disabled={busy}
              title="Delete"
              aria-label="Delete product"
            >
              <Trash2 className="h-3.5 w-3.5 text-rose-500" />
            </Button>
          </div>
        </div>
        {product.description ? (
          <p className="line-clamp-3 text-sm text-slate-600">{product.description}</p>
        ) : null}
        {product.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {product.tags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600"
              >
                {t}
              </span>
            ))}
          </div>
        ) : null}
        {product.media.length > 0 ? (
          <div className="flex gap-1 overflow-x-auto">
            {product.media.slice(0, 6).map((m) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={m.id}
                src={m.fileUrl}
                alt=""
                className="h-14 w-14 shrink-0 rounded-lg object-cover"
              />
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
