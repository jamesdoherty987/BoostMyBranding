'use client';

/**
 * Agency-side editor for a client's profile + portal customization.
 * Renders inside the `/dashboard/clients/[id]` tab strip so the team can
 * adjust everything about a client in one place: business details,
 * subscription + pricing, brand, and the per-client portal (which tabs
 * to show, custom labels, extra links, welcome message).
 *
 * The form is driven by a local draft so the user can make multiple
 * changes before committing. A sticky save bar appears on edit and both
 * the "Save" and "Discard" paths reset `dirty` cleanly.
 *
 * Save strategy: one PATCH that includes every changed field. The API
 * normalizes empty strings → null so clearing a field works.
 */

import { useEffect, useMemo, useState } from 'react';
import useSWR, { mutate as globalMutate } from 'swr';
import {
  Button,
  Input,
  Textarea,
  Badge,
  Card,
  CardContent,
  toast,
  Dialog,
} from '@boost/ui';
import {
  Save,
  Plus,
  Trash2,
  GripVertical,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  Link2,
  RotateCcw,
} from 'lucide-react';
import {
  DEFAULT_PORTAL_TABS,
  resolvePortalTabs,
  validatePortalConfig,
  type Client,
  type PortalConfig,
  type PortalTabKey,
  type SubscriptionTier,
} from '@boost/core';
import { api } from '@/lib/dashboard/api';
import { PORTAL_NAV_ICON_OPTIONS } from '@/components/portal/BottomNav';

interface TabDraft {
  key: PortalTabKey;
  label: string;
  hidden: boolean;
  /** Position in the ordered list. Rewritten on reorder. */
  order: number;
}

interface CustomLinkDraft {
  id: string;
  label: string;
  href: string;
  icon: string;
}

interface Draft {
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  industry: string;
  websiteUrl: string;
  brandVoice: string;
  logoUrl: string;
  subscriptionTier: 'social_only' | 'website_only' | 'full_package';
  monthlyPrice: string;
  isActive: boolean;
  brandColors: { primary: string; secondary: string; accent: string };
  tabs: TabDraft[];
  customLinks: CustomLinkDraft[];
  welcomeMessage: string;
}

const TIER_OPTIONS: Array<{ value: Draft['subscriptionTier']; label: string }> = [
  { value: 'social_only', label: 'Social only' },
  { value: 'website_only', label: 'Website only' },
  { value: 'full_package', label: 'Full package' },
];

const DEFAULT_BRAND_COLORS = {
  primary: '#1D9CA1',
  secondary: '#0F172A',
  accent: '#48D886',
} as const;

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/**
 * Build the tab draft from defaults + any existing per-client overrides.
 * Applies the same precedence rules `resolvePortalTabs` does — keeps UI
 * and runtime in sync so the agency sees exactly what the client will.
 */
function buildTabDraft(config: PortalConfig | null | undefined): TabDraft[] {
  const overrides = new Map<string, { label?: string; hidden?: boolean; order?: number }>();
  for (const t of config?.tabs ?? []) overrides.set(t.key, t);
  return DEFAULT_PORTAL_TABS.map((t, i) => {
    const o = overrides.get(t.key);
    return {
      key: t.key,
      label: o?.label?.trim() || t.label,
      hidden: Boolean(o?.hidden),
      order: o?.order ?? i,
    };
  }).sort((a, b) => a.order - b.order);
}

function buildCustomLinksDraft(config: PortalConfig | null | undefined): CustomLinkDraft[] {
  return (config?.customLinks ?? []).map((l) => ({
    id: l.id,
    label: l.label,
    href: l.href,
    icon: l.icon || 'Link2',
  }));
}

