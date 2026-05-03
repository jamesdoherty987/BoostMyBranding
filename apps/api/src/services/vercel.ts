/**
 * Thin Vercel REST API wrapper scoped to the operations our custom-domain
 * flow needs: add a domain to the web project, remove it, and check
 * verification status.
 *
 * Docs: https://vercel.com/docs/rest-api/endpoints/projects
 *
 * When VERCEL_API_TOKEN or VERCEL_PROJECT_ID isn't set, all functions
 * return dev-mode mock data so the rest of the app works offline. This
 * matches how claude.ts / fal.ts behave.
 */

import { env, features } from '../env.js';

const VERCEL_API = 'https://api.vercel.com';

/** Build a query string with the optional team id so team-owned projects work. */
function teamQuery(extra?: Record<string, string>): string {
  const params = new URLSearchParams();
  if (env.VERCEL_TEAM_ID) params.set('teamId', env.VERCEL_TEAM_ID);
  if (extra) for (const [k, v] of Object.entries(extra)) params.set(k, v);
  const s = params.toString();
  return s ? `?${s}` : '';
}

async function vercelFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  if (!features.vercel) {
    throw new Error(
      'Vercel integration not configured — set VERCEL_API_TOKEN and VERCEL_PROJECT_ID',
    );
  }
  const res = await fetch(`${VERCEL_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.VERCEL_API_TOKEN}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const body = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) {
    const message =
      body?.error?.message ??
      body?.error?.code ??
      `Vercel API error (${res.status})`;
    throw new Error(message);
  }
  return body as T;
}

export interface VercelDomainStatus {
  /** Raw domain string, lowercased. */
  name: string;
  /** Whether the domain resolves to Vercel and can serve traffic. */
  verified: boolean;
  /**
   * DNS records the customer needs to set. Present when !verified and the
   * domain is a root apex; Vercel returns the A + AAAA records the customer
   * must create. For subdomains we always recommend a CNAME.
   */
  requiredRecords: Array<{ type: string; name: string; value: string }>;
  /** Human-readable reason for verification failure, if any. */
  error?: string;
}

/**
 * Add a domain to the web project. Returns the domain status — the domain
 * may be `verified: false` immediately if DNS hasn't propagated yet.
 *
 * Safe to call repeatedly; Vercel returns a success response if the domain
 * is already attached to the project.
 */
export async function addDomain(domain: string): Promise<VercelDomainStatus> {
  if (!features.vercel) return mockStatus(domain);
  const project = env.VERCEL_PROJECT_ID!;

  try {
    await vercelFetch(`/v10/projects/${project}/domains${teamQuery()}`, {
      method: 'POST',
      body: JSON.stringify({ name: domain }),
    });
  } catch (e) {
    // "domain already added to project" is fine — continue to status check.
    if (!/already (exists|added|in use)/i.test((e as Error).message)) {
      throw e;
    }
  }

  return await checkDomain(domain);
}

/** Remove a domain from the project. Idempotent — missing domains don't error. */
export async function removeDomain(domain: string): Promise<void> {
  if (!features.vercel) return;
  const project = env.VERCEL_PROJECT_ID!;
  try {
    await vercelFetch(
      `/v9/projects/${project}/domains/${encodeURIComponent(domain)}${teamQuery()}`,
      { method: 'DELETE' },
    );
  } catch (e) {
    if (!/not found/i.test((e as Error).message)) throw e;
  }
}

/**
 * Fetch the current verification state of a domain. Pairs with `addDomain`
 * for the typical "add then poll" lifecycle — the dashboard calls this on
 * demand when the agency clicks "Check status".
 */
export async function checkDomain(domain: string): Promise<VercelDomainStatus> {
  if (!features.vercel) return mockStatus(domain);
  const project = env.VERCEL_PROJECT_ID!;

  const detail = await vercelFetch<{
    name: string;
    verified?: boolean;
    verification?: Array<{ type: string; domain: string; value: string; reason: string }>;
    error?: { code: string; message: string };
  }>(
    `/v9/projects/${project}/domains/${encodeURIComponent(domain)}${teamQuery()}`,
  );

  const verified = Boolean(detail.verified);
  const requiredRecords = isApex(domain)
    ? [{ type: 'A', name: '@', value: '76.76.21.21' }]
    : [
        {
          type: 'CNAME',
          name: subdomainLabel(domain),
          value: 'cname.vercel-dns.com',
        },
      ];

  return {
    name: detail.name.toLowerCase(),
    verified,
    requiredRecords,
    error: detail.error?.message,
  };
}

/** Rough apex check — no dots before the TLD. Good enough for our purposes. */
function isApex(domain: string): boolean {
  const parts = domain.split('.');
  return parts.length <= 2;
}

function subdomainLabel(domain: string): string {
  const parts = domain.split('.');
  return parts.slice(0, -2).join('.') || 'www';
}

/** Dev-mode mock: claims the domain is unverified + returns realistic records. */
function mockStatus(domain: string): VercelDomainStatus {
  const records = isApex(domain)
    ? [{ type: 'A', name: '@', value: '76.76.21.21' }]
    : [
        {
          type: 'CNAME',
          name: subdomainLabel(domain),
          value: 'cname.vercel-dns.com',
        },
      ];
  return {
    name: domain.toLowerCase(),
    verified: false,
    requiredRecords: records,
    error: 'Vercel integration not configured — this is a mock response.',
  };
}

/** Validate a hostname. Strict enough to reject obvious garbage. */
export function isValidDomain(domain: string): boolean {
  if (!domain || domain.length > 253) return false;
  // no protocol, no path, no spaces, must contain a dot
  if (/[^a-z0-9.-]/i.test(domain)) return false;
  if (!domain.includes('.')) return false;
  if (domain.startsWith('-') || domain.endsWith('-')) return false;
  if (domain.startsWith('.') || domain.endsWith('.')) return false;
  return true;
}

/** Normalize user input to a canonical domain form. */
export function normalizeDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '')
    .replace(/^www\./, ''); // always attach apex; the www CNAME is a separate step
}
