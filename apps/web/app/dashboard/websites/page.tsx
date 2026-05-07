'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useSWR from 'swr';
import {
  mockClients,
  mockWebsiteRequests,
  slugify,
  type WebsiteConfig,
  type SiteTemplate,
} from '@boost/core';
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
import { SiteRenderer, sanitizeConfig } from '@boost/ui/site';
import {
  ExternalLink,
  Globe,
  Sparkles,
  Clock,
  Check,
  Loader2,
  Wand2,
  ArrowRight,
  ChevronDown,
  Trash2,
  Edit3,
  Monitor,
  Tablet,
  Smartphone,
  Upload,
  X,
  Image as ImageIcon,
} from 'lucide-react';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { SiteEditor } from '@/components/dashboard/SiteEditor';
import { PreviewFrame } from '@/components/dashboard/PreviewFrame';
import { api } from '@/lib/dashboard/api';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

/**
 * Optional template override panel. The AI now auto-detects the right
 * template from the business description, so the picker is collapsed by
 * default. Expand it when you want to force a specific layout.
 */
const TEMPLATES: Array<{
  id: SiteTemplate;
  name: string;
  description: string;
}> = [
  { id: 'service', name: 'Service business', description: 'Plumbers, electricians, cleaners.' },
  { id: 'food', name: 'Cafe & food', description: 'Cafes, restaurants, bars.' },
  { id: 'beauty', name: 'Beauty & wellness', description: 'Salons, spas, aesthetics.' },
  { id: 'fitness', name: 'Fitness & coaching', description: 'Gyms, PTs, yoga.' },
  { id: 'professional', name: 'Professional', description: 'Agencies, accountants.' },
  { id: 'retail', name: 'Retail & shop', description: 'Boutiques, shops, ecom.' },
  { id: 'medical', name: 'Medical & dental', description: 'Clinics, dentists.' },
  { id: 'creative', name: 'Creative & studio', description: 'Designers, photographers.' },
  { id: 'realestate', name: 'Property & real estate', description: 'Estate agents.' },
  { id: 'education', name: 'Education & training', description: 'Schools, tutors.' },
  { id: 'automotive', name: 'Automotive', description: 'Mechanics, garages, body shops.' },
  { id: 'hospitality', name: 'Hospitality', description: 'Hotels, B&Bs, guesthouses.' },
  { id: 'legal', name: 'Legal', description: 'Solicitors, law firms, barristers.' },
  { id: 'nonprofit', name: 'Non-profit', description: 'Charities, foundations, community.' },
  { id: 'tech', name: 'Tech & SaaS', description: 'Software, apps, startups.' },
  { id: 'events', name: 'Events & venues', description: 'Wedding planners, venues, caterers.' },
  { id: 'homeservices', name: 'Home improvement', description: 'Landscapers, painters, builders.' },
];

interface PipelineStep {
  key: string;
  label: string;
  status: 'idle' | 'doing' | 'done' | 'failed';
}

const PIPELINE: PipelineStep[] = [
  { key: 'scrape_site', label: 'Reading your existing site', status: 'idle' },
  { key: 'fetch_images', label: 'Collecting your photos', status: 'idle' },
  { key: 'write_copy', label: 'Writing hero + services copy', status: 'idle' },
  { key: 'gen_hero_image', label: 'Generating hero illustration', status: 'idle' },
  { key: 'assemble_config', label: 'Assembling site config', status: 'idle' },
  { key: 'save', label: 'Saving for review', status: 'idle' },
];

type GeneratedConfig = WebsiteConfig;

