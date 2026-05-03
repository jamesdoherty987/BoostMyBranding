/**
 * Shared helpers for rewriting a block's local field path to the right
 * place in a multipage config when the user is editing a sub-page.
 *
 * Both `InlineEditable` (text) and `InlineImage` (image picker) use this
 * so a click on an About sub-page's photo lands in
 * `pages.N.blocks.about.imageIndex` instead of stomping the homepage's
 * About image at `about.imageIndex`.
 */

/**
 * Block keys that live inside a `PageConfig.blocks` override. These are
 * the per-page data sections — everything else (brand, meta, navigation)
 * is global across pages and stays at the root.
 *
 * Keep this in sync with `PageConfig.blocks` in packages/core/src/website.ts.
 * The `announcement` key is intentionally omitted because it's a top-of-
 * site bar that's always global.
 */
export const PER_PAGE_BLOCK_KEYS = new Set<string>([
  'about',
  'stats',
  'statsSection',
  'servicesSection',
  'services',
  'gallery',
  'reviewsSection',
  'reviews',
  'faqSection',
  'faq',
  'contact',
  'footer',
  'menu',
  'priceList',
  'team',
  'schedule',
  'serviceAreas',
  'beforeAfter',
  'trustBadges',
  'cta',
  'customSections',
  'products',
  'portfolio',
  'process',
  'pricingTiers',
  'logoStrip',
  'video',
  'newsletter',
]);

/**
 * Rewrite a local field path to the right place in the config when the
 * user is editing a sub-page. See the module-level docstring for examples.
 *
 * Returns the path unchanged when:
 *   - currentPageSlug is 'home' or undefined
 *   - pageIndex is missing
 *   - the path points at a global field (brand.*, meta.*, navigation, template)
 *   - the top-level key isn't a known per-page block
 */
export function remapPathForPage(
  path: string,
  currentPageSlug: string | undefined,
  pageIndex: number | undefined,
): string {
  if (!currentPageSlug || currentPageSlug === 'home') return path;
  if (pageIndex == null || pageIndex < 0) return path;

  // Global keys stay at the root.
  if (
    path.startsWith('brand.') ||
    path.startsWith('meta.') ||
    path.startsWith('navigation') ||
    path === 'template'
  ) {
    return path;
  }

  // hero.* → pages.N.hero.*
  if (path.startsWith('hero.') || path === 'hero') {
    return `pages.${pageIndex}.${path}`;
  }

  // {block}.* (services.0.title, about.heading, etc) → pages.N.blocks.{block}.*
  const firstDot = path.indexOf('.');
  const head = firstDot === -1 ? path : path.slice(0, firstDot);
  if (PER_PAGE_BLOCK_KEYS.has(head)) {
    return `pages.${pageIndex}.blocks.${path}`;
  }

  // Unknown path — leave it alone. Better to write nothing unexpected than
  // to silently drop an edit into pages.N.blocks.something_we_dont_know.
  return path;
}
