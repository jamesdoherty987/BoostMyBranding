'use client';

import type { CSSProperties, ReactElement } from 'react';
import type { SiteBlockKey, WebsiteConfig, PageConfig } from '@boost/core';
import { resolvePage } from '@boost/core';
import { themeVars } from './theme';
import { SiteContext } from './context';
import { SiteNav } from './blocks/SiteNav';
import { SiteHero } from './blocks/SiteHero';
import { SiteStats } from './blocks/SiteStats';
import { SiteServices } from './blocks/SiteServices';
import { SiteAbout } from './blocks/SiteAbout';
import { SiteGallery } from './blocks/SiteGallery';
import { SiteReviews } from './blocks/SiteReviews';
import { SiteFAQ } from './blocks/SiteFAQ';
import { SiteContact } from './blocks/SiteContact';
import { SiteFooter } from './blocks/SiteFooter';

interface SiteRendererProps {
  config: WebsiteConfig;
  businessName: string;
  /** URLs of the client's real images. Referenced by index from the config. */
  images?: string[];
  /** Client id — required for the contact form's lead submission. */
  clientId?: string;
  /** API base URL for form submissions. Falls back to mailto when omitted. */
  apiUrl?: string;
  /** If true, the renderer uses scroll-independent positioning for iframe
   *  / dashboard previews. Disables sticky nav, parallax, and reveal animations. */
  embedded?: boolean;
  /**
   * When true, `InlineEditable` fields render as click-to-edit controls.
   * Only set in the dashboard preview. Requires `onFieldChange` to persist.
   */
  editMode?: boolean;
  /**
   * Called with (path, value) when a user commits an inline edit. The
   * dashboard wires this to the `updateWebsiteField` API.
   */
  onFieldChange?: (path: string, value: unknown) => void;
  /**
   * Which page to render for a multipage site. Defaults to `'home'`. When
   * the config has no `pages` array (single-page site), this is ignored.
   */
  pageSlug?: string;
}

/**
 * Assembles a full client site page from a `WebsiteConfig`. For multipage
 * sites it picks the right `PageConfig` from `config.pages` based on the
 * `pageSlug` prop, merges its block overrides over the root config, and
 * renders that page's block layout.
 *
 * Every block consumes the same CSS-variable palette so the look adapts
 * to any primary/accent/pop combination the generator chooses. Safe against
 * malformed configs — the `normalizeConfig` step on the server fills defaults,
 * and every block additionally guards against missing data.
 */
export function SiteRenderer({
  config,
  businessName,
  images = [],
  clientId,
  apiUrl,
  embedded = false,
  editMode = false,
  onFieldChange,
  pageSlug,
}: SiteRendererProps) {
  // Resolve the active page. For single-page sites this always returns a
  // synthetic home page built from the root `layout`; for multipage sites
  // it finds the matching `PageConfig` (and falls back to Home on misses).
  const page = resolvePage(config, pageSlug);
  const pageConfig = buildPageConfig(config, page);

  // Find the page's index in `config.pages` so inline edits on a sub-page
  // can be routed to `pages.<N>.*`. Undefined for single-page sites.
  const pageIndex = config.pages
    ? config.pages.findIndex((p) => p.slug === page.slug)
    : undefined;

  // `themeVars` returns a Record<string, string> of CSS custom properties.
  // React's CSSProperties doesn't include custom `--` props in its type, so we
  // cast at the style boundary (which is a common, safe idiom).
  const style = themeVars(pageConfig.brand) as CSSProperties;

  const blocks: Record<SiteBlockKey, ReactElement | null> = {
    nav: (
      <SiteNav
        key="nav"
        config={pageConfig}
        businessName={businessName}
        embedded={embedded}
        currentPageSlug={page.slug}
      />
    ),
    hero: (
      <SiteHero
        key="hero"
        config={pageConfig}
        images={images}
        businessName={businessName}
        embedded={embedded}
      />
    ),
    stats: <SiteStats key="stats" config={pageConfig} />,
    services: <SiteServices key="services" config={pageConfig} />,
    about: <SiteAbout key="about" config={pageConfig} images={images} businessName={businessName} />,
    gallery: <SiteGallery key="gallery" config={pageConfig} images={images} businessName={businessName} />,
    reviews: <SiteReviews key="reviews" config={pageConfig} />,
    faq: <SiteFAQ key="faq" config={pageConfig} />,
    contact: <SiteContact key="contact" config={pageConfig} clientId={clientId} apiUrl={apiUrl} />,
    footer: <SiteFooter key="footer" config={pageConfig} businessName={businessName} />,
  };

  return (
    <SiteContext.Provider
      value={{
        embedded,
        apiUrl,
        clientId,
        businessName,
        editMode,
        onFieldChange,
        currentPageSlug: page.slug,
        pageIndex: pageIndex != null && pageIndex >= 0 ? pageIndex : undefined,
      }}
    >
      <div
        id="top"
        style={style}
        className={`relative w-full bg-white text-slate-900 ${embedded ? '' : 'min-h-screen'}`}
      >
        {page.layout.map((key) => blocks[key] ?? null)}
      </div>
    </SiteContext.Provider>
  );
}

/**
 * Build a flat `WebsiteConfig` for the active page by merging the page's
 * hero override + block overrides on top of the root config. Blocks that
 * aren't overridden fall through to the root config's data.
 *
 * Example: a "Menu" page with `blocks.services` set to a menu-specific list
 * uses that list instead of the homepage's featured services. Its hero
 * headline can say "Our Menu" while the homepage hero stays on brand.
 */
function buildPageConfig(root: WebsiteConfig, page: PageConfig): WebsiteConfig {
  const b = page.blocks ?? {};
  return {
    ...root,
    layout: page.layout,
    hero: {
      ...root.hero,
      ...(page.hero ?? {}),
    },
    about: b.about ?? root.about,
    stats: b.stats ?? root.stats,
    services: b.services ?? root.services,
    gallery: b.gallery ?? root.gallery,
    reviews: b.reviews ?? root.reviews,
    faq: b.faq ?? root.faq,
    contact: b.contact ?? root.contact,
  };
}
