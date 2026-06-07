'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { motion } from 'framer-motion';
import { mockClients, formatCurrency, getStatusMeta } from '@boost/core';
import { Badge, Button, Input, Spinner, toast } from '@boost/ui';
import { Plus, Search, Mail, Copy, Check, Loader2, X } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { api } from '@/lib/dashboard/api';

const TIER_LABELS = {
  social_only: 'Social only',
  website_only: 'Website only',
  full_package: 'Full package',
} as const;

const TIER_TONES = {
  social_only: 'info',
  website_only: 'brand',
  full_package: 'success',
} as const;

export default function ClientsPage() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const { data = mockClients, isLoading, mutate } = useSWR('clients:list', async () => {
    try {
      return await api.listClients();
    } catch {
      return mockClients;
    }
  });

  // Search across the most useful fields. Business name is the primary
  // one but agencies often look up a client by contact name or email
  // they were just on the phone with.
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return data;
    return data.filter((c) => {
      const haystack = [
        c.businessName,
        c.contactName,
        c.email,
        c.industry ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [data, q]);

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle={`${data.length} brand${data.length === 1 ? '' : 's'} on BoostMyBranding`}
        action={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New client</span>
          </Button>
        }
      />

      <div className="px-4 py-4 md:px-10 md:py-6">
        <div className="mb-5 relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, contact, or email…"
            className="pl-10 pr-10 no-zoom"
            aria-label="Search clients"
          />
          {q ? (
            <button
              type="button"
              onClick={() => setQ('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        {isLoading && data.length === 0 ? (
          <div className="flex justify-center p-12"><Spinner size={28} /></div>
        ) : filtered.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 p-12 text-center">
            <p className="text-sm text-slate-600">
              {q ? `No clients matching "${q}"` : 'No clients yet. Add your first one to get started.'}
            </p>
            <div className="mt-3 flex justify-center gap-2">
              {q ? (
                <Button variant="ghost" size="sm" onClick={() => setQ('')}>
                  Clear search
                </Button>
              ) : (
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4" />
                  New client
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((c, i) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.3) }}
              >
                <Link
                  href={`/dashboard/clients/${c.id}`}
                  className="group block overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all hover:shadow-lg hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
                >
                  <div className="relative h-24 bg-gradient-cta md:h-28">
                    <div className="absolute left-5 -bottom-6 flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-white text-sm font-semibold text-slate-500 md:h-16 md:w-16">
                      {c.logoUrl ? (
                        <Image src={c.logoUrl} alt={`${c.businessName} logo`} fill unoptimized />
                      ) : (
                        <span aria-hidden="true">{getInitials(c.businessName)}</span>
                      )}
                    </div>
                  </div>
                  <div className="p-5 pt-8">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold text-slate-900">{c.businessName}</h3>
                        <p className="truncate text-xs text-slate-500">{c.industry || '—'}</p>
                      </div>
                      <Badge tone={TIER_TONES[c.subscriptionTier]}>
                        {TIER_LABELS[c.subscriptionTier]}
                      </Badge>
                    </div>
                    <div className="mt-2">
                      <SubscriptionBadge status={c.subscriptionStatus} />
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-4 text-center">
                      <Stat label="Posts" value={c.stats?.postsThisMonth ?? 0} />
                      <Stat label="Waiting" value={c.stats?.pendingApproval ?? 0} />
                      <Stat
                        label="MRR"
                        value={
                          c.monthlyPriceCents && c.monthlyPriceCents > 0
                            ? formatCurrency(c.monthlyPriceCents)
                            : '—'
                        }
                      />
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {createOpen ? (
        <CreateClientModal
          onClose={async () => {
            // Always refresh the list on close — the client may have
            // been created and the user clicked "Skip" instead of
            // "Open client profile".
            await mutate();
            setCreateOpen(false);
          }}
          onCreated={async (newClientId) => {
            await mutate();
            setCreateOpen(false);
            // Route straight into the client detail page so the agency
            // can upload photos / generate a site without an extra click.
            router.push(`/dashboard/clients/${newClientId}`);
          }}
        />
      ) : null}
    </>
  );
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-sm font-bold text-slate-900">{value}</div>
      <div className="text-[10px] uppercase tracking-widest text-slate-400">{label}</div>
    </div>
  );
}

function SubscriptionBadge({
  status,
}: {
  status: 'none' | 'active' | 'past_due' | 'canceled' | undefined;
}) {
  const meta = getStatusMeta(status ?? 'none');
  const tone: 'success' | 'warning' | 'danger' | 'default' =
    meta.tone === 'success'
      ? 'success'
      : meta.tone === 'warn'
        ? 'warning'
        : meta.tone === 'danger'
          ? 'danger'
          : 'default';
  return <Badge tone={tone}>{meta.label}</Badge>;
}


/**
 * Two-step "New client" modal:
 *
 *   Step 1 — fill in business details. Creates the client record.
 *   Step 2 — choose what to do next: send invite email, copy the invite
 *            link, or skip for now.
 *
 * Shipping both send + copy in the second step handles the case where
 * Resend isn't configured (common in dev) and the case where the agency
 * wants to paste the link into WhatsApp themselves.
 */
function CreateClientModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (newClientId: string) => void;
}) {
  const [step, setStep] = useState<'details' | 'invite'>('details');
  const [form, setForm] = useState({
    businessName: '',
    contactName: '',
    email: '',
    industry: '',
    websiteUrl: '',
  });
  const [createdClientId, setCreatedClientId] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string>('');
  const [creating, setCreating] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [copied, setCopied] = useState(false);

  const update = (patch: Partial<typeof form>) =>
    setForm((f) => ({ ...f, ...patch }));

  // Close on Escape — but never while a create request is in flight,
  // we don't want to orphan a half-created client.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !creating) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [creating, onClose]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    try {
      const row = await api.createClient({
        businessName: form.businessName.trim(),
        contactName: form.contactName.trim(),
        email: form.email.trim().toLowerCase(),
        industry: form.industry.trim() || undefined,
        websiteUrl: form.websiteUrl.trim() || undefined,
      });
      setCreatedClientId(row.id);
      // Grab an invite link right away so the second step loads fast.
      // `inviteClient` also sends the email unless Resend isn't configured.
      try {
        const res = await api.inviteClient(row.id);
        setInviteLink(res.link);
      } catch {
        // Non-fatal; the second step has a manual "generate link" fallback.
      }
      setStep('invite');
    } catch (e) {
      toast.error('Create failed', (e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const resendInvite = async () => {
    if (!createdClientId || sendingInvite) return;
    setSendingInvite(true);
    try {
      const res = await api.inviteClient(createdClientId);
      setInviteLink(res.link);
      if (res.sent) {
        toast.success('Invite sent', `Emailed to ${res.email}.`);
      } else {
        toast.info('Email service offline', 'Copy the link below and send it manually.');
      }
    } catch (e) {
      toast.error('Send failed', (e as Error).message);
    } finally {
      setSendingInvite(false);
    }
  };

  // Manual "generate the link" for the rare case where the initial
  // createClient → inviteClient call failed but the client itself was
  // created. Without this the user gets stuck with an empty, disabled
  // copy field.
  const generateLink = async () => {
    if (!createdClientId || generatingLink) return;
    setGeneratingLink(true);
    try {
      const res = await api.inviteClient(createdClientId);
      setInviteLink(res.link);
    } catch (e) {
      toast.error("Couldn't generate link", (e as Error).message);
    } finally {
      setGeneratingLink(false);
    }
  };

  const copyLink = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy", 'Select the link and copy manually.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Create new client"
      onClick={() => {
        // Don't allow backdrop-close while creating — the request is
        // still in flight and we need to surface the result.
        if (!creating) onClose();
      }}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          disabled={creating}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {step === 'details' ? (
          <>
            <h2 className="text-xl font-bold text-slate-900">New client</h2>
            <p className="mt-1 text-sm text-slate-500">
              Just the basics — you can fill in brand colors, social accounts, and everything
              else once the client is created.
            </p>

            <form onSubmit={create} className="mt-6 space-y-3">
              <div>
                <label htmlFor="new-client-business" className="text-xs font-semibold text-slate-700">
                  Business name
                </label>
                <Input
                  id="new-client-business"
                  required
                  className="mt-1"
                  value={form.businessName}
                  onChange={(e) => update({ businessName: e.target.value })}
                  placeholder="Murphy's Plumbing"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label htmlFor="new-client-contact" className="text-xs font-semibold text-slate-700">
                    Contact name
                  </label>
                  <Input
                    id="new-client-contact"
                    required
                    className="mt-1"
                    value={form.contactName}
                    onChange={(e) => update({ contactName: e.target.value })}
                    placeholder="Liam Murphy"
                  />
                </div>
                <div>
                  <label htmlFor="new-client-email" className="text-xs font-semibold text-slate-700">
                    Email
                  </label>
                  <Input
                    id="new-client-email"
                    required
                    type="email"
                    className="mt-1"
                    value={form.email}
                    onChange={(e) => update({ email: e.target.value })}
                    placeholder="liam@murphysplumbing.ie"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="new-client-industry" className="text-xs font-semibold text-slate-700">
                  Industry <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <Input
                  id="new-client-industry"
                  className="mt-1"
                  value={form.industry}
                  onChange={(e) => update({ industry: e.target.value })}
                  placeholder="Home Services, Food & Beverage, etc."
                />
              </div>

              <div>
                <label htmlFor="new-client-website" className="text-xs font-semibold text-slate-700">
                  Existing website <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <Input
                  id="new-client-website"
                  type="url"
                  className="mt-1"
                  value={form.websiteUrl}
                  onChange={(e) => update({ websiteUrl: e.target.value })}
                  placeholder="https://murphysplumbing.ie"
                />
                <p className="mt-1 text-[10px] text-slate-500">
                  If they have one, our AI reads it to match their voice.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                <Button type="button" variant="ghost" onClick={onClose} disabled={creating}>
                  Cancel
                </Button>
                <Button type="submit" disabled={creating}>
                  {creating ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Creating…
                    </>
                  ) : (
                    <>
                      <Plus className="h-3.5 w-3.5" />
                      Create client
                    </>
                  )}
                </Button>
              </div>
            </form>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                <Check className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Client created</h2>
                <p className="text-xs text-slate-500">
                  {form.businessName} is ready. Invite them to finish setting up.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {/* Email send */}
              <button
                type="button"
                onClick={resendInvite}
                disabled={sendingInvite}
                className="flex w-full items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-[#1D9CA1] hover:bg-slate-50 disabled:opacity-60"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1D9CA1]/10 text-[#1D9CA1]">
                  {sendingInvite ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">
                    Email the invite to {form.email}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    They'll get a friendly email with a one-click setup link.
                  </p>
                </div>
              </button>

              {/* Copy link */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                    <Copy className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900">
                      Or copy the invite link
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      Send it via WhatsApp, text, or wherever they'll see it.
                    </p>
                  </div>
                </div>
                {inviteLink ? (
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      readOnly
                      value={inviteLink}
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      className="flex-1 truncate rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 font-mono text-[10px] text-slate-700"
                      aria-label="Invite link"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={copyLink}
                    >
                      {copied ? (
                        <>
                          <Check className="h-3 w-3" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="mt-3 flex items-center gap-2">
                    <p className="flex-1 text-[11px] text-slate-500">
                      Link couldn't be generated automatically.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={generateLink}
                      disabled={generatingLink}
                    >
                      {generatingLink ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Generating…
                        </>
                      ) : (
                        'Generate link'
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="text-xs text-slate-500 hover:text-slate-700"
              >
                Skip — I'll invite them later
              </button>
              <Button
                onClick={() => createdClientId && onCreated(createdClientId)}
                disabled={!createdClientId}
              >
                Open client profile
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