function buildDraft(client: Client): Draft {
  return {
    businessName: client.businessName ?? '',
    contactName: client.contactName ?? '',
    email: client.email ?? '',
    phone: client.phone ?? '',
    industry: client.industry ?? '',
    websiteUrl: client.websiteUrl ?? '',
    brandVoice: client.brandVoice ?? '',
    logoUrl: client.logoUrl ?? '',
    subscriptionTier: client.subscriptionTier ?? 'social_only',
    monthlyPrice:
      client.monthlyPriceCents != null && client.monthlyPriceCents > 0
        ? (client.monthlyPriceCents / 100).toFixed(2)
        : '',
    isActive: client.isActive ?? true,
    brandColors: {
      primary: client.brandColors?.primary ?? DEFAULT_BRAND_COLORS.primary,
      secondary: client.brandColors?.secondary ?? DEFAULT_BRAND_COLORS.secondary,
      accent: client.brandColors?.accent ?? DEFAULT_BRAND_COLORS.accent,
    },
    tabs: buildTabDraft(client.portalConfig),
    customLinks: buildCustomLinksDraft(client.portalConfig),
    welcomeMessage: client.portalConfig?.welcomeMessage ?? '',
  };
}

/**
 * Compact a draft tabs array back to the sparse override shape stored in
 * the DB. Only tabs that actually differ from the defaults are kept so
 * the JSONB blob stays small + forward-compatible.
 */
function compactTabsForSave(
  draft: TabDraft[],
): NonNullable<PortalConfig['tabs']> {
  const out: NonNullable<PortalConfig['tabs']> = [];
  draft.forEach((t, i) => {
    const defIdx = DEFAULT_PORTAL_TABS.findIndex((d) => d.key === t.key);
    const defLabel = DEFAULT_PORTAL_TABS[defIdx]?.label ?? '';
    const reordered = t.order !== defIdx || i !== defIdx;
    const relabeled = t.label !== defLabel;
    if (!t.hidden && !reordered && !relabeled) return;
    out.push({
      key: t.key,
      ...(relabeled ? { label: t.label } : {}),
      ...(t.hidden ? { hidden: true } : {}),
      ...(reordered ? { order: i } : {}),
    });
  });
  return out;
}

