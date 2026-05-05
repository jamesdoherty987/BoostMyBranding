/**
 * Defensive sanitizer for `WebsiteConfig` arrays. Older saves (before
 * `setPath` was fixed to fill sparse holes) could leave arrays with
 * `null` entries that JSON serialised back to `null` on load. The
 * renderer reads those as member/item objects and crashes on
 * `member.photoUrl`.
 *
 * We run this once in the renderer so every block sees a clean config
 * without needing per-block null filters.
 */

import type { WebsiteConfig } from '@boost/core';

/**
 * Drop null/undefined entries from an array-valued field. Also defensive
 * against malformed configs where a field expected to be an array has
 * been written as a plain object or primitive. When the object has
 * numeric keys (e.g. `{"0": {...}, "1": {...}}`) we auto-repair by
 * converting back into a dense array — this happens when an older
 * version of `setPath` corrupted the config and we want editing to
 * recover gracefully instead of hiding the section forever.
 */
function clean<T>(arr: T[] | undefined | null | Record<string, T>): T[] | undefined {
  if (!arr) return undefined;
  if (Array.isArray(arr)) {
    return arr.filter((x): x is T & {} => x != null);
  }
  if (typeof arr === 'object') {
    // Auto-repair: object with numeric keys becomes an array. This
    // un-corrupts configs previously written by the buggy setPath.
    const obj = arr as Record<string, T>;
    const numericKeys = Object.keys(obj).filter((k) => /^\d+$/.test(k));
    if (numericKeys.length > 0) {
      if (typeof console !== 'undefined' && process.env.NODE_ENV !== 'production') {
        console.warn(
          '[sanitizeConfig] auto-repairing object-as-array with keys',
          numericKeys,
        );
      }
      const maxIdx = Math.max(...numericKeys.map(Number));
      const out: T[] = [];
      for (let i = 0; i <= maxIdx; i++) {
        const v = obj[String(i)];
        if (v != null) out.push(v);
      }
      return out;
    }
    // Object with no numeric keys — genuinely malformed, skip.
    if (typeof console !== 'undefined' && process.env.NODE_ENV !== 'production') {
      console.warn('[sanitizeConfig] expected array, got object', arr);
    }
    return undefined;
  }
  return undefined;
}

/**
 * Return a cleaned copy of the config. Non-destructive — we do NOT mutate
 * the original so the dashboard's optimistic state stays addressable by
 * the original indices.
 *
 * What this fixes:
 *   - `team.members` with null holes (from a sub-page write)
 *   - `services`, `reviews`, `faq`, `stats`, `products.items`,
 *     `portfolio.projects`, `pricingTiers.tiers`, etc.
 *   - `menu.categories[].items` null holes
 *
 * We don't deep-clone everything — only the array paths we touch — so
 * the cost is proportional to array count, not config size.
 */
