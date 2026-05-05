/**
 * Brand context builder.
 *
 * Produces a single typed view of everything we reliably know about a
 * client — pulled verbatim from their row + website config + recent
 * media + past posts. Every downstream generator (captions, AI video,
 * AI image, hero image) reads from this so:
 *
 *   1. Claude never sees inconsistent facts across prompts.
 *   2. Image prompts auto-include the brand palette.
 *   3. Hashtag hygiene uses what the brand has ACTUALLY posted before,
 *      not a random AI guess.
 *   4. Hallucination guards can cite which fields count as "known".
 *
 * The shape of this object is also what's surfaced in the "Brand
 * context" side panel on the dashboard, so the agency can see exactly
 * what Claude will see and fix gaps before generating anything.
 */

import { eq, desc, and, ne } from 'drizzle-orm';
import { getDb, isDbConfigured, clients, clientImages, posts } from '@boost/database';

export interface BrandContext {
  /** Always present — the client row itself. */
  businessName: string;
  industry?: string;
  brandVoiceGuide?: string; // free-text guide we cached earlier
  websiteUrl?: string;

  /** Palette — pulled from clients.brandColors OR websiteConfig.brand. */
  palette: {
    primary?: string;
    secondary?: string;
    accent?: string;
    pop?: string;
    dark?: string;
    paper?: string;
  };

  /** Logo URL — clients.logoUrl OR websiteConfig.brand.logoUrl. */
  logoUrl?: string;

  /** Contact facts — address, phone, email, WhatsApp, hours. */
  contact: {
    address?: string;
    phone?: string;
    email?: string;
    whatsapp?: string;
    hours?: string;
  };

  /** Social handles. */
  socials: Record<string, string>;

  /** Named services with descriptions. */
  services: Array<{ title: string; description?: string }>;

  /** Named team members + roles. */
  team: Array<{ name: string; role: string; bio?: string }>;

  /** Service areas / cities they cover. */
  serviceAreas: string[];

  /** Trust badges, certifications, awards. */
  credentials: Array<{ label: string; detail?: string }>;

  /**
   * Recent posts — hashtags the brand has used before. Lets the
   * generator prefer tags the brand already owns vs. inventing new ones.
   */
  pastHashtags: string[];

  /**
   * Top-scoring media items, scored by the image analyzer. Given to
   * every caption/video prompt so the model can weave real visual
   * references into copy.
   */
  topMedia: Array<{
    id: string;
    fileUrl: string;
    mimeType?: string | null;
    aiDescription?: string | null;
    qualityScore?: number | null;
  }>;

  /** Tally of what we have vs. what's missing — drives the UI. */
  completeness: {
    hasVoice: boolean;
    hasPalette: boolean;
    hasLogo: boolean;
    hasContact: boolean;
    hasServices: boolean;
    hasTeam: boolean;
    hasMedia: boolean;
    score: number; // 0-100, how ready they are for good generation
  };
}

/**
 * Build the brand context for a given client. Safe to call with the
 * DB unconfigured — returns a minimal stub in that case so mock-mode
 * UI still renders something meaningful.
 */
