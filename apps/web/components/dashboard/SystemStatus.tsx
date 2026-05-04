'use client';

/**
 * Small pill that reports which upstream integrations are wired. Click to
 * expand a per-integration breakdown. Helps operators see at a glance when
 * automation is degraded because e.g. CONTENTSTUDIO_API_KEY was rotated out.
 */

import { useState } from 'react';
import useSWR from 'swr';
import { AnimatePresence, motion } from 'framer-motion';
import { Activity, Check, X } from 'lucide-react';
import { api } from '@/lib/dashboard/api';

const INTEGRATIONS: { key: keyof Status; label: string; optional?: boolean }[] = [
  { key: 'database', label: 'Database' },
  { key: 'claude', label: 'Claude' },
  { key: 'fal', label: 'fal.ai' },
  { key: 'stripe', label: 'Stripe' },
  { key: 'r2', label: 'R2 storage' },
  { key: 'resend', label: 'Email' },
  { key: 'contentStudio', label: 'ContentStudio' },
];

type Status = {
  database: boolean;
  claude: boolean;
  fal: boolean;
  r2: boolean;
  stripe: boolean;
  resend: boolean;
  contentStudio: boolean;
};

export function SystemStatus() {
  const { data } = useSWR<Status>('system:status', () => api.systemStatus() as Promise<Status>, {
    refreshInterval: 30_000,
  });
  const [open, setOpen] = useState(false);

  if (!data) return null;

  const connected = INTEGRATIONS.filter((i) => data[i.key]).length;
  const total = INTEGRATIONS.length;
  const allOk = connected === total;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
          allOk
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : 'border-amber-200 bg-amber-50 text-amber-800'
        }`}
        aria-label="System status"
      >
        <Activity className="h-3 w-3" />
        <span>{connected}/{total} systems live</span>
      </button>

      <AnimatePresence>
        {open ? (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="absolute right-0 top-full z-50 mt-2 w-60 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl"
            >
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                Integrations
              </div>
              <ul className="space-y-1.5">
                {INTEGRATIONS.map((i) => {
                  const ok = data[i.key];
                  return (
                    <li key={i.key} className="flex items-center justify-between text-xs">
                      <span className="text-slate-700">{i.label}</span>
                      {ok ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600">
                          <Check className="h-3 w-3" />
                          live
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-slate-400">
                          <X className="h-3 w-3" />
                          mock
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 text-[10px] text-slate-500">
                Missing integrations run in mock mode. Add the env var to enable.
              </p>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
