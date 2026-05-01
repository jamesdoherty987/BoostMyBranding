'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { Button, Input, toast, Spinner, Badge, Dialog, EmptyState } from '@boost/ui';
import { Check, Instagram, Facebook, Linkedin, Music2, Twitter, LogOut } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { api } from '@/lib/api';
import { mockClients } from '@boost/core';

const SOCIAL_FIELDS = [
  { key: 'instagram', label: 'Instagram', icon: Instagram, placeholder: '@yourbusiness' },
  { key: 'facebook', label: 'Facebook', icon: Facebook, placeholder: 'facebook.com/yourbusiness' },
  { key: 'linkedin', label: 'LinkedIn', icon: Linkedin, placeholder: 'linkedin.com/company/…' },
  { key: 'tiktok', label: 'TikTok', icon: Music2, placeholder: '@yourbusiness' },
  { key: 'x', label: 'X (Twitter)', icon: Twitter, placeholder: '@yourbusiness' },
] as const;

export default function SettingsPage() {
  const { data, isLoading } = useSWR('portal:settings', async () => {
    try {
      return await api.getMyClient();
    } catch {
      return mockClients[0];
    }
  });

  const [websiteUrl, setWebsiteUrl] = useState('');
  const [industry, setIndustry] = useState('');
  const [socials, setSocials] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (data) {
      setWebsiteUrl((data as any).websiteUrl ?? '');
      setIndustry((data as any).industry ?? '');
      setSocials(((data as any).socialAccounts as Record<string, string>) ?? {});
      setDirty(false);
    }
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
        <p className="text-xs text-slate-500">Used by AI to tune your content.</p>
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

      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Brand colors</h2>
        <div className="mt-3 flex gap-3">
          {(['primary', 'secondary', 'accent'] as const).map((key) => {
            const hex = (data as any).brandColors?.[key] ?? '#48D886';
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

      <div className="mt-5 flex flex-col gap-2">
        <Button onClick={save} size="lg" disabled={!dirty || saving}>
          {saving ? <Spinner /> : <Check className="h-4 w-4" />}
          {saving ? 'Saving…' : dirty ? 'Save changes' : 'All saved'}
        </Button>
        <Button variant="outline" size="lg" onClick={() => setConfirmLogout(true)}>
          <LogOut className="h-4 w-4" />
          Log out
        </Button>
      </div>

      <div className="mt-6 flex items-center gap-2 rounded-2xl bg-slate-100 p-3">
        <Badge tone="brand">Pro tip</Badge>
        <p className="text-xs text-slate-600">
          Upload photos weekly for the freshest content. Quality &gt; quantity.
        </p>
      </div>

      <Dialog
        open={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        title="Log out of the portal?"
        description="You'll need the magic link email to sign back in."
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
