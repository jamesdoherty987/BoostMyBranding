'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { Button, Input, toast, Spinner, Badge, Dialog } from '@boost/ui';
import { Check, Instagram, Facebook, Linkedin, Music2, Twitter, LogOut, Download, CreditCard, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Shell } from '@/components/portal/Shell';
import { api } from '@/lib/portal/api';
import { handlePortalAuthError, ALLOW_MOCK_FALLBACK } from '@/lib/portal/auth';
import { mockClients, formatCurrency } from '@boost/core';
import { useSubscription } from '@/lib/portal/subscription';

const SOCIAL_FIELDS = [
  { key: 'instagram', label: 'Instagram', icon: Instagram, placeholder: '@yourbusiness' },
  { key: 'facebook', label: 'Facebook', icon: Facebook, placeholder: 'facebook.com/yourbusiness' },
  { key: 'linkedin', label: 'LinkedIn', icon: Linkedin, placeholder: 'linkedin.com/company/…' },
  { key: 'tiktok', label: 'TikTok', icon: Music2, placeholder: '@yourbusiness' },
  { key: 'x', label: 'X (Twitter)', icon: Twitter, placeholder: '@yourbusiness' },
] as const;

export default function SettingsPage() {
  const { subscription } = useSubscription();
  const { data, isLoading } = useSWR('portal:settings', async () => {
    try {
      return await api.getMyClient();
    } catch (err) {
      handlePortalAuthError(err);
      if (!ALLOW_MOCK_FALLBACK) throw err;
      return mockClients[0];
    }
  });

  const [websiteUrl, setWebsiteUrl] = useState('');
  const [industry, setIndustry] = useState('');
  const [socials, setSocials] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [dirty, setDirty] = useState(false);

  /**
   * Reset the form back to whatever the server last handed us. Shared
   * between the initial sync effect and the "Discard" button on the
   * sticky save bar, so "discard" always puts the form in a clean state.
   */
  const setAllFromData = (row: NonNullable<typeof data>) => {
    setWebsiteUrl(row.websiteUrl ?? '');
    setIndustry(row.industry ?? '');
    setSocials(row.socialAccounts ?? {});
    setDirty(false);
  };

  useEffect(() => {
    if (data) setAllFromData(data);
  }, [data]);

  const markDirty = () => setDirty(true);

  if (isLoading || !data) {
    return (
      <Shell title="Settings">
        <div className="flex justify-center p-12">
          <Spinner size={28} />
        </div>
      </Shell>
    );
  }

  const save = async () => {
    setSaving(true);
    try {
      await api.updateMyClient({
        industry: industry || undefined,
        websiteUrl: websiteUrl || undefined,
        socialAccounts: socials,
      });
      toast.success('Saved', 'Your preferences are updated');
      setDirty(false);
    } catch (e) {
      toast.error('Could not save', (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch {}
    window.location.href = '/';
  };

  return (
    <Shell title="Settings" subtitle={data.businessName}>
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Business</h2>
        <p className="text-xs text-slate-500">Helps your team tune the monthly content plan.</p>
        <div className="mt-4 space-y-3">
          <Field label="Industry">
            <Input
              value={industry}
              onChange={(e) => {
                setIndustry(e.target.value);
                markDirty();
              }}
              placeholder="Food & Beverage"
              className="no-zoom"
            />
          </Field>
          <Field label="Website">
            <Input
              value={websiteUrl}
              onChange={(e) => {
                setWebsiteUrl(e.target.value);
                markDirty();
              }}
              placeholder="https://"
              type="url"
              className="no-zoom"
            />
          </Field>
        </div>
      </section>

      <Link
        href="/portal/subscription"
        className="mt-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:bg-slate-50"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1D9CA1]/10 text-[#1D9CA1]">
          <CreditCard className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-900">Subscription</span>
            {subscription ? (
              <Badge
                tone={
                  subscription.statusMeta.tone === 'success'
                    ? 'success'
                    : subscription.statusMeta.tone === 'warn'
                      ? 'warning'
                      : subscription.statusMeta.tone === 'danger'
                        ? 'danger'
                        : 'default'
                }
              >
                {subscription.statusMeta.label}
              </Badge>
            ) : null}
          </div>
          <div className="truncate text-xs text-slate-500">
            {subscription
              ? `${subscription.tierName} · ${formatCurrency(subscription.priceCents)}/mo`
              : 'Manage your plan'}
          </div>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
      </Link>

      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Brand colors</h2>
        <div className="mt-3 flex gap-3">
          {(['primary', 'secondary', 'accent'] as const).map((key) => {
            const hex = data.brandColors?.[key] ?? '#48D886';
            return (
              <div key={key} className="flex-1 text-center">
                <div
                  className="h-12 rounded-xl border border-slate-200"
                  style={{ backgroundColor: hex }}
                />
                <div className="mt-1 text-[10px] uppercase tracking-widest text-slate-500">
                  {key}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Want to change these? Drop us a message in chat.
        </p>
      </section>

      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Social accounts</h2>
        <p className="text-xs text-slate-500">We use these to schedule and track posts.</p>
        <div className="mt-3 space-y-3">
          {SOCIAL_FIELDS.map((f) => (
            <div key={f.key} className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                <f.icon className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <div className="text-xs font-medium text-slate-500">{f.label}</div>
                <Input
                  value={socials[f.key] ?? ''}
                  onChange={(e) => {
                    setSocials((s) => ({ ...s, [f.key]: e.target.value }));
                    markDirty();
                  }}
                  placeholder={f.placeholder}
                  className="h-9 no-zoom"
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Inline save button — stays here so users still see a confirmation
          after saving. The sticky bar below handles the "unsaved changes"
          nudge when they scroll. */}
      <div className="mt-5 flex flex-col gap-2">
        <Button onClick={save} size="lg" disabled={!dirty || saving} loading={saving}>
          {!saving ? <Check className="h-4 w-4" /> : null}
          {saving ? 'Saving…' : dirty ? 'Save changes' : 'All saved'}
        </Button>
        <Button variant="outline" size="lg" onClick={() => setConfirmLogout(true)}>
          <LogOut className="h-4 w-4" />
          Log out
        </Button>
      </div>

      <Link
        href="/portal/install"
        className="mt-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:bg-slate-50"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1D9CA1]/10 text-[#1D9CA1]">
          <Download className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-slate-900">Install the app</div>
          <div className="text-xs text-slate-500">Add to your home screen for quick access</div>
        </div>
      </Link>

      <div className="mt-4 flex items-center gap-2 rounded-2xl bg-slate-100 p-3">
        <Badge tone="brand">Pro tip</Badge>
        <p className="text-xs text-slate-600">
          Upload photos weekly for the freshest content. Quality &gt; quantity.
        </p>
      </div>

      <Dialog
        open={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        title="Log out of the portal?"
        description="You'll need your password to sign back in."
      >
        <div className="flex flex-col gap-2">
          <Button variant="outline" onClick={logout}>
            <LogOut className="h-4 w-4" />
            Yes, log me out
          </Button>
          <Button variant="ghost" onClick={() => setConfirmLogout(false)}>
            Cancel
          </Button>
        </div>
      </Dialog>

      {/* Sticky "unsaved changes" reminder — appears when the user has edits
          that haven't been saved yet, sits above the bottom nav so it's
          always reachable without scrolling. */}
      {dirty ? (
        <div className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] left-1/2 z-30 w-[min(100%-1rem,28rem)] -translate-x-1/2 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
          <div className="flex items-center gap-2">
            <span className="flex-1 px-2 text-xs font-medium text-slate-700">
              Unsaved changes
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => data && setAllFromData(data)}
              disabled={saving}
            >
              Discard
            </Button>
            <Button size="sm" onClick={save} disabled={saving} loading={saving}>
              {!saving ? <Check className="h-4 w-4" /> : null}
              Save
            </Button>
          </div>
        </div>
      ) : null}
    </Shell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-600">{label}</span>
      <span className="mt-1 block">{children}</span>
    </label>
  );
}