export default function WebsitesPage() {
  // Live clients from the DB. Only falls back to mock data if the list
  // request itself throws (network down etc). An empty array from the API
  // is NOT an error — it just means there are no clients yet.
  const { data: clients = [], isLoading: clientsLoading } = useSWR(
    'websites:clients',
    async () => {
      try {
        return await api.listClients();
      } catch {
        return mockClients;
      }
    },
  );

  const [newSite, setNewSite] = useState({
    // Start blank; the effect below picks the first real client as soon as
    // SWR settles. Previously we defaulted to `mockClients[0].id` which
    // leaked mock IDs (e.g. "c_murphy") into real API calls if the user
    // hit Generate before the list finished loading.
    clientId: '',
    businessName: '',
    url: '',
    description:
      'A small local business focused on quality work, clear communication, and repeat customers.',
    services: 'Installations, Repairs, Maintenance',
    hasBooking: true,
    hasHours: true,
    template: undefined as SiteTemplate | undefined,
    suggestions: '',
    primaryColor: '',
    accentColor: '',
    logoUrl: '',

    // Business facts — pipe through verbatim to the generated site.
    address: '',
    phone: '',
    email: '',
    whatsapp: '',
    hours: '',
    socials: {
      facebook: '',
      instagram: '',
      tiktok: '',
      linkedin: '',
      x: '',
      youtube: '',
      google: '',
    },
    team: [] as Array<{
      name: string;
      role: string;
      bio?: string;
      credentials?: string;
      specialties?: string[];
      photoUrl?: string;
    }>,
    serviceAreas: '' as string, // comma-separated input, split on submit
    trustBadges: [] as Array<{ label: string; detail?: string; href?: string }>,

    // Extras — optional nice-to-haves that make copy more specific
    yearFounded: '',
    awards: '' as string, // comma-separated
    pressMentions: [] as Array<{ outlet: string; quote?: string; href?: string }>,
    certifications: '' as string, // comma-separated
    languagesSpoken: '' as string, // comma-separated
    paymentMethods: '' as string, // comma-separated
    insuranceDetails: '',
    uniqueSellingPoints: [] as string[],
    targetAudience: '',
    competitivePositioning: '',
    inspirationLinks: [] as string[],
    /** URL → role tags (hero/gallery/about/portfolio/team/product) */
    mediaTags: {} as Record<string, string[]>,
  });

  // Pick a default client once the list arrives. Also re-picks if the
  // currently-selected id is stale (e.g. someone deleted that client from
  // another tab) or still pointing at a mock id.
  const realClientIds = new Set(clients.map((c) => c.id));
  useEffect(() => {
    if (!clients.length) return;
    if (!newSite.clientId || !realClientIds.has(newSite.clientId)) {
      setNewSite((s) => ({ ...s, clientId: clients[0]!.id }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients]);

  const [templateOverrideOpen, setTemplateOverrideOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [mediaPanelOpen, setMediaPanelOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<PipelineStep[]>(PIPELINE);
  const [config, setConfig] = useState<GeneratedConfig | null>(null);
  const [editMode, setEditMode] = useState(false);
  /**
   * Which page of a multipage site the preview is currently showing.
   * Resets to 'home' whenever a new site is generated or picked.
   */
  const [previewPageSlug, setPreviewPageSlug] = useState<string>('home');

  /**
   * Device the preview is simulating. Lets agencies sanity-check mobile
   * layouts without a second browser window. Values:
   *   desktop — full container width (default)
   *   tablet  — 768px fixed
   *   mobile  — 390px fixed (iPhone 14/15 viewport)
   *
   * We render the same SiteRenderer at a constrained width; Tailwind's
   * responsive breakpoints respond to the container width via `container
   * queries` where used, and to the viewport otherwise. That's a
   * limitation — some `md:` styles will still render because the viewport
   * is desktop — but for most layouts this catches the obvious issues
   * (text overflow, too-wide cards, hero cutoffs).
   */
  type DeviceMode = 'desktop' | 'tablet' | 'mobile';
  const [device, setDevice] = useState<DeviceMode>('desktop');

  /**
   * When the user clicks an image in edit mode, we open a picker overlay
   * and remember which field the pick should apply to. `path` is the
   * dotted prefix (e.g. `about` or `team.members.2`); `fieldName` tells
   * us whether to write `imageIndex`/`imageUrl` or `photoIndex`/`photoUrl`.
   */
  const [imagePicker, setImagePicker] = useState<
    | {
        path: string;
        fieldName:
          | 'imageIndex'
          | 'imageUrl'
          | 'photoIndex'
          | 'photoUrl'
          | 'logoIndex'
          | 'logoUrl'
          | 'secondaryImageIndex'
          | 'secondaryImageUrl'
          | 'direct';
      }
    | null
  >(null);

  // Load the selected client's existing site config (if any) into the
  // preview + editor. This way you can pick Murphy's Plumbing from the
  // dropdown and immediately edit the site that's already saved for them,
  // without needing to click Generate first.
  //
  // Keyed by clientId so switching clients pulls the new one's config.
  // `running` guard: don't clobber state mid-generation.
  const selectedClientRow = clients.find((c) => c.id === newSite.clientId);
  useEffect(() => {
    if (running) return;
    // If the currently-loaded config already belongs to this client, leave
    // it alone — the user might be mid-edit and we don't want to drop their
    // work when SWR revalidates.
    const existing = (selectedClientRow?.websiteConfig ?? null) as WebsiteConfig | null;
    if (existing) {
      // Sanitize once on load so the editor and preview never see null
      // entries from legacy sparse-hole saves. Every array operation
      // downstream can assume non-null items.
      setConfig(sanitizeConfig(existing));
      setPreviewPageSlug('home');
    } else {
      // Client has no saved site yet — clear any stale preview from a prior
      // client selection.
      setConfig(null);
      setPreviewPageSlug('home');
    }
    // Deliberately only runs when the client changes; `running` checked inside.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newSite.clientId]);

  // Fetch approved images for the currently-selected client. Skips the
  // request while clientId is empty so we don't fire a request for
  // "no client yet" on first render.
  //
  // We keep two parallel views:
  //   - clientImages (URL strings only) — backward-compatible for blocks
  //     and the preview renderer which take a plain `string[]`.
  //   - clientImageRows — full DB rows with id, aiDescription, status.
  //     Used for the label-editing + approval UI.
  const {
    data: clientImageRows = [],
    mutate: mutateClientImages,
  } = useSWR(
    newSite.clientId ? `websites:image-rows:${newSite.clientId}` : null,
    async () => {
      try {
        return await api.listImages(newSite.clientId);
      } catch {
        return [];
      }
    },
  );
  const clientImages = clientImageRows
    .map((r) => r.fileUrl)
    .filter((u): u is string => typeof u === 'string' && u.length > 0);

  /**
   * Run the full generation pipeline.
   *
   * `options.designSeed` — when passed, the server cycles the
   * design-signature picker so the output uses different variants even
   * for the same business. Used by the "Try another look" button so
   * agencies can roll until they find a style they like.
   */
  const generate = async (options: { designSeed?: string } = {}) => {
    // Defensive check: a real client id is a UUID. If we ever end up with
    // a stale mock id (e.g. "c_murphy") because the clients list hasn't
    // loaded yet, surface a clear error instead of firing an API call
    // that will 500 with a Postgres query error.
    const isValidUuid =
      !!newSite.clientId &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        newSite.clientId,
      );
    if (!newSite.clientId || !isValidUuid) {
      toast.error(
        'Pick a client',
        clients.length === 0
          ? 'Loading your clients — try again in a moment.'
          : 'Choose who this site is for from the dropdown.',
      );
      return;
    }
    setRunning(true);
    setConfig(null);
    setSteps(PIPELINE.map((s, i) => ({ ...s, status: i === 0 ? 'doing' : 'idle' })));

    let idx = 0;
    const tick = setInterval(() => {
      idx = Math.min(PIPELINE.length - 1, idx + 1);
      setSteps((prev) =>
        prev.map((s, i) =>
          i === idx ? { ...s, status: 'doing' } : i < idx ? { ...s, status: 'done' } : s,
        ),
      );
    }, 800);

    try {
      // Build suggestions string that includes brand color overrides
      const suggestionParts: string[] = [];
      if (newSite.suggestions) suggestionParts.push(newSite.suggestions);
      if (newSite.primaryColor) suggestionParts.push(`Use ${newSite.primaryColor} as the primary brand color.`);
      if (newSite.accentColor) suggestionParts.push(`Use ${newSite.accentColor} as the accent color.`);
      if (newSite.logoUrl) suggestionParts.push(`The business logo is at: ${newSite.logoUrl}`);

      const result = await api.generateWebsite({
        clientId: newSite.clientId,
        description: newSite.description,
        services: newSite.services
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        hasBooking: newSite.hasBooking,
        hasHours: newSite.hasHours,
        template: newSite.template, // may be undefined → Claude auto-detects
        suggestions: suggestionParts.join('\n') || undefined,
        designSeed: options.designSeed,
        // Seeded business facts
        address: newSite.address.trim() || undefined,
        phone: newSite.phone.trim() || undefined,
        email: newSite.email.trim() || undefined,
        whatsapp: newSite.whatsapp.trim() || undefined,
        hours: newSite.hours.trim() || undefined,
        socials: Object.values(newSite.socials).some((v) => v.trim())
          ? Object.fromEntries(
              Object.entries(newSite.socials)
                .filter(([, v]) => v.trim())
                .map(([k, v]) => [k, v.trim()]),
            )
          : undefined,
        team: newSite.team.length > 0 ? newSite.team : undefined,
        serviceAreas: newSite.serviceAreas
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean).length
          ? newSite.serviceAreas
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : undefined,
        trustBadges: newSite.trustBadges.length > 0 ? newSite.trustBadges : undefined,
        // Extras
        yearFounded: newSite.yearFounded.trim() || undefined,
        awards: splitCsv(newSite.awards),
        pressMentions: newSite.pressMentions.filter((p) => p.outlet.trim()).length > 0
          ? newSite.pressMentions.filter((p) => p.outlet.trim())
          : undefined,
        certifications: splitCsv(newSite.certifications),
        languagesSpoken: splitCsv(newSite.languagesSpoken),
        paymentMethods: splitCsv(newSite.paymentMethods),
        insuranceDetails: newSite.insuranceDetails.trim() || undefined,
        uniqueSellingPoints: newSite.uniqueSellingPoints.filter((u) => u.trim()).length > 0
          ? newSite.uniqueSellingPoints.filter((u) => u.trim())
          : undefined,
        targetAudience: newSite.targetAudience.trim() || undefined,
        competitivePositioning: newSite.competitivePositioning.trim() || undefined,
        inspirationLinks: newSite.inspirationLinks.filter((l) => l.trim()).length > 0
          ? newSite.inspirationLinks.filter((l) => l.trim())
          : undefined,
        mediaTags: Object.entries(newSite.mediaTags).some(([, t]) => t.length > 0)
          ? Object.fromEntries(
              Object.entries(newSite.mediaTags).filter(([, t]) => t.length > 0),
            )
          : undefined,
      });
      clearInterval(tick);
      setSteps((prev) => prev.map((s) => ({ ...s, status: 'done' })));
      setConfig(sanitizeConfig(result.config));
      // Jump the preview back to the homepage when a fresh generation
      // lands, otherwise a stale preview page slug might not exist in
      // the new config and we'd render the fallback.
      setPreviewPageSlug('home');
      toast.success(
        'Site generated',
        result.fromMock ? 'Preview ready (demo mode).' : 'Config saved to the client record.',
      );
    } catch (e) {
      clearInterval(tick);
      setSteps((prev) =>
        prev.map((s) => (s.status === 'doing' ? { ...s, status: 'failed' } : s)),
      );
      toast.error('Generation failed', (e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  /**
   * Inline edit handler. Patches the local config optimistically and
   * routes the change through the same debounced full-config save path
   * as the editor panel. We used to call `updateWebsiteField` here, but
   * that raced the editor's `saveWebsiteConfig` flush: the editor kept a
   * stale `pendingConfigRef` snapshot, and when its debounce fired it
   * overwrote inline picks (image uploads, colour swatches, etc).
   *
   * Unifying both paths means there's one source of truth — the full
   * config in `pendingConfigRef` — and one way to persist it.
   */
  const handleFieldChange = useCallback(
    (path: string, value: unknown) => {
      if (!config || !newSite.clientId) return;

      // Source from the latest pending snapshot if one exists — this is
      // vital when `handleFieldChange` is called multiple times in the
      // same tick (e.g. ImagePicker sets both `imageIndex` and clears
      // `imageUrl`). React hasn't re-rendered yet, so `config` still
      // holds the pre-first-call value; reading the ref lets us chain.
      const source = (pendingConfigRef.current ?? config) as WebsiteConfig;

      // Optimistic local patch. Mirrors the server-side `setPath` —
      // when we write into an array by index, we fill earlier holes
      // with `{}` so downstream renders don't hit `member is null`
      // (sparse holes serialize as null via JSON).
      //
      // Critical: when a numeric segment follows, the parent MUST be an
      // array. If a previous write accidentally created the parent as
      // `{"0": ...}`, we coerce it back to an array here. Otherwise the
      // renderer gets `services = {0: {...}}` and `sanitizeConfig`
      // correctly warns "expected array, got object".
      const segments = path.split('.').filter((s) => s.length > 0);
      const next = structuredClone(source) as any;
      let cursor = next;
      for (let i = 0; i < segments.length - 1; i++) {
        const k = segments[i]!;
        const nextKey = segments[i + 1];
        const nextIsNumeric = !!nextKey && /^\d+$/.test(nextKey);

        // Create the node if missing.
        if (cursor[k] == null) {
          cursor[k] = nextIsNumeric ? [] : {};
        }

        // Coerce object-that-should-be-array into an array. This fixes
        // configs already corrupted by the previous bug — without it,
        // every edit compounds and the block eventually disappears.
        if (nextIsNumeric && !Array.isArray(cursor[k]) && typeof cursor[k] === 'object') {
          const obj = cursor[k] as Record<string, unknown>;
          const numericKeys = Object.keys(obj)
            .filter((key) => /^\d+$/.test(key))
            .map((key) => Number(key));
          if (numericKeys.length > 0) {
            const maxIdx = Math.max(...numericKeys);
            const arr: unknown[] = Array.from({ length: maxIdx + 1 }, () => ({}));
            for (const key of Object.keys(obj)) {
              if (/^\d+$/.test(key)) {
                arr[Number(key)] = obj[key];
              }
            }
            cursor[k] = arr;
          } else {
            // No numeric keys yet — safe to convert to empty array.
            cursor[k] = [];
          }
        }

        // Fill sparse array holes before the target index.
        if (Array.isArray(cursor[k]) && nextIsNumeric) {
          const arr = cursor[k] as unknown[];
          const idx = Number(nextKey);
          while (arr.length < idx) arr.push({});
          if (arr[idx] == null) arr[idx] = {};
        }

        cursor = cursor[k];
      }

      // Final assignment — use numeric index when the segment looks like
      // a number so we don't stuff string keys into an array.
      const lastKey = segments[segments.length - 1]!;
      if (/^\d+$/.test(lastKey) && Array.isArray(cursor)) {
        cursor[Number(lastKey)] = value;
      } else {
        cursor[lastKey] = value;
      }

      // Route through the editor's save pipeline so the debounced
      // `saveWebsiteConfig` always sees this change. We call the
      // handler below directly via the ref so we don't depend on
      // hoisting.
      handleConfigChangeRef.current?.(next as WebsiteConfig);
    },
    [config, newSite.clientId],
  );

  const selectedClient = clients.find((c) => c.id === newSite.clientId);

  /**
   * Wrapper for SiteEditor's onChange. Updates local state immediately
   * (so the preview is responsive) and debounce-persists the full config
   * to the DB so the user never has to click a Save button.
   *
   * The debounce prevents hammering the API when the user is dragging
   * sections around or rapidly clicking color swatches.
   */
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingConfigRef = useRef<WebsiteConfig | null>(null);
  // Ref holds the latest `handleConfigChange`. `handleFieldChange` calls
  // it through the ref so inline edits (image pick, colour swatch, etc.)
  // funnel into the same debounced save pipeline as the editor panel,
  // without creating a React-style circular dependency in `useCallback`.
  const handleConfigChangeRef = useRef<((c: WebsiteConfig) => void) | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  /**
   * Persist the full config in a single atomic request. The previous
   * approach sent 36 parallel `updateWebsiteField` calls, which the
   * server handled as read-modify-write on the same JSONB blob — they
   * raced each other and late-completing writes silently reverted
   * earlier ones (that's why section reorders "saved" then reappeared
   * after reload). One request, one UPDATE, no races.
   */
  const persistConfig = useCallback(
    async (next: WebsiteConfig) => {
      if (!newSite.clientId) return;
      setSaving(true);
      try {
        await api.saveWebsiteConfig({
          clientId: newSite.clientId,
          config: next,
        });
        setLastSaved(new Date());
        setHasUnsavedChanges(false);
        pendingConfigRef.current = null;
      } catch (e) {
        toast.error('Save failed', (e as Error).message);
        throw e;
      } finally {
        setSaving(false);
      }
    },
    [newSite.clientId],
  );

  /**
   * Flush any pending debounced save right now and wait for it. Called
   * by the manual Save button and before unmount.
   */
  const flushSave = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const pending = pendingConfigRef.current;
    if (!pending) return;
    await persistConfig(pending);
  }, [persistConfig]);

  const handleConfigChange = useCallback(
    (next: WebsiteConfig) => {
      setConfig(next);
      pendingConfigRef.current = next;
      setHasUnsavedChanges(true);

      // Debounce the persist — 1.5s after the last change.
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        saveTimerRef.current = null;
        const pending = pendingConfigRef.current;
        if (!pending) return;
        persistConfig(pending).catch(() => {
          /* toast already shown */
        });
      }, 1500);
    },
    [persistConfig],
  );

  // Keep the ref up-to-date so `handleFieldChange` always calls the
  // latest handler (captures latest `persistConfig` reference).
  useEffect(() => {
    handleConfigChangeRef.current = handleConfigChange;
  }, [handleConfigChange]);

  // Warn before leaving the page with unsaved edits. `returnValue` is
  // required for Firefox; modern browsers show a generic dialog.
  useEffect(() => {
    if (!hasUnsavedChanges && !saving) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges, saving]);

  // Cmd/Ctrl+S triggers a manual save.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        if (hasUnsavedChanges || saveTimerRef.current) {
          e.preventDefault();
          flushSave();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [flushSave, hasUnsavedChanges]);

  return (
    <>
      <PageHeader
        title="Websites"
        subtitle="Spin up a new client site in minutes. Drop in a description, we generate the full config."
      />

      <div className="px-4 py-4 md:px-10 md:py-6 space-y-8">
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
          <Card>
            <CardContent className="p-6 space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">New site details</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Tell us about the business in plain English. The AI auto-detects the
                  right industry template, picks the best hero style, and generates
                  a custom illustration — all from what you write here.
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600">Client</label>
                <select
                  value={newSite.clientId}
                  onChange={(e) =>
                    setNewSite((s) => ({ ...s, clientId: e.target.value }))
                  }
                  disabled={clientsLoading || clients.length === 0}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm no-zoom disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {clientsLoading ? (
                    <option>Loading clients…</option>
                  ) : clients.length === 0 ? (
                    <option>No clients yet — create one from the Clients tab</option>
                  ) : (
                    <>
                      {!newSite.clientId ? (
                        <option value="" disabled>
                          Select a client…
                        </option>
                      ) : null}
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.businessName} · {c.industry ?? ''}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-slate-600">Business name</label>
                  <Input
                    className="mt-1"
                    value={newSite.businessName}
                    onChange={(e) =>
                      setNewSite((s) => ({ ...s, businessName: e.target.value }))
                    }
                    placeholder="Murphy's Plumbing"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">
                    Existing site (optional)
                  </label>
                  <Input
                    className="mt-1"
                    value={newSite.url}
                    onChange={(e) => setNewSite((s) => ({ ...s, url: e.target.value }))}
                    placeholder="https://murphysplumbing.ie"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600">Description</label>
                <Textarea
                  className="mt-1 no-zoom"
                  rows={4}
                  value={newSite.description}
                  onChange={(e) =>
                    setNewSite((s) => ({ ...s, description: e.target.value }))
                  }
                  placeholder="Who they are, who they serve, their vibe. The more you write, the better the AI matches the look and tone."
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600">
                  Services (comma-separated)
                </label>
                <Input
                  className="mt-1"
                  value={newSite.services}
                  onChange={(e) => setNewSite((s) => ({ ...s, services: e.target.value }))}
                  placeholder="Installations, Repairs, Maintenance"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-xs font-medium text-slate-900">
                  <Wand2 className="h-3.5 w-3.5 text-[#1D9CA1]" />
                  Anything specific you want? (free-form)
                </label>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Tell the AI exactly what to build. Describe sections, tone, features,
                  moves, photography style, pages, anything. The more specific you are,
                  the closer the first draft lands.
                </p>
                <Textarea
                  className="mt-1.5 no-zoom"
                  rows={4}
                  value={newSite.suggestions}
                  onChange={(e) =>
                    setNewSite((s) => ({ ...s, suggestions: e.target.value }))
                  }
                  placeholder={
                    'Examples:\n• "Dark hero with floating coffee cups, warm brown + cream, include a menu page and a story section about sourcing"\n• "Clean professional feel for a solicitor, include a practice areas sub-page, emphasise 25 years of experience"\n• "Bright playful barber site with prices, team with specialties, before/after shots, book via WhatsApp"'
                  }
                />
              </div>

              {/* Brand colors + logo */}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <label className="text-xs font-medium text-slate-600">
                    Primary color <span className="text-slate-400">(optional)</span>
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="color"
                      value={newSite.primaryColor || '#1D9CA1'}
                      onChange={(e) => setNewSite((s) => ({ ...s, primaryColor: e.target.value }))}
                      className="h-9 w-9 cursor-pointer rounded-lg border border-slate-200"
                    />
                    <Input
                      value={newSite.primaryColor}
                      onChange={(e) => setNewSite((s) => ({ ...s, primaryColor: e.target.value }))}
                      className="h-9 flex-1 font-mono text-xs"
                      placeholder="Auto-detect"
                      maxLength={7}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">
                    Accent color <span className="text-slate-400">(optional)</span>
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="color"
                      value={newSite.accentColor || '#48D886'}
                      onChange={(e) => setNewSite((s) => ({ ...s, accentColor: e.target.value }))}
                      className="h-9 w-9 cursor-pointer rounded-lg border border-slate-200"
                    />
                    <Input
                      value={newSite.accentColor}
                      onChange={(e) => setNewSite((s) => ({ ...s, accentColor: e.target.value }))}
                      className="h-9 flex-1 font-mono text-xs"
                      placeholder="Auto-detect"
                      maxLength={7}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">
                    Logo <span className="text-slate-400">(optional)</span>
                  </label>
                  <LogoPicker
                    value={newSite.logoUrl}
                    onChange={(url) => setNewSite((s) => ({ ...s, logoUrl: url }))}
                    clientId={newSite.clientId}
                  />
                </div>
              </div>

              {/* Client images preview + media role tagging */}
              <div className="border-t border-slate-100 pt-4">
                <button
                  onClick={() => setMediaPanelOpen((o) => !o)}
                  className="flex w-full items-center justify-between text-left"
                >
                  <span className="text-xs font-medium text-slate-600">
                    Client media
                    <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                      {clientImages.length}
                    </span>
                    {Object.values(newSite.mediaTags).filter((t) => t.length > 0).length > 0 ? (
                      <span className="ml-2 rounded-full bg-[#1D9CA1]/10 px-2 py-0.5 text-[10px] font-semibold text-[#1D9CA1]">
                        {Object.values(newSite.mediaTags).filter((t) => t.length > 0).length} tagged
                      </span>
                    ) : null}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 text-slate-400 transition-transform ${
                      mediaPanelOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                <p className="mt-1 text-[11px] text-slate-400">
                  Upload or pick from the client library and tag each photo for hero, gallery,
                  about, portfolio, team, or product. Tagging nudges the AI to place that image
                  in the right section.
                </p>
                {!mediaPanelOpen && clientImages.length > 0 ? (
                  <div className="mt-2 flex gap-2 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-2">
                    {clientImages.slice(0, 12).map((src, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={`${src}-${i}`}
                        src={src}
                        alt=""
                        className="h-16 w-16 shrink-0 rounded-lg object-cover"
                      />
                    ))}
                    {clientImages.length > 12 && (
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-xs font-semibold text-slate-600">
                        +{clientImages.length - 12}
                      </div>
                    )}
                  </div>
                ) : null}
                <AnimatePresence>
                  {mediaPanelOpen ? (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <MediaTaggingGrid
                        clientId={newSite.clientId}
                        images={clientImages}
                        imageRows={clientImageRows}
                        tags={newSite.mediaTags}
                        onTagsChange={(mediaTags) =>
                          setNewSite((s) => ({ ...s, mediaTags }))
                        }
                        onUploadComplete={() => mutateClientImages()}
                      />
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={newSite.hasBooking}
                    onChange={(e) =>
                      setNewSite((s) => ({ ...s, hasBooking: e.target.checked }))
                    }
                    className="h-4 w-4 rounded border-slate-300 text-[#48D886] focus:ring-[#48D886]"
                  />
                  Include booking form
                </label>
                <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={newSite.hasHours}
                    onChange={(e) =>
                      setNewSite((s) => ({ ...s, hasHours: e.target.checked }))
                    }
                    className="h-4 w-4 rounded border-slate-300 text-[#48D886] focus:ring-[#48D886]"
                  />
                  Show opening hours
                </label>
              </div>

              {/* Business details — seeded facts that override AI invention */}
              <div className="border-t border-slate-100 pt-4">
                <button
                  onClick={() => setDetailsOpen((o) => !o)}
                  className="flex w-full items-center justify-between text-left"
                >
                  <span className="text-xs font-medium text-slate-600">
                    Business details
                    <span className="ml-2 text-[10px] font-normal text-slate-400">
                      address, phone, team, service areas
                    </span>
                    {detailsCompletionCount(newSite) > 0 ? (
                      <span className="ml-2 rounded-full bg-[#48D886]/10 px-2 py-0.5 text-[10px] font-semibold text-[#15803d]">
                        {detailsCompletionCount(newSite)} set
                      </span>
                    ) : null}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 text-slate-400 transition-transform ${
                      detailsOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                <AnimatePresence>
                  {detailsOpen ? (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <p className="mt-2 text-[11px] text-slate-500">
                        Typing these in means Claude uses them verbatim rather than inventing.
                        Leave blank to let the AI decide. The contact block, team, service areas,
                        trust badges, and socials all seed directly from here.
                      </p>
                      <BusinessDetailsPanel
                        value={newSite}
                        onChange={(patch) => setNewSite((s) => ({ ...s, ...patch }))}
                        clientId={newSite.clientId}
                      />
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>

              {/* Extras — specifics that sharpen copy */}
              <div className="border-t border-slate-100 pt-4">
                <button
                  onClick={() => setExtrasOpen((o) => !o)}
                  className="flex w-full items-center justify-between text-left"
                >
                  <span className="text-xs font-medium text-slate-600">
                    Extras
                    <span className="ml-2 text-[10px] font-normal text-slate-400">
                      founded, awards, USPs, audience, vibe
                    </span>
                    {extrasCompletionCount(newSite) > 0 ? (
                      <span className="ml-2 rounded-full bg-[#FFEC3D]/30 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                        {extrasCompletionCount(newSite)} set
                      </span>
                    ) : null}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 text-slate-400 transition-transform ${
                      extrasOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                <AnimatePresence>
                  {extrasOpen ? (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <p className="mt-2 text-[11px] text-slate-500">
                        Every field optional. The more you fill in, the more specific and
                        credible the copy feels — "15 years in business", "winner of Best
                        Local Trader 2024", "for busy parents who value reliability".
                      </p>
                      <ExtrasPanel
                        value={newSite}
                        onChange={(patch) => setNewSite((s) => ({ ...s, ...patch }))}
                      />
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>

              {/* Collapsed template override */}
              <div className="border-t border-slate-100 pt-4">
                <button
                  onClick={() => setTemplateOverrideOpen((o) => !o)}
                  className="flex w-full items-center justify-between text-left"
                >
                  <span className="text-xs font-medium text-slate-600">
                    Advanced: force a specific template
                    {newSite.template ? (
                      <span className="ml-2 rounded-full bg-[#1D9CA1]/10 px-2 py-0.5 text-[10px] font-semibold text-[#1D9CA1]">
                        {newSite.template}
                      </span>
                    ) : null}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 text-slate-400 transition-transform ${
                      templateOverrideOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                <AnimatePresence>
                  {templateOverrideOpen ? (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <p className="mt-2 text-[11px] text-slate-500">
                        Leave this off to let the AI pick. Only override when you
                        know the business doesn&apos;t match any obvious industry keyword.
                      </p>
                      <div className="mt-2 grid grid-cols-2 gap-1.5 md:grid-cols-3">
                        <button
                          onClick={() =>
                            setNewSite((s) => ({ ...s, template: undefined }))
                          }
                          className={`rounded-lg border p-2 text-left text-[11px] transition-all ${
                            newSite.template === undefined
                              ? 'border-[#1D9CA1] bg-[#1D9CA1]/5 text-[#1D9CA1]'
                              : 'border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          <span className="font-semibold">Auto-detect</span>
                          <span className="block text-slate-400">
                            Recommended
                          </span>
                        </button>
                        {TEMPLATES.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => setNewSite((s) => ({ ...s, template: t.id }))}
                            className={`rounded-lg border p-2 text-left text-[11px] transition-all ${
                              newSite.template === t.id
                                ? 'border-[#1D9CA1] bg-[#1D9CA1]/5 text-[#1D9CA1]'
                                : 'border-slate-200 text-slate-600 hover:border-slate-300'
                            }`}
                          >
                            <span className="font-semibold">{t.name}</span>
                            <span className="block truncate text-slate-400">
                              {t.description}
                            </span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>

              <div className="flex flex-col items-stretch gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs">
                  {!clientsLoading && clients.length === 0 ? (
                    <span className="text-rose-600">
                      No clients yet — <a href="/dashboard/clients" className="font-semibold underline">create one on the Clients tab</a> first.
                    </span>
                  ) : (
                    <span className="text-slate-500">
                      Generation takes ~30–60s (includes AI hero image).
                    </span>
                  )}
                </div>
                <Button
                  onClick={() => generate()}
                  loading={running}
                  size="lg"
                  disabled={running || clientsLoading || !newSite.clientId || clients.length === 0}
                >
                  {running ? <Spinner /> : <Sparkles className="h-4 w-4" />}
                  {running
                    ? 'Generating…'
                    : clientsLoading
                      ? 'Loading clients…'
                      : clients.length === 0
                        ? 'Add a client first'
                        : 'Generate site'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <aside className="space-y-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Wand2 className="h-4 w-4 text-[#1D9CA1]" />
                  Pipeline
                </div>
                <ol className="mt-4 space-y-3">
                  {steps.map((s, i) => (
                    <li key={s.key} className="flex items-center gap-3 text-sm">
                      <div
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
                          s.status === 'done'
                            ? 'bg-gradient-cta text-white'
                            : s.status === 'doing'
                              ? 'bg-[#FFEC3D] text-slate-900'
                              : s.status === 'failed'
                                ? 'bg-rose-500 text-white'
                                : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {s.status === 'done' ? (
                          <Check className="h-3 w-3" />
                        ) : s.status === 'doing' ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : s.status === 'failed' ? (
                          '!'
                        ) : (
                          i + 1
                        )}
                      </div>
                      <span className={s.status === 'idle' ? 'text-slate-500' : 'text-slate-900'}>
                        {s.label}
                      </span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <h2 className="text-sm font-semibold text-slate-900">Live client sites</h2>
                <p className="mt-1 text-[11px] text-slate-500">
                  Clients with a generated site. Shows custom domain if attached,
                  otherwise the default /sites/ URL.
                </p>
                <div className="mt-4 space-y-3">
                  {clients
                    .filter((c) => c.subscriptionTier !== 'social_only' && c.websiteConfig)
                    .slice(0, 8)
                    .map((c) => {
                      const hasCustom =
                        c.customDomain && c.customDomainStatus === 'verified';
                      const host = hasCustom
                        ? (c.customDomain as string)
                        : `${APP_URL.replace(/^https?:\/\//, '')}/sites/${c.slug ?? slugify(c.businessName)}`;
                      const href = hasCustom
                        ? `https://${c.customDomain}`
                        : `${APP_URL}/sites/${c.slug ?? slugify(c.businessName)}`;
                      return (
                        <a
                          key={c.id}
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 transition-colors hover:bg-slate-50"
                        >
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-cta text-white">
                            <Globe className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-slate-900">
                              {c.businessName}
                            </div>
                            <div className="truncate text-[11px] text-slate-500">{host}</div>
                          </div>
                          {hasCustom ? (
                            <Badge tone="success">
                              <span className="text-[10px] font-semibold uppercase">
                                Custom
                              </span>
                            </Badge>
                          ) : null}
                          <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                        </a>
                      );
                    })}
                  {clients.filter((c) => c.websiteConfig).length === 0 && (
                    <p className="py-2 text-center text-[11px] text-slate-400">
                      No sites generated yet.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-[#1D9CA1]" />
                  <h2 className="text-sm font-semibold text-slate-900">Change requests</h2>
                </div>
                <div className="mt-3 space-y-2">
                  {mockWebsiteRequests.map((r) => {
                    const c = mockClients.find((x) => x.id === r.clientId);
                    return (
                      <div key={r.id} className="rounded-xl bg-slate-50 p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-900">
                            {c?.businessName}
                          </span>
                          <Badge
                            tone={
                              r.status === 'completed'
                                ? 'success'
                                : r.status === 'in_progress'
                                  ? 'info'
                                  : 'warning'
                            }
                          >
                            {r.status.replace('_', ' ')}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-slate-600">{r.description}</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </aside>
        </section>

        <AnimatePresence>
          {config ? (
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="text-sm font-semibold text-slate-900">Live preview</h2>
                  {saving ? (
                    <span className="flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Saving…
                    </span>
                  ) : hasUnsavedChanges ? (
                    <span className="flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
                      Unsaved changes
                    </span>
                  ) : lastSaved ? (
                    <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                      <Check className="h-3 w-3" />
                      Saved
                    </span>
                  ) : null}
                  {editMode ? (
                    <Badge tone="info">
                      <span className="text-[10px] font-semibold uppercase tracking-wider">
                        Edit mode
                      </span>
                    </Badge>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {/* Manual Save button — useful when the user wants to
                      persist right now without waiting for the 1.5s
                      debounce (e.g. before reloading or closing the tab). */}
                  <Button
                    size="sm"
                    variant={hasUnsavedChanges ? 'primary' : 'outline'}
                    onClick={() => flushSave()}
                    disabled={saving || !hasUnsavedChanges}
                    title="Save now (⌘S)"
                  >
                    {saving ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Check className="h-3 w-3" />
                    )}
                    {saving ? 'Saving' : 'Save'}
                  </Button>
                  {/* Inline edit toggle — exposed here so it's discoverable
                      without diving into the editor panel. */}
                  <Button
                    size="sm"
                    variant={editMode ? 'primary' : 'outline'}
                    onClick={() => setEditMode((v) => !v)}
                    title={
                      editMode
                        ? 'Turn off inline editing'
                        : 'Click any text in the preview to edit it'
                    }
                  >
                    <Edit3 className="h-3 w-3" />
                    {editMode ? 'Editing' : 'Edit content'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      if (
                        !(await confirmDialog({
                          title: 'Delete this website config?',
                          description:
                            'The client will see a "coming soon" page until you regenerate.',
                          confirmLabel: 'Delete site',
                          danger: true,
                        }))
                      )
                        return;
                      try {
                        await api.deleteWebsiteConfig(newSite.clientId);
                        setConfig(null);
                        setEditMode(false);
                        toast.success('Website config cleared');
                      } catch (e) {
                        toast.error('Delete failed', (e as Error).message);
                      }
                    }}
                    className="text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 className="h-3 w-3" />
                    Delete
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => generate()}
                    disabled={running}
                  >
                    <Sparkles className="h-3 w-3" />
                    Regenerate
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      generate({
                        designSeed:
                          typeof crypto !== 'undefined' && 'randomUUID' in crypto
                            ? crypto.randomUUID()
                            : `${Date.now()}-${Math.random()}`,
                      })
                    }
                    disabled={running}
                    title="Regenerate with a different visual signature — same content, new look"
                  >
                    <Wand2 className="h-3 w-3" />
                    Try another look
                  </Button>
                  <a
                    href={`${APP_URL}/sites/${selectedClient?.slug ?? slugify(selectedClient?.businessName ?? '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button size="sm" variant="outline">
                      Open full page
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  </a>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
                <Card>
                  <CardContent className="p-0 overflow-hidden">
                    {/* Browser chrome + page switcher for multipage sites */}
                    <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
                      <div className="ml-3 flex-1 truncate rounded-md bg-white px-3 py-1 text-[11px] text-slate-500">
                        {config.meta.title}
                      </div>
                      {/* Device-mode toggle — constrain the preview width so
                          mobile / tablet layouts can be eyeballed without
                          opening a second browser window. */}
                      <div
                        className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5"
                        role="radiogroup"
                        aria-label="Preview device size"
                      >
                        {(
                          [
                            { id: 'desktop', label: 'Desktop', Icon: Monitor },
                            { id: 'tablet', label: 'Tablet', Icon: Tablet },
                            { id: 'mobile', label: 'Mobile', Icon: Smartphone },
                          ] as const
                        ).map(({ id, label, Icon }) => {
                          const active = device === id;
                          return (
                            <button
                              key={id}
                              role="radio"
                              aria-checked={active}
                              aria-label={label}
                              title={label}
                              onClick={() => setDevice(id)}
                              className={`flex h-6 w-7 items-center justify-center rounded-md transition-colors ${
                                active
                                  ? 'bg-[#1D9CA1] text-white'
                                  : 'text-slate-500 hover:bg-slate-100'
                              }`}
                            >
                              <Icon className="h-3.5 w-3.5" />
                            </button>
                          );
                        })}
                      </div>
                      {(config.pages?.length ?? 0) > 1 ? (
                        <PagePicker
                          pages={config.pages!}
                          current={previewPageSlug}
                          onSelect={setPreviewPageSlug}
                        />
                      ) : null}
                    </div>
                    {/* Inline-edit hint — shows when edit mode is on so the
                        user knows they can click any text in the preview. */}
                    {editMode ? (
                      <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-[11px] text-amber-800">
                        <Edit3 className="h-3 w-3" />
                        Click any headline, subheading, or service card in the preview below to edit. Press Enter to save, Esc to cancel.
                      </div>
                    ) : null}
                    <PreviewFrame
                      device={device}
                      liveUrl={
                        selectedClient?.slug
                          ? `${APP_URL}/sites/${selectedClient.slug}`
                          : undefined
                      }
                      pageSlug={previewPageSlug}
                    >
                      <SiteRenderer
                        config={config}
                        businessName={selectedClient?.businessName ?? 'Your Business'}
                        images={clientImages}
                        clientId={newSite.clientId}
                        embedded
                        editMode={editMode}
                        onFieldChange={handleFieldChange}
                        onImageClick={(ctx) => setImagePicker(ctx)}
                        onAIEdit={async (instruction, options) => {
                          if (!config || !newSite.clientId) {
                            throw new Error('No site loaded yet');
                          }
                          const result = await api.editWebsiteWithAI({
                            clientId: newSite.clientId,
                            currentConfig: config as unknown as Record<string, unknown>,
                            instruction,
                            model: options?.model,
                          });
                          setConfig(sanitizeConfig(result.config));
                          return result.summary ?? 'Done — site updated.';
                        }}
                        pageSlug={previewPageSlug}
                      />
                    </PreviewFrame>
                  </CardContent>
                </Card>

                {/* Editor column. Sticky on wide screens so it stays in
                    view while scrolling through the preview. On narrow
                    screens the grid collapses to single column and the
                    editor stacks naturally below the preview. */}
                <div className="lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
                  <SiteEditor
                    config={config}
                    onChange={handleConfigChange}
                    clientId={newSite.clientId}
                    images={clientImages}
                    imageRows={clientImageRows}
                    onImageLabelChange={async (id, aiDescription) => {
                      try {
                        await api.updateImage(id, { aiDescription });
                        mutateClientImages();
                      } catch (e) {
                        toast.error('Label update failed', (e as Error).message);
                      }
                    }}
                    editMode={editMode}
                    onEditModeChange={setEditMode}
                    activePageSlug={previewPageSlug}
                    onActivePageSlugChange={setPreviewPageSlug}
                  />
                </div>
              </div>

              <details className="rounded-2xl border border-slate-200 bg-white p-4">
                <summary className="cursor-pointer text-sm font-semibold text-slate-900">
                  View raw config JSON
                </summary>
                <pre className="mt-3 max-h-96 overflow-auto rounded-lg bg-slate-900 p-4 text-[11px] text-slate-100">
                  {JSON.stringify(config, null, 2)}
                </pre>
              </details>
            </motion.section>
          ) : null}
        </AnimatePresence>
      </div>

      {/* Image picker overlay — opens when the user clicks any image in
          edit-mode preview. */}
      {imagePicker ? (
        <ImagePickerModal
          images={clientImages}
          imageRows={clientImageRows}
          clientId={newSite.clientId}
          onPick={(pick) => {
            const fieldName = imagePicker.fieldName;
            const base = imagePicker.path;

            // Direct mode: the path IS the target. Used for arrays of
            // primitives like gallery.imageIndices.3 where we just want
            // to set one array slot.
            if (fieldName === 'direct') {
              if (pick.kind === 'library') {
                handleFieldChange(base, pick.index);
              } else {
                // URL-based items aren't valid in a number-array context,
                // but we support it by using the string URL instead.
                handleFieldChange(base, pick.url);
              }
              setImagePicker(null);
              return;
            }

            // Write ONLY the field the block actually reads. If the block
            // supports both imageIndex + imageUrl, clear the other so the
            // precedence is unambiguous (url wins over index when set).
            // We send `null` (not undefined) when clearing — undefined
            // is dropped by JSON.stringify and the API requires a value.
            //
            // The index/url pairs we know about:
            //   imageIndex  ↔ imageUrl   (most blocks)
            //   photoIndex  ↔ photoUrl   (team members)
            //   logoIndex   ↔ logoUrl    (brand logo in nav)
            const INDEX_TO_URL: Record<string, string> = {
              imageIndex: 'imageUrl',
              photoIndex: 'photoUrl',
              logoIndex: 'logoUrl',
              secondaryImageIndex: 'secondaryImageUrl',
            };
            const URL_TO_INDEX: Record<string, string> = {
              imageUrl: 'imageIndex',
              photoUrl: 'photoIndex',
              logoUrl: 'logoIndex',
              secondaryImageUrl: 'secondaryImageIndex',
            };

            if (pick.kind === 'library') {
              // User picked from the gallery — write the index, clear
              // any corresponding URL override so precedence is clear.
              const indexField =
                fieldName in URL_TO_INDEX ? URL_TO_INDEX[fieldName]! : fieldName;
              handleFieldChange(`${base}.${indexField}`, pick.index);
              const urlField = INDEX_TO_URL[indexField];
              if (urlField) handleFieldChange(`${base}.${urlField}`, null);
            } else {
              // User pasted / uploaded a direct URL — write it to the
              // URL field, clear the corresponding index so precedence
              // is clear.
              const urlField =
                fieldName in INDEX_TO_URL ? INDEX_TO_URL[fieldName]! : fieldName;
              handleFieldChange(`${base}.${urlField}`, pick.url);
              const indexField = URL_TO_INDEX[urlField];
              if (indexField) handleFieldChange(`${base}.${indexField}`, null);
            }
            setImagePicker(null);
          }}
          onClose={() => setImagePicker(null)}
        />
      ) : null}
    </>
  );
}

/**
 * Logo input: accepts either a pasted URL or a file upload from the user's
 * laptop. Uploads reuse the existing `uploadImages` endpoint with a
 * `logo` tag so the logo lives in the same media library as the client's
 * other assets, and we just echo back the resulting URL.
 *
 * Needs a real (DB-backed) clientId to upload. If no client is selected
 * yet we disable the upload button with a hint.
 */
function LogoPicker({
  value,
  onChange,
  clientId,
}: {
  value: string;
  onChange: (url: string) => void;
  clientId: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const onFile = async (file: File) => {
    if (!clientId) {
      toast.error('Pick a client first');
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Pick an image file', 'PNG, JPG, SVG, or WebP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Too large', 'Keep logos under 5MB.');
      return;
    }
    setUploading(true);
    try {
      const rows = await api.uploadImages(clientId, [file], ['logo']);
      const url = rows[0]?.fileUrl;
      if (!url) throw new Error('Upload returned no URL');
      onChange(url);
      toast.success('Logo uploaded');
    } catch (e) {
      toast.error('Upload failed', (e as Error).message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="mt-1 space-y-1.5">
      <div className="flex items-center gap-2">
        {value ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={value}
            alt="Logo preview"
            className="h-9 w-9 shrink-0 rounded-lg border border-slate-200 object-contain bg-slate-50"
          />
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-slate-400">
            <Globe className="h-3.5 w-3.5" />
          </div>
        )}
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 flex-1 text-xs"
          placeholder="Paste URL or upload →"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || !clientId}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          title={!clientId ? 'Pick a client first' : 'Upload from your computer'}
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ArrowRight className="h-3.5 w-3.5 rotate-[-45deg]" />
          )}
          {uploading ? 'Uploading…' : 'Upload'}
        </button>
      </div>
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          className="text-[10px] text-slate-500 hover:text-slate-700"
        >
          Remove logo
        </button>
      ) : null}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
        }}
      />
    </div>
  );
}

/**
 * Tab-style picker for switching the preview between pages of a multipage
 * site. Rendered in the browser-chrome bar above the preview so it feels
 * like the browser's tab strip, reinforcing "these are separate pages".
 *
 * Only rendered when `config.pages` has more than one entry — single-page
 * sites don't need a picker.
 */
function PagePicker({
  pages,
  current,
  onSelect,
}: {
  pages: NonNullable<WebsiteConfig['pages']>;
  current: string;
  onSelect: (slug: string) => void;
}) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto">
      {pages.map((p) => {
        const active = p.slug === current;
        return (
          <button
            key={p.slug}
            type="button"
            onClick={() => onSelect(p.slug)}
            aria-pressed={active}
            className={`shrink-0 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
              active
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            {p.title}
          </button>
        );
      })}
    </div>
  );
}


/**
 * Quick count of how many "business details" fields the agency has filled in
 * — shown as a badge on the collapsed panel so they can tell at a glance
 * whether they've seeded the site with real data or are about to generate
 * a mostly-invented one.
 */
function detailsCompletionCount(v: {
  address: string;
  phone: string;
  email: string;
  whatsapp: string;
  hours: string;
  socials: Record<string, string>;
  team: Array<unknown>;
  serviceAreas: string;
  trustBadges: Array<unknown>;
}): number {
  let n = 0;
  if (v.address.trim()) n++;
  if (v.phone.trim()) n++;
  if (v.email.trim()) n++;
  if (v.whatsapp.trim()) n++;
  if (v.hours.trim()) n++;
  if (Object.values(v.socials).some((s) => s.trim())) n++;
  if (v.team.length > 0) n++;
  if (v.serviceAreas.trim()) n++;
  if (v.trustBadges.length > 0) n++;
  return n;
}

/** Split a comma-separated string into trimmed, non-empty parts or return undefined. */
function splitCsv(v: string): string[] | undefined {
  const parts = v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : undefined;
}

/** Count of "extras" fields filled in — for the badge in the collapsed panel. */
function extrasCompletionCount(v: {
  yearFounded: string;
  awards: string;
  pressMentions: Array<{ outlet: string }>;
  certifications: string;
  languagesSpoken: string;
  paymentMethods: string;
  insuranceDetails: string;
  uniqueSellingPoints: string[];
  targetAudience: string;
  competitivePositioning: string;
  inspirationLinks: string[];
}): number {
  let n = 0;
  if (v.yearFounded.trim()) n++;
  if (v.awards.trim()) n++;
  if (v.pressMentions.some((p) => p.outlet.trim())) n++;
  if (v.certifications.trim()) n++;
  if (v.languagesSpoken.trim()) n++;
  if (v.paymentMethods.trim()) n++;
  if (v.insuranceDetails.trim()) n++;
  if (v.uniqueSellingPoints.some((u) => u.trim())) n++;
  if (v.targetAudience.trim()) n++;
  if (v.competitivePositioning.trim()) n++;
  if (v.inspirationLinks.some((l) => l.trim())) n++;
  return n;
}

/**
 * Expandable "Business details" panel for the generation form. Captures
 * everything that's a fact (not a creative choice) so the generated site
 * uses it verbatim.
 *
 *   Contact      — address, phone, WhatsApp, email, hours
 *   Socials      — facebook/instagram/tiktok/x/linkedin/youtube/google
 *   Team         — dynamic list of {name, role, bio, photo}
 *   Areas        — comma-separated towns/regions (for tradesmen)
 *   Badges       — dynamic list of {label, detail, href}
 *
 * All fields optional. When a client has an existing site we scraped,
 * the agency can paste facts here directly; when it's a brand-new
 * business, leaving these blank lets the AI generate placeholders.
 */
function BusinessDetailsPanel({
  value,
  onChange,
  clientId,
}: {
  value: {
    address: string;
    phone: string;
    email: string;
    whatsapp: string;
    hours: string;
    socials: {
      facebook: string;
      instagram: string;
      tiktok: string;
      linkedin: string;
      x: string;
      youtube: string;
      google: string;
    };
    team: Array<{
      name: string;
      role: string;
      bio?: string;
      credentials?: string;
      specialties?: string[];
      photoUrl?: string;
    }>;
    serviceAreas: string;
    trustBadges: Array<{ label: string; detail?: string; href?: string }>;
  };
  onChange: (patch: Partial<typeof value>) => void;
  clientId: string;
}) {
  return (
    <div className="mt-3 space-y-4">
      {/* Contact */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Contact
        </p>
        <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
          <Input
            value={value.address}
            onChange={(e) => onChange({ address: e.target.value })}
            placeholder="Street address — powers the map embed"
            className="h-10 text-xs"
          />
          <Input
            value={value.phone}
            onChange={(e) => onChange({ phone: e.target.value })}
            placeholder="+353 1 555 0100"
            className="h-10 text-xs"
          />
          <Input
            value={value.email}
            onChange={(e) => onChange({ email: e.target.value })}
            placeholder="hello@business.ie"
            className="h-10 text-xs"
            type="email"
          />
          <Input
            value={value.whatsapp}
            onChange={(e) => onChange({ whatsapp: e.target.value })}
            placeholder="WhatsApp number (shown on mobile CTA)"
            className="h-10 text-xs"
          />
          <Textarea
            value={value.hours}
            onChange={(e) => onChange({ hours: e.target.value })}
            placeholder="Mon–Fri 9am–6pm&#10;Sat 10am–3pm"
            className="md:col-span-2 no-zoom text-xs"
            rows={2}
          />
        </div>
      </div>

      {/* Socials */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Socials
        </p>
        <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
          {(
            [
              ['facebook', 'Facebook URL'],
              ['instagram', 'Instagram URL'],
              ['tiktok', 'TikTok URL'],
              ['x', 'X / Twitter URL'],
              ['linkedin', 'LinkedIn URL'],
              ['youtube', 'YouTube URL'],
              ['google', 'Google Business Profile URL'],
            ] as const
          ).map(([key, placeholder]) => (
            <Input
              key={key}
              value={value.socials[key]}
              onChange={(e) =>
                onChange({ socials: { ...value.socials, [key]: e.target.value } })
              }
              placeholder={placeholder}
              className="h-9 text-xs"
            />
          ))}
        </div>
      </div>

      {/* Service areas */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Service areas
          <span className="ml-2 font-normal text-slate-400">
            comma-separated towns/regions
          </span>
        </p>
        <Textarea
          value={value.serviceAreas}
          onChange={(e) => onChange({ serviceAreas: e.target.value })}
          placeholder="Dublin, Malahide, Howth, Swords, Portmarnock"
          className="mt-2 text-xs no-zoom"
          rows={2}
        />
      </div>

      {/* Team members (dynamic list) */}
      <div>
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Team members
            {value.team.length > 0 ? (
              <span className="ml-2 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                {value.team.length}
              </span>
            ) : null}
          </p>
          <button
            type="button"
            onClick={() =>
              onChange({
                team: [
                  ...value.team,
                  { name: '', role: '' },
                ],
              })
            }
            className="flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-[10px] font-medium text-slate-600 hover:border-[#1D9CA1] hover:text-[#1D9CA1]"
          >
            <Sparkles className="h-2.5 w-2.5" />
            Add member
          </button>
        </div>
        {value.team.length === 0 ? (
          <p className="mt-2 text-[11px] text-slate-400">
            Leave blank for solo traders. Add members for salons, clinics, gyms, agencies.
          </p>
        ) : (
          <div className="mt-2 space-y-2">
            {value.team.map((m, i) => (
              <TeamMemberRow
                key={i}
                member={m}
                clientId={clientId}
                onChange={(patch) => {
                  const next = [...value.team];
                  next[i] = { ...next[i]!, ...patch };
                  onChange({ team: next });
                }}
                onRemove={() =>
                  onChange({ team: value.team.filter((_, j) => j !== i) })
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Trust badges (dynamic list) */}
      <div>
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Credentials / licences
            {value.trustBadges.length > 0 ? (
              <span className="ml-2 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                {value.trustBadges.length}
              </span>
            ) : null}
          </p>
          <button
            type="button"
            onClick={() =>
              onChange({
                trustBadges: [...value.trustBadges, { label: '' }],
              })
            }
            className="flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-[10px] font-medium text-slate-600 hover:border-[#1D9CA1] hover:text-[#1D9CA1]"
          >
            <Sparkles className="h-2.5 w-2.5" />
            Add badge
          </button>
        </div>
        {value.trustBadges.length === 0 ? (
          <p className="mt-2 text-[11px] text-slate-400">
            For regulated trades: RGI, Safe Electric, Gas Safe, Dental Council, insurance refs.
          </p>
        ) : (
          <div className="mt-2 space-y-2">
            {value.trustBadges.map((b, i) => (
              <div
                key={i}
                className="grid grid-cols-1 items-start gap-1 rounded-xl border border-slate-200 bg-white p-2 md:grid-cols-[1fr_1fr_auto]"
              >
                <Input
                  value={b.label}
                  onChange={(e) => {
                    const next = [...value.trustBadges];
                    next[i] = { ...next[i]!, label: e.target.value };
                    onChange({ trustBadges: next });
                  }}
                  placeholder="RGI Registered"
                  className="h-8 text-xs"
                />
                <Input
                  value={b.detail ?? ''}
                  onChange={(e) => {
                    const next = [...value.trustBadges];
                    next[i] = { ...next[i]!, detail: e.target.value };
                    onChange({ trustBadges: next });
                  }}
                  placeholder="Optional short detail"
                  className="h-8 text-xs"
                />
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      trustBadges: value.trustBadges.filter((_, j) => j !== i),
                    })
                  }
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500"
                  aria-label="Remove"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Single-row team member input with photo upload. Uploads reuse the same
 * media-library endpoint as every other image path so photos land in the
 * client's photo grid and get AI-scored alongside everything else.
 */
function TeamMemberRow({
  member,
  clientId,
  onChange,
  onRemove,
}: {
  member: {
    name: string;
    role: string;
    bio?: string;
    credentials?: string;
    specialties?: string[];
    photoUrl?: string;
  };
  clientId: string;
  onChange: (patch: Partial<typeof member>) => void;
  onRemove: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    if (!clientId) {
      toast.error('Pick a client first');
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Not an image');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Too large', 'Under 5MB.');
      return;
    }
    setUploading(true);
    try {
      const rows = await api.uploadImages(clientId, [file], ['team']);
      const url = rows[0]?.fileUrl;
      if (url) onChange({ photoUrl: url });
    } catch (e) {
      toast.error('Upload failed', (e as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-2.5">
      <div className="flex items-start gap-2">
        {/* Photo slot */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading || !clientId}
          className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 transition-colors hover:border-[#1D9CA1] disabled:opacity-50"
          title={!clientId ? 'Pick a client first' : 'Upload photo'}
        >
          {member.photoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={member.photoUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : uploading ? (
            <Loader2 className="mx-auto h-4 w-4 animate-spin text-slate-400" />
          ) : (
            <span className="text-[10px] text-slate-400">Photo</span>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
        </button>

        <div className="min-w-0 flex-1 space-y-1">
          <div className="grid grid-cols-2 gap-1">
            <Input
              value={member.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder="Name"
              className="h-7 text-xs"
            />
            <Input
              value={member.role}
              onChange={(e) => onChange({ role: e.target.value })}
              placeholder="Role"
              className="h-7 text-xs"
            />
          </div>
          <Input
            value={member.credentials ?? ''}
            onChange={(e) => onChange({ credentials: e.target.value })}
            placeholder="Credentials (optional, e.g. BDS MFDS)"
            className="h-7 text-xs"
          />
          <Input
            value={(member.specialties ?? []).join(', ')}
            onChange={(e) =>
              onChange({
                specialties: e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            placeholder="Specialties (comma-separated)"
            className="h-7 text-xs"
          />
          <Textarea
            value={member.bio ?? ''}
            onChange={(e) => onChange({ bio: e.target.value })}
            placeholder="Short bio (optional)"
            rows={2}
            className="text-xs no-zoom"
          />
        </div>

        <button
          type="button"
          onClick={onRemove}
          className="rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
          aria-label="Remove member"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/**
 * Optional "Extras" panel. Every field optional — the more the agency
 * fills in, the more specific and credible the generated copy gets.
 * These never overwrite AI output directly; they're passed as
 * authoritative facts in the Claude prompt.
 */
function ExtrasPanel({
  value,
  onChange,
}: {
  value: {
    yearFounded: string;
    awards: string;
    pressMentions: Array<{ outlet: string; quote?: string; href?: string }>;
    certifications: string;
    languagesSpoken: string;
    paymentMethods: string;
    insuranceDetails: string;
    uniqueSellingPoints: string[];
    targetAudience: string;
    competitivePositioning: string;
    inspirationLinks: string[];
  };
  onChange: (patch: Partial<typeof value>) => void;
}) {
  const addUsp = () => onChange({ uniqueSellingPoints: [...value.uniqueSellingPoints, ''] });
  const setUsp = (i: number, next: string) => {
    const arr = [...value.uniqueSellingPoints];
    arr[i] = next;
    onChange({ uniqueSellingPoints: arr });
  };
  const removeUsp = (i: number) =>
    onChange({ uniqueSellingPoints: value.uniqueSellingPoints.filter((_, j) => j !== i) });

  const addLink = () => onChange({ inspirationLinks: [...value.inspirationLinks, ''] });
  const setLink = (i: number, next: string) => {
    const arr = [...value.inspirationLinks];
    arr[i] = next;
    onChange({ inspirationLinks: arr });
  };
  const removeLink = (i: number) =>
    onChange({ inspirationLinks: value.inspirationLinks.filter((_, j) => j !== i) });

  const addPress = () =>
    onChange({ pressMentions: [...value.pressMentions, { outlet: '' }] });
  const setPress = (i: number, patch: Partial<{ outlet: string; quote?: string; href?: string }>) => {
    const arr = [...value.pressMentions];
    arr[i] = { ...arr[i]!, ...patch };
    onChange({ pressMentions: arr });
  };
  const removePress = (i: number) =>
    onChange({ pressMentions: value.pressMentions.filter((_, j) => j !== i) });

  return (
    <div className="mt-3 space-y-4">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Year founded
          </p>
          <Input
            value={value.yearFounded}
            onChange={(e) => onChange({ yearFounded: e.target.value })}
            placeholder="2008"
            className="mt-1 h-9 text-xs"
            maxLength={8}
          />
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Insurance / coverage
          </p>
          <Input
            value={value.insuranceDetails}
            onChange={(e) => onChange({ insuranceDetails: e.target.value })}
            placeholder="£5M public liability, Allianz"
            className="mt-1 h-9 text-xs"
          />
        </div>
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Awards / recognitions
          <span className="ml-2 font-normal text-slate-400">comma-separated</span>
        </p>
        <Input
          value={value.awards}
          onChange={(e) => onChange({ awards: e.target.value })}
          placeholder="Best Local Trader 2024, Top Rated Pro"
          className="mt-1 h-9 text-xs"
        />
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Certifications / memberships
          <span className="ml-2 font-normal text-slate-400">comma-separated</span>
        </p>
        <Input
          value={value.certifications}
          onChange={(e) => onChange({ certifications: e.target.value })}
          placeholder="Gas Safe, NICEIC, City & Guilds"
          className="mt-1 h-9 text-xs"
        />
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Languages spoken
            <span className="ml-2 font-normal text-slate-400">comma-separated</span>
          </p>
          <Input
            value={value.languagesSpoken}
            onChange={(e) => onChange({ languagesSpoken: e.target.value })}
            placeholder="English, Irish, Polish"
            className="mt-1 h-9 text-xs"
          />
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Payment methods
            <span className="ml-2 font-normal text-slate-400">comma-separated</span>
          </p>
          <Input
            value={value.paymentMethods}
            onChange={(e) => onChange({ paymentMethods: e.target.value })}
            placeholder="Cash, card, bank transfer, invoice"
            className="mt-1 h-9 text-xs"
          />
        </div>
      </div>

      {/* USPs */}
      <div>
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Unique selling points
            {value.uniqueSellingPoints.length > 0 ? (
              <span className="ml-2 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                {value.uniqueSellingPoints.length}
              </span>
            ) : null}
          </p>
          <button
            type="button"
            onClick={addUsp}
            className="flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-[10px] font-medium text-slate-600 hover:border-[#1D9CA1] hover:text-[#1D9CA1]"
          >
            <Sparkles className="h-2.5 w-2.5" />
            Add USP
          </button>
        </div>
        {value.uniqueSellingPoints.length === 0 ? (
          <p className="mt-1 text-[11px] text-slate-400">
            Short punchy differentiators — "24/7 call-outs", "no job too small",
            "female-led team", "10-year workmanship guarantee".
          </p>
        ) : (
          <div className="mt-2 space-y-1.5">
            {value.uniqueSellingPoints.map((u, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <Input
                  value={u}
                  onChange={(e) => setUsp(i, e.target.value)}
                  placeholder={`USP ${i + 1}`}
                  className="h-8 flex-1 text-xs"
                />
                <button
                  type="button"
                  onClick={() => removeUsp(i)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500"
                  aria-label="Remove USP"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Press */}
      <div>
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Press / media mentions
            {value.pressMentions.length > 0 ? (
              <span className="ml-2 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                {value.pressMentions.length}
              </span>
            ) : null}
          </p>
          <button
            type="button"
            onClick={addPress}
            className="flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-[10px] font-medium text-slate-600 hover:border-[#1D9CA1] hover:text-[#1D9CA1]"
          >
            <Sparkles className="h-2.5 w-2.5" />
            Add mention
          </button>
        </div>
        {value.pressMentions.length === 0 ? (
          <p className="mt-1 text-[11px] text-slate-400">
            Outlets that covered the business. Quote optional.
          </p>
        ) : (
          <div className="mt-2 space-y-1.5">
            {value.pressMentions.map((p, i) => (
              <div
                key={i}
                className="grid grid-cols-1 items-start gap-1 rounded-xl border border-slate-200 bg-white p-2 md:grid-cols-[1fr_1.4fr_auto]"
              >
                <Input
                  value={p.outlet}
                  onChange={(e) => setPress(i, { outlet: e.target.value })}
                  placeholder="RTE News"
                  className="h-8 text-xs"
                />
                <Input
                  value={p.quote ?? ''}
                  onChange={(e) => setPress(i, { quote: e.target.value })}
                  placeholder="Optional short quote"
                  className="h-8 text-xs"
                />
                <button
                  type="button"
                  onClick={() => removePress(i)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500"
                  aria-label="Remove mention"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Positioning */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Target audience
        </p>
        <Textarea
          value={value.targetAudience}
          onChange={(e) => onChange({ targetAudience: e.target.value })}
          placeholder="Busy professionals in south Dublin who value reliability over cheapness."
          rows={2}
          className="mt-1 text-xs no-zoom"
        />
      </div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Competitive positioning
        </p>
        <Textarea
          value={value.competitivePositioning}
          onChange={(e) => onChange({ competitivePositioning: e.target.value })}
          placeholder="The premium local option — slightly higher prices, same-day service, fully-insured guarantee."
          rows={2}
          className="mt-1 text-xs no-zoom"
        />
      </div>

      {/* Inspiration */}
      <div>
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Inspiration links
            {value.inspirationLinks.length > 0 ? (
              <span className="ml-2 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                {value.inspirationLinks.length}
              </span>
            ) : null}
          </p>
          <button
            type="button"
            onClick={addLink}
            className="flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-[10px] font-medium text-slate-600 hover:border-[#1D9CA1] hover:text-[#1D9CA1]"
          >
            <Sparkles className="h-2.5 w-2.5" />
            Add link
          </button>
        </div>
        {value.inspirationLinks.length === 0 ? (
          <p className="mt-1 text-[11px] text-slate-400">
            Other sites whose vibe you want to echo. The AI reads these as style cues,
            never copies their copy.
          </p>
        ) : (
          <div className="mt-2 space-y-1.5">
            {value.inspirationLinks.map((l, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <Input
                  value={l}
                  onChange={(e) => setLink(i, e.target.value)}
                  placeholder="https://example.com"
                  className="h-8 flex-1 text-xs"
                  type="url"
                />
                <button
                  type="button"
                  onClick={() => removeLink(i)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500"
                  aria-label="Remove link"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Media tagging grid. Shows every client image; agency can toggle role
 * tags (hero / gallery / about / portfolio / team / product) per image.
 * Supports drag-drop upload inline so new photos can be added without
 * leaving the generation form.
 */
const MEDIA_ROLE_TAGS = ['hero', 'gallery', 'about', 'portfolio', 'team', 'product'] as const;
type MediaRoleTag = (typeof MEDIA_ROLE_TAGS)[number];

function MediaTaggingGrid({
  clientId,
  images,
  imageRows,
  tags,
  onTagsChange,
  onUploadComplete,
}: {
  clientId: string;
  images: string[];
  imageRows: Array<{
    id: string;
    fileUrl: string;
    fileName?: string | null;
    aiDescription?: string | null;
  }>;
  tags: Record<string, string[]>;
  onTagsChange: (next: Record<string, string[]>) => void;
  onUploadComplete: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [filter, setFilter] = useState<'all' | MediaRoleTag | 'untagged'>('all');

  const toggleTag = (url: string, tag: MediaRoleTag) => {
    const current = tags[url] ?? [];
    const next = current.includes(tag)
      ? current.filter((t) => t !== tag)
      : [...current, tag];
    const merged: Record<string, string[]> = { ...tags };
    if (next.length > 0) merged[url] = next;
    else delete merged[url];
    onTagsChange(merged);
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!clientId) {
      toast.error('Pick a client first');
      return;
    }
    const valid: File[] = [];
    for (const f of Array.from(files)) {
      if (!f.type.startsWith('image/')) continue;
      if (f.size > 10 * 1024 * 1024) {
        toast.error('Too large', `${f.name} is over 10MB.`);
        continue;
      }
      valid.push(f);
    }
    if (valid.length === 0) return;
    setUploading(true);
    try {
      await api.uploadImages(clientId, valid, []);
      toast.success(`Uploaded ${valid.length} ${valid.length === 1 ? 'image' : 'images'}`);
      onUploadComplete();
    } catch (e) {
      toast.error('Upload failed', (e as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const shown = images.filter((url) => {
    if (filter === 'all') return true;
    const arr = tags[url] ?? [];
    if (filter === 'untagged') return arr.length === 0;
    return arr.includes(filter);
  });

  return (
    <div className="mt-3 space-y-3">
      {/* Filter chips + upload */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => setFilter('all')}
          className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-colors ${
            filter === 'all'
              ? 'bg-slate-900 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          All ({images.length})
        </button>
        <button
          onClick={() => setFilter('untagged')}
          className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-colors ${
            filter === 'untagged'
              ? 'bg-slate-900 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Untagged ({images.filter((u) => !((tags[u]?.length ?? 0) > 0)).length})
        </button>
        {MEDIA_ROLE_TAGS.map((tag) => {
          const count = images.filter((u) => tags[u]?.includes(tag)).length;
          return (
            <button
              key={tag}
              onClick={() => setFilter(tag)}
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium capitalize transition-colors ${
                filter === tag
                  ? 'bg-[#1D9CA1] text-white'
                  : count > 0
                    ? 'bg-[#1D9CA1]/10 text-[#1D9CA1] hover:bg-[#1D9CA1]/20'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tag} {count > 0 ? `(${count})` : ''}
            </button>
          );
        })}
        <div className="ml-auto">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading || !clientId}
            className="inline-flex items-center gap-1 rounded-full bg-gradient-cta px-3 py-1 text-[11px] font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Upload className="h-3 w-3" />
            )}
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      </div>

      {/* Grid */}
      {shown.length === 0 ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
          }}
          onDrop={(e) => {
            e.preventDefault();
            handleFiles(e.dataTransfer.files);
          }}
          className="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-center text-xs text-slate-500"
        >
          <ImageIcon className="h-6 w-6 text-slate-300" />
          <p>
            {filter === 'all'
              ? 'No images yet — drop files here or click Upload.'
              : `No images tagged "${filter}" yet.`}
          </p>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
          }}
          onDrop={(e) => {
            e.preventDefault();
            handleFiles(e.dataTransfer.files);
          }}
          className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 sm:grid-cols-3 lg:grid-cols-4"
        >
          {shown.map((url) => {
            const row = imageRows.find((r) => r.fileUrl === url);
            const roleTags = (tags[url] ?? []) as MediaRoleTag[];
            return (
              <div
                key={url}
                className="overflow-hidden rounded-lg border border-slate-200 bg-white"
              >
                <div className="relative aspect-square w-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={row?.aiDescription ?? ''}
                    className="h-full w-full object-cover"
                  />
                  {roleTags.length > 0 ? (
                    <div className="absolute inset-x-1 bottom-1 flex flex-wrap gap-0.5">
                      {roleTags.map((t) => (
                        <span
                          key={t}
                          className="rounded-full bg-[#1D9CA1] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white shadow"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-0.5 p-1.5">
                  {MEDIA_ROLE_TAGS.map((t) => {
                    const active = roleTags.includes(t);
                    return (
                      <button
                        key={t}
                        onClick={() => toggleTag(url, t)}
                        className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium capitalize transition-colors ${
                          active
                            ? 'bg-[#1D9CA1] text-white'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


/**
 * Modal image picker. Lets the agency pick from the client's media
 * library OR upload a new photo on the spot. Fires `onPick` with either
 * a library index or a direct URL. Closes on backdrop click / Esc.
 *
 * Enhancements over the naïve grid:
 *   - Live search box filters the grid by filename (quick way to find
 *     "that kitchen photo" in a library of 80 images).
 *   - Keyboard shortcuts: Esc closes; Enter picks the first match when
 *     a search query is active; Cmd/Ctrl+U opens the upload dialog.
 *   - Upload from here gets auto-picked once complete so the agency
 *     doesn't have to scroll to find their upload in the library.
 *   - Image count + filter count shown in the header so the agency
 *     always knows how many matches a search returned.
 */
function ImagePickerModal({
  images,
  imageRows,
  clientId,
  onPick,
  onClose,
}: {
  images: string[];
  /** Optional DB rows with filenames / descriptions for search. */
  imageRows?: Array<{
    id: string;
    fileUrl: string;
    fileName?: string | null;
    aiDescription?: string | null;
  }>;
  clientId: string;
  onPick: (pick: { kind: 'library'; index: number } | { kind: 'url'; url: string }) => void;
  onClose: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      // Cmd/Ctrl+U → open upload dialog. Quality-of-life shortcut
      // that mirrors the keyboard convention most browsers use for
      // "Upload".
      if ((e.metaKey || e.ctrlKey) && e.key === 'u') {
        e.preventDefault();
        fileRef.current?.click();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleFile = async (file: File) => {
    if (!clientId) {
      toast.error('Pick a client first');
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Not an image');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Too large', 'Under 10MB.');
      return;
    }
    setUploading(true);
    try {
      const rows = await api.uploadImages(clientId, [file], ['website']);
      const url = rows[0]?.fileUrl;
      if (!url) throw new Error('Upload returned no URL');
      onPick({ kind: 'url', url });
    } catch (e) {
      toast.error('Upload failed', (e as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  // Build a filterable projection — preserve original index so picks
  // still write the correct array position even when filtered.
  const filtered = images
    .map((src, i) => {
      const row = imageRows?.find((r) => r.fileUrl === src);
      const searchable = [
        row?.fileName ?? '',
        row?.aiDescription ?? '',
        src.split('/').pop() ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return { src, index: i, row, searchable };
    })
    .filter((entry) => {
      if (!query.trim()) return true;
      return entry.searchable.includes(query.trim().toLowerCase());
    });

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Pick an image"
    >
      <div
        className="relative max-h-[85vh] w-[92vw] max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-900">
              Choose an image
            </h3>
            <p className="text-[11px] text-slate-500">
              {query.trim()
                ? `${filtered.length} of ${images.length} match "${query.trim()}"`
                : `${images.length} in the library · search or upload a fresh one`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading || !clientId}
              className="flex items-center gap-1.5 rounded-full bg-[#1D9CA1] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#158087] disabled:opacity-60"
              title="Upload (⌘U / Ctrl+U)"
            >
              {uploading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Upload className="h-3 w-3" />
              )}
              Upload new
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </div>
        </div>

        {/* Search bar — only shown when we have enough images that search
            actually helps. Below ~8 images a flat grid is easier to scan. */}
        {images.length >= 8 ? (
          <div className="border-b border-slate-100 bg-slate-50 px-5 py-2">
            <div className="relative">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by filename or description…"
                className="h-9 pl-8 text-xs"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && filtered.length > 0) {
                    e.preventDefault();
                    onPick({ kind: 'library', index: filtered[0]!.index });
                  }
                }}
              />
              <Edit3 className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                  aria-label="Clear search"
                >
                  <X className="h-3 w-3" />
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="max-h-[60vh] overflow-y-auto p-5">
          {images.length === 0 ? (
            <div className="py-10 text-center">
              <ImageIcon className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2 text-sm text-slate-500">
                No images in the library yet.
              </p>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#1D9CA1] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#158087]"
              >
                <Upload className="h-3 w-3" />
                Upload the first photo
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-slate-500">
                No images match &quot;{query.trim()}&quot;.
              </p>
              <button
                type="button"
                onClick={() => setQuery('')}
                className="mt-2 text-[11px] font-medium text-[#1D9CA1] hover:underline"
              >
                Clear search
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 md:grid-cols-4 lg:grid-cols-5">
              {filtered.map(({ src, index, row }) => (
                <button
                  key={`${src}-${index}`}
                  type="button"
                  onClick={() => onPick({ kind: 'library', index })}
                  className="group relative aspect-square overflow-hidden rounded-xl border-2 border-transparent bg-slate-100 transition-all hover:border-[#1D9CA1]"
                  title={row?.aiDescription ?? row?.fileName ?? undefined}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={row?.aiDescription ?? ''}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  {/* Caption overlay on hover — surfaces the AI label
                      so the agency can read "which one is the lemon
                      cake" before clicking. */}
                  {row?.aiDescription ? (
                    <span className="pointer-events-none absolute inset-x-0 bottom-0 line-clamp-2 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-2 pb-2 pt-6 text-left text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                      {row.aiDescription}
                    </span>
                  ) : null}
                  <span className="absolute inset-0 flex items-center justify-center bg-[#1D9CA1]/0 transition-colors group-hover:bg-[#1D9CA1]/30">
                    <span className="rounded-full bg-white/95 px-2.5 py-0.5 text-[10px] font-semibold text-slate-900 opacity-0 shadow transition-opacity group-hover:opacity-100">
                      Pick
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer helper — keyboard shortcuts. Tiny copy so it doesn't
            steal attention from the grid. */}
        <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50 px-5 py-2 text-[10px] text-slate-500">
          <span>
            <kbd className="rounded bg-white px-1 font-mono ring-1 ring-slate-200">
              Esc
            </kbd>{' '}
            to close
            {images.length >= 8 ? (
              <>
                {' '}
                ·{' '}
                <kbd className="rounded bg-white px-1 font-mono ring-1 ring-slate-200">
                  Enter
                </kbd>{' '}
                picks first match
              </>
            ) : null}
          </span>
          <span>
            <kbd className="rounded bg-white px-1 font-mono ring-1 ring-slate-200">
              ⌘/Ctrl+U
            </kbd>{' '}
            to upload
          </span>
        </div>
      </div>
    </div>
  );
}
