'use client';

import { Button, Card, CardContent, Input } from '@boost/ui';
import { PageHeader } from '@/components/PageHeader';

export default function SettingsPage() {
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
            <ul className="mt-4 space-y-3">
              {[
                { name: 'Anthropic Claude', key: 'ANTHROPIC_API_KEY', connected: true },
                { name: 'fal.ai (Flux)', key: 'FAL_KEY', connected: true },
                { name: 'ContentStudio', key: 'CONTENTSTUDIO_API_KEY', connected: false },
                { name: 'Cloudflare R2', key: 'R2_ACCESS_KEY_ID', connected: true },
                { name: 'Stripe', key: 'STRIPE_SECRET_KEY', connected: false },
                { name: 'Resend (email)', key: 'RESEND_API_KEY', connected: true },
              ].map((i) => (
                <li
                  key={i.name}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4"
                >
                  <div>
                    <div className="text-sm font-medium text-slate-900">{i.name}</div>
                    <div className="text-xs text-slate-500">{i.key}</div>
                  </div>
                  <Button size="sm" variant={i.connected ? 'outline' : 'primary'}>
                    {i.connected ? 'Connected' : 'Connect'}
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