export async function buildBrandContext(clientId: string): Promise<BrandContext | null> {
  if (!isDbConfigured()) {
    return {
      businessName: 'Demo Client',
      palette: {},
      contact: {},
      socials: {},
      services: [],
      team: [],
      serviceAreas: [],
      credentials: [],
      pastHashtags: [],
      topMedia: [],
      completeness: {
        hasVoice: false,
        hasPalette: false,
        hasLogo: false,
        hasContact: false,
        hasServices: false,
        hasTeam: false,
        hasMedia: false,
        score: 0,
      },
    };
  }

  const db = getDb();
  const [client] = await db.select().from(clients).where(eq(clients.id, clientId));
  if (!client) return null;

  const config = (client.websiteConfig ?? {}) as Record<string, any>;
  const cfgBrand = (config.brand ?? {}) as Record<string, any>;
  const cfgContact = (config.contact ?? {}) as Record<string, any>;

  const palette = {
    primary: client.brandColors?.primary ?? cfgBrand.primaryColor,
    secondary: client.brandColors?.secondary ?? cfgBrand.secondaryColor,
    accent: client.brandColors?.accent ?? cfgBrand.accentColor,
    pop: cfgBrand.popColor,
    dark: cfgBrand.darkColor,
    paper: cfgBrand.paperColor,
  };

  const logoUrl = client.logoUrl ?? cfgBrand.logoUrl ?? undefined;

  const contact = {
    address: cfgContact.address,
    phone: cfgContact.phone,
    email: cfgContact.email,
    whatsapp: cfgContact.whatsapp,
    hours: cfgContact.hours,
  };

  const socialsFromRow = (client.socialAccounts ?? {}) as Record<string, string>;
  const socialsFromCfg = (config.socials ?? {}) as Record<string, string>;
  const socials: Record<string, string> = { ...socialsFromCfg, ...socialsFromRow };

  const services: Array<{ title: string; description?: string }> = [];
  if (Array.isArray(config.services)) {
    for (const s of config.services as any[]) {
      if (s && typeof s.title === 'string' && s.title.length > 0) {
        services.push({
          title: s.title,
          description: typeof s.description === 'string' ? s.description : undefined,
        });
      }
    }
  }

  const teamMembers: Array<{ name: string; role: string; bio?: string }> = [];
  if (Array.isArray(config.team?.members)) {
    for (const m of config.team.members as any[]) {
      if (
        m &&
        typeof m.name === 'string' &&
        m.name.length > 0 &&
        typeof m.role === 'string' &&
        m.role.length > 0
      ) {
        teamMembers.push({
          name: m.name,
          role: m.role,
          bio: typeof m.bio === 'string' ? m.bio : undefined,
        });
      }
    }
  }

  const serviceAreas: string[] = [];
  if (Array.isArray(config.serviceAreas?.areas)) {
    for (const a of config.serviceAreas.areas as any[]) {
      if (typeof a === 'string' && a.length > 0) serviceAreas.push(a);
    }
  }

  const credentials: Array<{ label: string; detail?: string }> = [];
  if (Array.isArray(config.trustBadges?.badges)) {
    for (const b of config.trustBadges.badges as any[]) {
      if (b && typeof b.label === 'string' && b.label.length > 0) {
        credentials.push({
          label: b.label,
          detail: typeof b.detail === 'string' ? b.detail : undefined,
        });
      }
    }
  }

  // Pull past hashtag history — up to 100 of the most recent posts,
  // dedupe, keep tags that appear at least twice (brand preference).
  const recent = await db
    .select({ hashtags: posts.hashtags })
    .from(posts)
    .where(and(eq(posts.clientId, clientId), ne(posts.status, 'rejected')))
    .orderBy(desc(posts.updatedAt))
    .limit(100);
  const counts = new Map<string, number>();
  for (const row of recent) {
    const tags = (row.hashtags ?? []) as string[];
    for (const t of tags) {
      const norm = t.toLowerCase().trim();
      if (!norm) continue;
      counts.set(norm, (counts.get(norm) ?? 0) + 1);
    }
  }
  const pastHashtags = [...counts.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25)
    .map(([t]) => t);

  const topMedia = await db
    .select()
    .from(clientImages)
    .where(and(eq(clientImages.clientId, clientId), ne(clientImages.status, 'rejected')))
    .orderBy(desc(clientImages.qualityScore), desc(clientImages.uploadedAt))
    .limit(12);

  const has = {
    hasVoice: !!client.brandVoice && client.brandVoice.length > 20,
    hasPalette: !!(palette.primary && palette.accent),
    hasLogo: !!logoUrl,
    hasContact: !!(contact.phone || contact.email),
    hasServices: services.length > 0,
    hasTeam: teamMembers.length > 0,
    hasMedia: topMedia.length > 0,
  };
  const scoreBase = [
    has.hasVoice ? 20 : 0,
    has.hasPalette ? 10 : 0,
    has.hasLogo ? 10 : 0,
    has.hasContact ? 15 : 0,
    has.hasServices ? 15 : 0,
    has.hasTeam ? 10 : 0,
    has.hasMedia ? 20 : 0,
  ].reduce((a, b) => a + b, 0);

  return {
    businessName: client.businessName,
    industry: client.industry ?? undefined,
    brandVoiceGuide: client.brandVoice ?? undefined,
    websiteUrl: client.websiteUrl ?? undefined,
    palette,
    logoUrl,
    contact,
    socials,
    services,
    team: teamMembers,
    serviceAreas,
    credentials,
    pastHashtags,
    topMedia: topMedia.map((m) => ({
      id: m.id,
      fileUrl: m.enhancedUrl ?? m.fileUrl,
      mimeType: m.mimeType,
      aiDescription: m.aiDescription,
      qualityScore: m.qualityScore,
    })),
    completeness: { ...has, score: scoreBase },
  };
}