export function ClientSettingsTab({
  client,
  onChanged,
  onDeleted,
  onDirtyChange,
}: {
  client: Client;
  /** Called after a successful save so the parent can refresh data. */
  onChanged: () => Promise<unknown> | void;
  /** Called after a successful delete so the parent can route away. */
  onDeleted: () => void;
  /**
   * Optional dirty-state beacon. The parent uses this to intercept
   * tab switches and prompt the user before discarding their edits.
   */
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => buildDraft(client));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Who's logged in? Delete is admin-only; we use this to show/hide
  // the danger zone. Non-admins still see everything else.
  const { data: me } = useSWR('dashboard:me', () => api.me());
  const isAdmin = me?.role === 'agency_admin';

  // Keep the parent in the loop whenever the dirty state flips. Runs
  // exactly once per transition (a boolean can only change twice) so
  // we're not spamming the parent on every keystroke.
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  // If the underlying client row changes out from under us (SWR revalidate
  // after a save, for example), refresh the draft but only when the form
  // is clean — we don't want to discard the user's unsaved edits.
  // Keyed on `client` identity rather than `updatedAt` because the shared
  // Client type doesn't expose a timestamp (DB rows do, but the mock
  // shape doesn't). SWR hands us a stable reference until the data
  // actually changes, so this is effectively equivalent.
  useEffect(() => {
    if (!dirty) setDraft(buildDraft(client));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  // Warn the user if they try to close the tab / hit back with unsaved
  // changes. Tab switches within the same page don't trigger this (it's
  // a `beforeunload` listener), so we also guard the in-app tab switch
  // in the parent via the `dirty` state if needed down the line.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Modern browsers ignore the custom string but still show a
      // generic "unsaved changes" prompt when preventDefault is called.
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const patch = (p: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...p }));
    setDirty(true);
  };

  const patchTab = (i: number, p: Partial<TabDraft>) => {
    setDraft((d) => ({
      ...d,
      tabs: d.tabs.map((t, idx) => (idx === i ? { ...t, ...p } : t)),
    }));
    setDirty(true);
  };

  const moveTab = (i: number, direction: -1 | 1) => {
    setDraft((d) => {
      const j = i + direction;
      if (j < 0 || j >= d.tabs.length) return d;
      const next = [...d.tabs];
      const [item] = next.splice(i, 1);
      next.splice(j, 0, item!);
      // Rewrite order indexes so save keeps them in the displayed order.
      return { ...d, tabs: next.map((t, k) => ({ ...t, order: k })) };
    });
    setDirty(true);
  };

  const addCustomLink = () => {
    const id = `link_${Date.now().toString(36)}`;
    patch({
      customLinks: [
        ...draft.customLinks,
        { id, label: '', href: '', icon: 'Link2' },
      ],
    });
  };

  const patchCustomLink = (i: number, p: Partial<CustomLinkDraft>) => {
    setDraft((d) => ({
      ...d,
      customLinks: d.customLinks.map((l, idx) => (idx === i ? { ...l, ...p } : l)),
    }));
    setDirty(true);
  };

  const removeCustomLink = (i: number) => {
    setDraft((d) => ({
      ...d,
      customLinks: d.customLinks.filter((_, idx) => idx !== i),
    }));
    setDirty(true);
  };

  const discard = () => {
    setDraft(buildDraft(client));
    setDirty(false);
  };

  /**
   * Reset every portal customization field back to defaults — tab order
   * + labels + visibility, custom links, welcome message. Matches what
   * a brand-new client row looks like (no `portalConfig` at all).
   */
  const resetPortal = () => {
    setDraft((d) => ({
      ...d,
      tabs: DEFAULT_PORTAL_TABS.map((t, i) => ({
        key: t.key,
        label: t.label,
        hidden: false,
        order: i,
      })),
      customLinks: [],
      welcomeMessage: '',
    }));
    setDirty(true);
  };

  // Client-side validation. Surface the first error as a toast and
  // short-circuit — matches the inline save bar's "something's wrong"
  // pattern elsewhere in the app.
  const portalConfigForSave: PortalConfig = useMemo(() => {
    const tabs = compactTabsForSave(draft.tabs);
    const customLinks: PortalConfig['customLinks'] = draft.customLinks.map((l) => ({
      id: l.id,
      label: l.label.trim(),
      href: l.href.trim(),
      icon: l.icon || undefined,
    }));
    return {
      ...(tabs.length > 0 ? { tabs } : {}),
      ...(customLinks.length > 0 ? { customLinks } : {}),
      welcomeMessage: draft.welcomeMessage.trim() || null,
    };
  }, [draft.tabs, draft.customLinks, draft.welcomeMessage]);

  // How many tabs the *client* will actually see after tier filtering +
  // overrides. Used for the subtle preview counter on the card — if the
  // agency hides everything, they see "No visible tabs".
  const previewTabCount = useMemo(() => {
    const visible = resolvePortalTabs(draft.subscriptionTier, portalConfigForSave);
    return visible.length;
  }, [draft.subscriptionTier, portalConfigForSave]);

  const save = async () => {
    // Validate hex colors before we send.
    for (const k of ['primary', 'secondary', 'accent'] as const) {
      if (!HEX_RE.test(draft.brandColors[k])) {
        toast.error('Invalid color', `${k} must be a hex like #1D9CA1`);
        return;
      }
    }
    // Parse price: blank = clear, otherwise positive number.
    let monthlyPriceCents: number | null = null;
    const priceStr = draft.monthlyPrice.trim();
    if (priceStr) {
      const parsed = Number(priceStr);
      if (!Number.isFinite(parsed) || parsed < 0) {
        toast.error('Invalid price', 'Enter a positive number or leave blank.');
        return;
      }
      monthlyPriceCents = Math.round(parsed * 100);
    }

    const portalConfigIssues = validatePortalConfig(portalConfigForSave);
    if (portalConfigIssues.length > 0) {
      toast.error('Portal config errors', portalConfigIssues[0]);
      return;
    }

    setSaving(true);
    try {
      await api.updateClient(client.id, {
        businessName: draft.businessName.trim(),
        contactName: draft.contactName.trim(),
        email: draft.email.trim().toLowerCase(),
        phone: draft.phone.trim(),
        industry: draft.industry.trim(),
        websiteUrl: draft.websiteUrl.trim(),
        brandVoice: draft.brandVoice,
        logoUrl: draft.logoUrl.trim(),
        subscriptionTier: draft.subscriptionTier,
        monthlyPriceCents,
        isActive: draft.isActive,
        brandColors: draft.brandColors,
        portalConfig: portalConfigForSave,
      });
      toast.success('Saved', 'Client updated.');
      setDirty(false);
      // Bust both the individual client cache (parent passed onChanged
      // wires into SWR's `mutate`) and the list cache so the clients
      // page stays in sync when the user navigates back.
      await Promise.all([onChanged(), globalMutate('clients:list')]);
    } catch (e) {
      toast.error('Save failed', (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await api.deleteClient(client.id);
      toast.success('Client deleted', `${client.businessName} has been removed.`);
      setConfirmDelete(false);
      // Invalidate the clients list cache so the list page reflects
      // the removal immediately after we navigate back, instead of
      // waiting for revalidate-on-focus to fire.
      await globalMutate('clients:list');
      onDeleted();
    } catch (e) {
      toast.error('Delete failed', (e as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4 pb-28">
      {/* Business details */}
      <Card>
        <CardContent className="space-y-4 p-6">
          <h3 className="text-sm font-semibold text-slate-900">Business details</h3>
          <Row>
            <Field label="Business name">
              <Input
                value={draft.businessName}
                onChange={(e) => patch({ businessName: e.target.value })}
              />
            </Field>
            <Field label="Industry">
              <Input
                value={draft.industry}
                onChange={(e) => patch({ industry: e.target.value })}
                placeholder="Food & Beverage"
              />
            </Field>
          </Row>
          <Row>
            <Field label="Primary contact">
              <Input
                value={draft.contactName}
                onChange={(e) => patch({ contactName: e.target.value })}
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                value={draft.email}
                onChange={(e) => patch({ email: e.target.value })}
              />
            </Field>
          </Row>
          <Row>
            <Field label="Phone">
              <Input
                value={draft.phone}
                onChange={(e) => patch({ phone: e.target.value })}
                placeholder="+353 …"
              />
            </Field>
            <Field label="Website">
              <Input
                type="url"
                value={draft.websiteUrl}
                onChange={(e) => patch({ websiteUrl: e.target.value })}
                placeholder="https://"
              />
            </Field>
          </Row>
        </CardContent>
      </Card>

      {/* Subscription */}
      <Card>
        <CardContent className="space-y-4 p-6">
          <h3 className="text-sm font-semibold text-slate-900">Subscription</h3>
          <Row>
            <Field label="Tier">
              <select
                value={draft.subscriptionTier}
                onChange={(e) =>
                  patch({ subscriptionTier: e.target.value as Draft['subscriptionTier'] })
                }
                className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
              >
                {TIER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Monthly price (EUR)"
              hint="Leave blank to use tier default."
            >
              <Input
                inputMode="decimal"
                value={draft.monthlyPrice}
                onChange={(e) => patch({ monthlyPrice: e.target.value })}
                placeholder="0.00"
              />
            </Field>
          </Row>
          <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <input
              type="checkbox"
              checked={draft.isActive}
              onChange={(e) => patch({ isActive: e.target.checked })}
              className="h-4 w-4 rounded text-brand-primary focus:ring-brand-primary"
            />
            <div className="flex-1">
              <div className="text-sm font-medium text-slate-900">Public site is live</div>
              <div className="text-xs text-slate-500">
                When off, the client's public site returns a 404 and custom domains stop
                resolving. Client portal access is unchanged.
              </div>
            </div>
          </label>
        </CardContent>
      </Card>

      {/* Brand */}
      <Card>
        <CardContent className="space-y-4 p-6">
          <h3 className="text-sm font-semibold text-slate-900">Brand</h3>
          <Field label="Brand voice notes" hint="Used by the AI when generating copy.">
            <Textarea
              rows={3}
              value={draft.brandVoice}
              onChange={(e) => patch({ brandVoice: e.target.value })}
              placeholder="Warm, down-to-earth, uses local Irish turns of phrase. Never corporate-speak."
            />
          </Field>
          <Field label="Logo URL" hint="Public URL of the client's logo image.">
            <Input
              type="url"
              value={draft.logoUrl}
              onChange={(e) => patch({ logoUrl: e.target.value })}
              placeholder="https://"
            />
          </Field>
          <div>
            <div className="text-xs font-medium text-slate-600">Brand colors</div>
            <div className="mt-2 grid grid-cols-3 gap-3">
              {(['primary', 'secondary', 'accent'] as const).map((k) => (
                <div key={k}>
                  <div className="text-[10px] font-medium uppercase tracking-widest text-slate-500">
                    {k}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="color"
                      value={draft.brandColors[k]}
                      onChange={(e) =>
                        patch({
                          brandColors: { ...draft.brandColors, [k]: e.target.value },
                        })
                      }
                      className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border border-slate-200"
                      aria-label={`${k} color`}
                    />
                    <Input
                      value={draft.brandColors[k]}
                      onChange={(e) =>
                        patch({
                          brandColors: { ...draft.brandColors, [k]: e.target.value },
                        })
                      }
                      className="h-9 flex-1 font-mono text-xs uppercase"
                      maxLength={7}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Portal customization */}
      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Client portal</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Customize what this specific client sees in their portal — tab labels, order,
                visibility, plus a personal greeting and any extra links.
              </p>
            </div>
            <Badge tone={previewTabCount === 0 ? 'danger' : 'brand'}>
              {previewTabCount === 0
                ? 'No visible tabs'
                : `${previewTabCount} tab${previewTabCount === 1 ? '' : 's'} visible`}
            </Badge>
          </div>

          {/* Welcome message */}
          <Field
            label="Welcome message"
            hint="Shows on their dashboard hero. Leave blank to use the default 'Hi, {name} 👋'."
          >
            <Input
              value={draft.welcomeMessage}
              onChange={(e) => patch({ welcomeMessage: e.target.value })}
              placeholder="Welcome back, Team Murphy ☕"
              maxLength={200}
            />
          </Field>

          {/* Built-in tabs */}
          <div>
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium text-slate-600">Built-in tabs</div>
              <button
                type="button"
                onClick={resetPortal}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-700"
              >
                <RotateCcw className="h-3 w-3" />
                Reset to defaults
              </button>
            </div>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Rename, hide, or reorder. Changes only affect this client's portal nav —
              deep links always work.
            </p>
            <ul className="mt-3 space-y-2">
              {draft.tabs.map((t, i) => {
                const def = DEFAULT_PORTAL_TABS.find((d) => d.key === t.key);
                // A tab can be "not available on this tier" — the portal
                // drops it from the nav regardless of the per-client
                // override. We surface that with a subtle badge so the
                // agency doesn't spend time tuning a hidden tab.
                const tierAllowed =
                  def?.tiers === 'all' ||
                  (Array.isArray(def?.tiers) &&
                    def!.tiers.includes(draft.subscriptionTier as SubscriptionTier));
                return (
                  <li
                    key={t.key}
                    className={`flex items-center gap-2 rounded-xl border p-2 transition-colors ${
                      t.hidden || !tierAllowed
                        ? 'border-slate-200 bg-slate-50 opacity-70'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <GripVertical className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
                    <div className="flex shrink-0 flex-col gap-0.5">
                      <button
                        type="button"
                        aria-label={`Move ${t.label} up`}
                        onClick={() => moveTab(i, -1)}
                        disabled={i === 0}
                        className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent"
                      >
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Move ${t.label} down`}
                        onClick={() => moveTab(i, 1)}
                        disabled={i === draft.tabs.length - 1}
                        className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent"
                      >
                        <ArrowDown className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="min-w-0 flex-1">
                      <Input
                        value={t.label}
                        onChange={(e) => patchTab(i, { label: e.target.value })}
                        placeholder={def?.label ?? t.key}
                        maxLength={40}
                        className="h-8 text-sm"
                      />
                      <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-400">
                        <span>Default: {def?.label ?? t.key}</span>
                        {!tierAllowed ? (
                          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-medium text-amber-700">
                            Not on this tier
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => patchTab(i, { hidden: !t.hidden })}
                      className={`inline-flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium transition-colors ${
                        t.hidden
                          ? 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                          : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      }`}
                      aria-label={t.hidden ? `Show ${t.label}` : `Hide ${t.label}`}
                    >
                      {t.hidden ? (
                        <>
                          <EyeOff className="h-3 w-3" />
                          Hidden
                        </>
                      ) : (
                        <>
                          <Eye className="h-3 w-3" />
                          Visible
                        </>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Custom links */}
          <div>
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium text-slate-600">Custom links</div>
              <button
                type="button"
                onClick={addCustomLink}
                disabled={draft.customLinks.length >= 10}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="h-3 w-3" />
                Add link
              </button>
            </div>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Extra buttons in the portal nav — menu pages, booking links, whatever this
              company needs front-and-centre. Internal routes start with <code>/</code>;
              external URLs need <code>https://</code>.
            </p>
            {draft.customLinks.length === 0 ? (
              <div className="mt-3 rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500">
                No custom links yet.
              </div>
            ) : (
              <ul className="mt-3 space-y-2">
                {draft.customLinks.map((l, i) => (
                  <li
                    key={l.id}
                    className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 md:flex-row md:items-center"
                  >
                    <Link2 className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                    <div className="grid flex-1 grid-cols-1 gap-2 md:grid-cols-[1fr_1.5fr_auto]">
                      <Input
                        value={l.label}
                        onChange={(e) => patchCustomLink(i, { label: e.target.value })}
                        placeholder="Label"
                        maxLength={40}
                        className="h-8 text-sm"
                      />
                      <Input
                        value={l.href}
                        onChange={(e) => patchCustomLink(i, { href: e.target.value })}
                        placeholder="/menu or https://…"
                        className="h-8 font-mono text-xs"
                      />
                      <select
                        value={l.icon}
                        onChange={(e) => patchCustomLink(i, { icon: e.target.value })}
                        className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs"
                        aria-label="Icon"
                      >
                        {PORTAL_NAV_ICON_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeCustomLink(i)}
                      className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      aria-label={`Remove ${l.label || 'link'}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Danger zone — admin only. */}
      {isAdmin ? (
        <Card>
          <CardContent className="space-y-3 p-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-500" />
              <h3 className="text-sm font-semibold text-rose-600">Danger zone</h3>
            </div>
            <p className="text-xs text-slate-600">
              Deleting this client removes their record and cascades through images, posts,
              messages, and billing history. Not recoverable.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmDelete(true)}
              className="border-rose-200 text-rose-700 hover:bg-rose-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete {client.businessName}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* Sticky save bar — matches the pattern in /portal/settings.
          Desktop offsets by half the 256px sidebar so the bar centers
          on the main content area, not the viewport. */}
      {dirty ? (
        <div className="fixed bottom-4 left-1/2 z-30 w-[min(100%-1rem,32rem)] -translate-x-1/2 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl md:left-[calc(50%+8rem)]">
          <div className="flex items-center gap-2">
            <span className="flex-1 px-2 text-xs font-medium text-slate-700">
              Unsaved changes
            </span>
            <Button size="sm" variant="ghost" onClick={discard} disabled={saving}>
              Discard
            </Button>
            <Button size="sm" onClick={save} disabled={saving} loading={saving}>
              {!saving ? <Save className="h-3.5 w-3.5" /> : null}
              Save changes
            </Button>
          </div>
        </div>
      ) : null}

      {/* Delete confirmation dialog. */}
      <Dialog
        open={confirmDelete}
        onClose={() => !deleting && setConfirmDelete(false)}
        title={`Delete ${client.businessName}?`}
        description="This can't be undone. All associated images, posts, messages, and billing records will be removed."
      >
        <div className="flex flex-col gap-2">
          <Button
            onClick={doDelete}
            disabled={deleting}
            loading={deleting}
            className="bg-rose-600 hover:bg-rose-700 focus:ring-rose-600"
          >
            <Trash2 className="h-4 w-4" />
            Yes, delete this client
          </Button>
          <Button variant="ghost" onClick={() => setConfirmDelete(false)} disabled={deleting}>
            Cancel
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{children}</div>;
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
    <label className="block">
      <span className="block text-xs font-medium text-slate-600">{label}</span>
      <span className="mt-1 block">{children}</span>
      {hint ? <span className="mt-1 block text-[10px] text-slate-500">{hint}</span> : null}
    </label>
  );
}
