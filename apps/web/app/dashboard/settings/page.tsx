'use client';

import useSWR from 'swr';
import { Button, Card, CardContent, Input } from '@boost/ui';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { api } from '@/lib/dashboard/api';

type ServerStatus = {
  database: boolean;
  claude: boolean;
  fal: boolean;
  r2: boolean;
  stripe: boolean;
  resend: boolean;
  contentStudio: boolean;
  contentStudioDefaultWorkspace?: boolean;
};

const INTEGRATIONS: {
  name: string;
  envKey: string;
  statusKey: keyof ServerStatus;
  /** Extra hint when this key is true (e.g. default workspace set). */
  extraHint?: (s: ServerStatus) => string | null;
}[] = [
  { name: 'Anthropic Claude', envKey: 'ANTHROPIC_API_KEY', statusKey: 'claude' },
  { name: 'fal.ai (Flux)', envKey: 'FAL_KEY', statusKey: 'fal' },
  {
    name: 'ContentStudio',
    envKey: 'CONTENTSTUDIO_API_KEY',
    statusKey: 'contentStudio',
    extraHint: (s) =>
      s.contentStudio && s.contentStudioDefaultWorkspace
        ? 'Default workspace id is set on the API server (CONTENTSTUDIO_WORKSPACE_ID).'
        : s.contentStudio
          ? 'Add CONTENTSTUDIO_WORKSPACE_ID to the API .env (or set a workspace on each Personal channel) before scheduling posts.'
          : null,
  },
  { name: 'Cloudflare R2', envKey: 'R2_ACCESS_KEY_ID', statusKey: 'r2' },
  { name: 'Stripe', envKey: 'STRIPE_SECRET_KEY', statusKey: 'stripe' },
  { name: 'Resend (email)', envKey: 'RESEND_API_KEY', statusKey: 'resend' },
];

export default function SettingsPage() {
  const { data, isLoading } = useSWR<ServerStatus>('settings:system-status', () => api.systemStatus(), {
    refreshInterval: 60_000,
  });

  return (
    <>
      <PageHeader title="Settings" subtitle="Agency profile and integrations" />
      <div className="space-y-6 px-4 py-4 md:px-10 md:py-6">
        <Card>
          <CardContent className="p-6">
            <h2 className="text-sm font-semibold text-slate-900">Agency profile</h2>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <Input defaultValue="BoostMyBranding" />
              <Input defaultValue="contact@boostmybranding.com" type="email" />
            </div>
            <Button className="mt-4" size="sm">
              Save
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h2 className="text-sm font-semibold text-slate-900">Integrations</h2>
            <p className="mt-1 text-xs text-slate-500">
              This is not an OAuth "Connect" flow — restart the API after changing env vars. For ContentStudio posting, social accounts
              must still be linked inside the ContentStudio product; the API key only lets this app create schedules there.
            </p>
            <ul className="mt-4 space-y-3">
              {INTEGRATIONS.map((i) => {
                const live = Boolean(data?.[i.statusKey]);
                const hint = data && i.extraHint ? i.extraHint(data) : null;
                return (
                  <li
                    key={i.name}
                    className="rounded-xl border border-slate-200 bg-white p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-900">{i.name}</div>
                        <div className="text-xs text-slate-500">{i.envKey}</div>
                        {hint ? <p className="mt-1 text-[11px] leading-snug text-slate-600">{hint}</p> : null}
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          isLoading
                            ? 'bg-slate-100 text-slate-500'
                            : live
                              ? 'bg-emerald-50 text-emerald-800'
                              : 'bg-amber-50 text-amber-900'
                        }`}
                      >
                        {isLoading ? 'Checking…' : live ? 'Live on server' : 'Not in API env'}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
