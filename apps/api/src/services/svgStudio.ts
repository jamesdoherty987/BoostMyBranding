/**
 * AI-generated, brand-tinted SVG illustrations for the hero parallax
 * slot. Different from `generateHeroIllustration` (which routes to
 * fal.ai for a raster image) — this one asks Claude to write an actual
 * vector SVG from scratch. Good for crisp geometric logos, icon-style
 * illustrations, and branded marks.
 *
 * Output is sanitised before it's returned so malicious script/event
 * handlers never reach the client, and persisted into
 * `hero.illustration.customSvg` so the renderer can mount it inline.
 */

import { eq } from 'drizzle-orm';
import { getDb, isDbConfigured, clients } from '@boost/database';
import type { WebsiteConfig } from '@boost/core';
import { generateText } from './claude.js';
import { withRetry } from './retry.js';

export interface GenerateSvgArgs {
  clientId: string;
  businessName: string;
  industry: string;
  /** Free-text brief. "A minimalist espresso cup with three curls of steam." */
  brief: string;
  /** Brand colours so the SVG is painted in the right palette. */
  primaryColor?: string;
  accentColor?: string;
  popColor?: string;
  /** Optional desired motion preset — used to steer the SVG composition
   *  (spin works best with round/radial shapes, etc.). */
  motion?: string;
  /** Optional model override. Defaults to Opus for best quality. */
  model?: 'opus' | 'sonnet' | 'haiku';
}

export interface GenerateSvgResult {
  svg: string;
  prompt: string;
  fromMock: boolean;
}

/**
 * Ask Claude to hand-write an SVG for this business. Sanitise and
 * persist. Also saves the brief as `hero.illustration.prompt` so the
 * agency can iterate.
 */
export async function generateSvgIllustration(
  args: GenerateSvgArgs,
): Promise<GenerateSvgResult> {
  const prompt = buildSvgPrompt(args);

  const rawRaw = await withRetry(
    () =>
      generateText(prompt, {
        model: args.model ?? 'opus',
        maxTokens: 4096,
      }),
    { label: `svg_studio:${args.clientId}`, attempts: 2 },
  );
  const raw = rawRaw ?? '';

  // Strip any markdown fencing Claude likes to slap on.
  const svgRaw = extractSvg(raw);
  const svg = sanitizeSvg(svgRaw);

  if (!svg || !svg.includes('<svg')) {
    throw new Error('Generator returned no usable SVG');
  }

  if (isDbConfigured()) {
    const db = getDb();
    const [row] = await db
      .select({ websiteConfig: clients.websiteConfig })
      .from(clients)
      .where(eq(clients.id, args.clientId));
    const current = (row?.websiteConfig ?? {}) as Partial<WebsiteConfig>;
    const existingHero = current.hero ?? {
      headline: '',
      subheadline: '',
      imageIndex: null,
      ctaPrimary: { label: '', href: '' },
    };
    const existingIllustration = existingHero.illustration ?? {};
    const next: Partial<WebsiteConfig> = {
      ...current,
      hero: {
        ...existingHero,
        illustration: {
          ...existingIllustration,
          customSvg: svg,
          // Clear the rasters so the SVG wins the source-resolution
          // fight; custom vector overrides.
          customUrl: undefined,
          prompt: args.brief,
        },
      } as WebsiteConfig['hero'],
    };
    await db
      .update(clients)
      .set({ websiteConfig: next as any })
      .where(eq(clients.id, args.clientId));
  }

  return { svg, prompt, fromMock: svg === FALLBACK_SVG };
}

/**
 * Pull the <svg>...</svg> block out of whatever Claude returned. Handles
 * fenced blocks, leading prose, and trailing prose. Returns empty
 * string if no svg tag found.
 */
function extractSvg(raw: string): string {
  const match = raw.match(/<svg[\s\S]*?<\/svg>/i);
  return match?.[0] ?? '';
}

/**
 * Light-touch SVG sanitiser. We never execute the SVG as JS or HTML,
 * but we still drop anything that could bite us via
 * dangerouslySetInnerHTML:
 *   - <script> tags (any case)
 *   - on* event handlers (onclick, onload, etc.)
 *   - xlink:href / href pointing to javascript: or data: (javascript)
 *   - external entity declarations
 *   - <foreignObject> (can host arbitrary HTML including scripts)
 *
 * This is intentionally not a full XSS sanitiser — we're trusting the
 * LLM not to return hostile markup. The point is to defend against
 * the LLM accidentally echoing back a malicious instruction from the
 * user's prompt.
 */