/**
 * Format a BrandContext into a compact Claude-friendly "known facts"
 * block. Only populated fields are included — empty ones are elided
 * entirely so Claude doesn't see noise.
 */
export function brandContextToFactsBlock(ctx: BrandContext): string {
  const lines: string[] = [];
  lines.push(`Business: ${ctx.businessName}`);
  if (ctx.industry) lines.push(`Industry: ${ctx.industry}`);
  if (ctx.websiteUrl) lines.push(`Website: ${ctx.websiteUrl}`);

  const paletteBits: string[] = [];
  if (ctx.palette.primary) paletteBits.push(`primary ${ctx.palette.primary}`);
  if (ctx.palette.secondary) paletteBits.push(`secondary ${ctx.palette.secondary}`);
  if (ctx.palette.accent) paletteBits.push(`accent ${ctx.palette.accent}`);
  if (paletteBits.length) lines.push(`Brand palette: ${paletteBits.join(' · ')}`);

  if (ctx.logoUrl) lines.push(`Logo URL: ${ctx.logoUrl}`);

  if (ctx.contact.phone) lines.push(`Phone: ${ctx.contact.phone}`);
  if (ctx.contact.email) lines.push(`Email: ${ctx.contact.email}`);
  if (ctx.contact.whatsapp) lines.push(`WhatsApp: ${ctx.contact.whatsapp}`);
  if (ctx.contact.address) lines.push(`Address: ${ctx.contact.address}`);
  if (ctx.contact.hours) lines.push(`Hours: ${ctx.contact.hours}`);

  if (ctx.services.length) {
    lines.push(
      `Services: ${ctx.services
        .map((s) => (s.description ? `${s.title} — ${s.description}` : s.title))
        .join('; ')}`,
    );
  }

  if (ctx.team.length) {
    lines.push(`Team: ${ctx.team.map((m) => `${m.name} (${m.role})`).join('; ')}`);
  }

  if (ctx.serviceAreas.length) lines.push(`Service areas: ${ctx.serviceAreas.join(', ')}`);

  if (ctx.credentials.length) {
    lines.push(`Credentials: ${ctx.credentials.map((c) => c.label).join(', ')}`);
  }

  const socialEntries = Object.entries(ctx.socials).filter(([, v]) => v);
  if (socialEntries.length) {
    lines.push(`Social handles: ${socialEntries.map(([k, v]) => `${k}=${v}`).join(', ')}`);
  }

  if (ctx.pastHashtags.length) {
    lines.push(`Hashtags this brand has used repeatedly: ${ctx.pastHashtags.join(' ')}`);
  }

  return lines.join('\n');
}

/**
 * Produce a one-line "brand style stub" suitable for dropping into
 * image-generation prompts. Uses palette, industry, and logo presence to
 * shape Flux output so generated images match the rest of the brand
 * instead of looking like random stock.
 */
export function brandContextToImageStyle(ctx: BrandContext): string {
  const parts: string[] = [];
  const p = ctx.palette;
  const palette = [p.primary, p.accent, p.pop].filter(Boolean);
  if (palette.length) {
    parts.push(`brand palette ${palette.join(' / ')}`);
  }
  if (ctx.industry) parts.push(`${ctx.industry.toLowerCase()} aesthetic`);
  parts.push('editorial photography feel, natural light, uncluttered composition');
  parts.push('no visible logos, no text overlays, no watermarks');
  return parts.join(', ');
}
