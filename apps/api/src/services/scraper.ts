/**
 * Fetches a website and returns its content as markdown for brand-voice
 * generation. Uses Jina Reader's free text endpoint. Falls back to raw HTML
 * if Jina is unreachable.
 *
 * SSRF defense (OWASP A10): we only allow http/https URLs and reject any
 * host that resolves to private IP space, loopback, or link-local addresses.
 * This prevents attackers from using onboarding to probe internal networks.
 */

import dns from 'node:dns/promises';
import net from 'node:net';

const MAX_CONTENT_LENGTH = 16_000;
const FETCH_TIMEOUT_MS = 8_000;

export async function scrapeWebsite(url: string): Promise<string> {
  if (!url) return '';
  const safe = await sanitizeUrl(url);
  if (!safe) return '';

  try {
    const res = await fetchWithTimeout(`https://r.jina.ai/${safe}`, {
      headers: { Accept: 'text/plain, text/markdown' },
    });
    if (res.ok) return (await res.text()).slice(0, MAX_CONTENT_LENGTH);
  } catch {}

  try {
    const res = await fetchWithTimeout(safe, {
      headers: { 'User-Agent': 'BoostMyBranding/1.0' },
    });
    if (res.ok) {
      const html = await res.text();
      return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, MAX_CONTENT_LENGTH);
    }
  } catch {}
  return '';
}

async function fetchWithTimeout(url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

/**
 * Return a normalized http(s) URL only if it's safe to fetch — no file://,
 * no internal/loopback IPs, etc.
 */
async function sanitizeUrl(raw: string): Promise<string | null> {
  let parsed: URL;
  try {
    parsed = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) return null;
  const host = parsed.hostname;
  if (!host) return null;
  if (isBlockedHost(host)) return null;

  // Resolve DNS and block private / loopback / link-local ranges.
  try {
    const records = await dns.lookup(host, { all: true, verbatim: false });
    for (const r of records) {
      if (isPrivateIp(r.address)) return null;
    }
  } catch {
    // If DNS fails, refuse to fetch rather than take the risk.
    return null;
  }

  return parsed.toString();
}

const BLOCKED_HOSTS = new Set(['localhost', '0.0.0.0', 'broadcasthost', 'metadata.google.internal']);

function isBlockedHost(host: string) {
  const lower = host.toLowerCase();
  if (BLOCKED_HOSTS.has(lower)) return true;
  if (lower.endsWith('.local')) return true;
  if (lower.endsWith('.internal')) return true;
  return false;
}

function isPrivateIp(ip: string) {
  const family = net.isIP(ip);
  if (family === 4) {
    const [a, b] = ip.split('.').map(Number) as [number, number];
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true; // link-local
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 0) return true;
  }
  if (family === 6) {
    const lower = ip.toLowerCase();
    if (lower === '::1') return true;
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique-local
    if (lower.startsWith('fe80:')) return true; // link-local
    if (lower.startsWith('::ffff:')) {
      // IPv4-mapped: re-check the v4 address
      const v4 = lower.replace('::ffff:', '');
      return isPrivateIp(v4);
    }
  }
  return false;
}