export function sanitizeSvg(input: string): string {
  if (!input) return '';
  let svg = input;

  // Drop <script>...</script>
  svg = svg.replace(/<script[\s\S]*?<\/script>/gi, '');
  svg = svg.replace(/<script[^>]*\/>/gi, '');

  // Drop foreignObject (can contain HTML)
  svg = svg.replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '');

  // Strip inline event handlers (on*="...").
  svg = svg.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '');
  svg = svg.replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '');

  // Block javascript:/data: hrefs.
  svg = svg.replace(/(xlink:href|href)\s*=\s*"(?:javascript|data):[^"]*"/gi, '');
  svg = svg.replace(/(xlink:href|href)\s*=\s*'(?:javascript|data):[^']*'/gi, '');

  // Drop XML entity declarations.
  svg = svg.replace(/<!ENTITY[\s\S]*?>/gi, '');
  svg = svg.replace(/<!DOCTYPE[\s\S]*?>/gi, '');

  // Ensure we have one root <svg> element only — anything outside is
  // discarded. We rely on extractSvg to have done that already but a
  // double-check is cheap.
  const m = svg.match(/<svg[\s\S]*?<\/svg>/i);
  return m?.[0] ?? '';
}

/* ══════════════════════════════════════════════════════════════════ */
/*  Prompt                                                             */
/* ══════════════════════════════════════════════════════════════════ */

function buildSvgPrompt(args: GenerateSvgArgs): string {
  const primary = args.primaryColor ?? '#1D9CA1';
  const accent = args.accentColor ?? '#48D886';
  const pop = args.popColor ?? '#FFEC3D';
  const motionNote = args.motion
    ? `MOTION CONTEXT: the SVG will animate with a "${args.motion}" preset — compose shapes that will look good under that motion (e.g. centre symmetry for spin, clean silhouette for float).`
    : '';

  return `You are an expert SVG designer. Produce ONE self-contained SVG illustration for a small-business website hero.

BUSINESS: ${args.businessName}
INDUSTRY: ${args.industry}

BRIEF FROM AGENCY:
${args.brief}

BRAND COLOURS (use these in gradients and flat fills — do not invent new palette):
  primary ${primary}
  accent  ${accent}
  pop     ${pop}

${motionNote}

HARD REQUIREMENTS — your response must follow these exactly, no exceptions:

1. Output EXACTLY one <svg> element. Nothing before it, nothing after it. No markdown fences, no prose.
2. Root svg MUST have \`xmlns="http://www.w3.org/2000/svg"\` and a \`viewBox="0 0 480 480"\` (square) attribute.
3. Keep to vector primitives: <path>, <rect>, <circle>, <ellipse>, <polygon>, <polyline>, <line>, <g>, <defs>, <linearGradient>, <radialGradient>, <stop>. No <script>, no <foreignObject>, no <image>, no filters using feGaussianBlur with heavy kernels (keep renderers happy).
4. No external references. No xlink:href to external URLs. No <use> pointing at external ids.
5. Paint with the brand palette. Include at least one gradient (primary → accent → pop) so the illustration feels branded.
6. Single dominant subject centred/offset — NOT a busy composition. The illustration sits at ~400×400px on a hero; whitespace around the subject is fine.
7. Add subtle depth: a soft inner highlight (white ellipse, low opacity), a shadow pass (darker fill, low opacity), and clean edges. No photo realism.
8. Silhouette must read at 200px wide. Avoid tiny details that would vanish when scaled down.
9. If motion is "spin" or "orbit", compose around a centre so rotation doesn't look off-axis.
10. If motion is "float" or "bounce", leave empty space above/below the subject so it can bob without clipping.

EXAMPLE shape of a good response (do not copy the subject — this is just structure):

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${primary}"/>
      <stop offset="0.6" stop-color="${accent}"/>
      <stop offset="1" stop-color="${pop}"/>
    </linearGradient>
  </defs>
  <circle cx="240" cy="240" r="160" fill="url(#g)"/>
  <ellipse cx="200" cy="200" rx="40" ry="24" fill="#fff" opacity="0.4"/>
</svg>

Now output the single SVG for the brief above.`;
}

const FALLBACK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480"><circle cx="240" cy="240" r="160" fill="#1D9CA1"/></svg>`;