export function sanitizeConfig(config: WebsiteConfig): WebsiteConfig {
  const c: WebsiteConfig = { ...config };

  // Flat arrays on root
  if (c.services) c.services = clean(c.services) ?? [];
  if (c.reviews) c.reviews = clean(c.reviews) ?? [];
  if (c.faq) c.faq = clean(c.faq) ?? [];
  if (c.stats) c.stats = clean(c.stats) ?? [];
  if (c.navigation) c.navigation = clean(c.navigation) ?? [];
  if (c.about?.bullets) {
    c.about = { ...c.about, bullets: clean(c.about.bullets) ?? [] };
  }
  if (c.gallery?.imageIndices) {
    c.gallery = { ...c.gallery, imageIndices: clean(c.gallery.imageIndices) ?? [] };
  }

  // Industry blocks — members/items/projects/steps/tiers/pairs/badges/logos/areas
  if (c.team?.members) {
    c.team = { ...c.team, members: clean(c.team.members) ?? [] };
  }
  if (c.menu?.categories) {
    c.menu = {
      ...c.menu,
      categories: (clean(c.menu.categories) ?? []).map((cat) => ({
        ...cat,
        items: clean(cat?.items) ?? [],
      })),
    };
  }
  if (c.priceList?.items) {
    c.priceList = { ...c.priceList, items: clean(c.priceList.items) ?? [] };
  }
  if (c.priceList?.groups) {
    c.priceList = {
      ...c.priceList,
      groups: (clean(c.priceList.groups) ?? []).map((g) => ({
        ...g,
        items: clean(g?.items) ?? [],
      })),
    };
  }
  if (c.schedule?.entries) {
    c.schedule = { ...c.schedule, entries: clean(c.schedule.entries) ?? [] };
  }
  if (c.serviceAreas?.areas) {
    c.serviceAreas = { ...c.serviceAreas, areas: clean(c.serviceAreas.areas) ?? [] };
  }
  if (c.beforeAfter?.pairs) {
    c.beforeAfter = { ...c.beforeAfter, pairs: clean(c.beforeAfter.pairs) ?? [] };
  }
  if (c.trustBadges?.badges) {
    c.trustBadges = { ...c.trustBadges, badges: clean(c.trustBadges.badges) ?? [] };
  }
  if (c.products?.items) {
    c.products = { ...c.products, items: clean(c.products.items) ?? [] };
  }
  if (c.portfolio?.projects) {
    c.portfolio = {
      ...c.portfolio,
      projects: (clean(c.portfolio.projects) ?? []).map((proj) => ({
        ...proj,
        imageIndices: clean(proj?.imageIndices),
        imageUrls: clean(proj?.imageUrls),
        tags: clean(proj?.tags),
      })),
    };
  }
  if (c.process?.steps) {
    c.process = { ...c.process, steps: clean(c.process.steps) ?? [] };
  }
  if (c.pricingTiers?.tiers) {
    c.pricingTiers = {
      ...c.pricingTiers,
      tiers: (clean(c.pricingTiers.tiers) ?? []).map((t) => ({
        ...t,
        features: clean(t?.features) ?? [],
      })),
    };
  }
  if (c.logoStrip?.logos) {
    c.logoStrip = { ...c.logoStrip, logos: clean(c.logoStrip.logos) ?? [] };
  }
  if (c.customSections) {
    c.customSections = (clean(c.customSections) ?? []).map((s) => ({
      ...s,
      items: clean(s?.items),
    }));
  }

  // Hero cutouts
  if (c.hero?.cutouts) {
    c.hero = { ...c.hero, cutouts: clean(c.hero.cutouts) };
  }
  if (c.hero?.floatingIcons) {
    c.hero = { ...c.hero, floatingIcons: clean(c.hero.floatingIcons) };
  }

  // Multipage — apply the same cleanup inside each page's blocks.
  if (c.pages) {
    c.pages = (clean(c.pages) ?? []).map((page) => {
      if (!page.blocks) return page;
      // Build a synthetic config just from the page's blocks + hero so we
      // can recurse through the same logic without duplicating it.
      const inner = sanitizeConfig({
        ...c,
        hero: { ...c.hero, ...(page.hero ?? {}) },
        ...(page.blocks as Partial<WebsiteConfig>),
      });
      return {
        ...page,
        hero: page.hero ? { ...page.hero, ...(inner.hero ?? {}) } : page.hero,
        blocks: page.blocks
          ? {
              ...page.blocks,
              team: inner.team,
              menu: inner.menu,
              priceList: inner.priceList,
              services: inner.services,
              reviews: inner.reviews,
              faq: inner.faq,
              stats: inner.stats,
              schedule: inner.schedule,
              serviceAreas: inner.serviceAreas,
              beforeAfter: inner.beforeAfter,
              trustBadges: inner.trustBadges,
              products: inner.products,
              portfolio: inner.portfolio,
              process: inner.process,
              pricingTiers: inner.pricingTiers,
              logoStrip: inner.logoStrip,
              customSections: inner.customSections,
              about: inner.about,
              gallery: inner.gallery,
            }
          : undefined,
      };
    });
  }

  return c;
}
