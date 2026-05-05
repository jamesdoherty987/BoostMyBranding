'use client';

import type { CSSProperties, ReactElement } from 'react';
import type { SiteBlockKey, WebsiteConfig, PageConfig } from '@boost/core';
import { resolvePage } from '@boost/core';
import { themeVars } from './theme';
import { SiteContext } from './context';
import { sanitizeConfig } from './sanitize-config';
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
import { SiteMobileCta } from './blocks/SiteMobileCta';
import { SiteMenu } from './blocks/SiteMenu';
import { SitePriceList } from './blocks/SitePriceList';
import { SiteTeam } from './blocks/SiteTeam';
import { SiteSchedule } from './blocks/SiteSchedule';
import { SiteServiceAreas } from './blocks/SiteServiceAreas';
import { SiteBeforeAfter } from './blocks/SiteBeforeAfter';
import { SiteTrustBadges } from './blocks/SiteTrustBadges';
import { SiteCta } from './blocks/SiteCta';
import { SiteCustom } from './blocks/SiteCustom';
import { SiteProducts } from './blocks/SiteProducts';
import { SitePortfolio } from './blocks/SitePortfolio';
import { SiteProcess } from './blocks/SiteProcess';
import { SitePricingTiers } from './blocks/SitePricingTiers';
import { SiteAnnouncement } from './blocks/SiteAnnouncement';
import { SiteLogoStrip } from './blocks/SiteLogoStrip';
import { SiteVideo } from './blocks/SiteVideo';
import { SiteNewsletter } from './blocks/SiteNewsletter';
import { SiteAIChat } from './SiteAIChat';

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
   * Called when the user clicks any image in edit mode. Host should open
   * a media-library picker and, on selection, call `onFieldChange` with
   * the resolved imageIndex/imageUrl field path. See InlineImage.tsx.
   */
  onImageClick?: (context: {
    path: string;
    fieldName: 'imageIndex' | 'imageUrl' | 'photoIndex' | 'photoUrl';
  }) => void;
  /**
   * Natural-language AI edit callback for the floating "Ask AI" chat.
   * The host wires this to `editWebsiteWithAI` and returns a short
   * human-readable summary of what changed. Only runs in edit mode.
   */
  onAIEdit?: (instruction: string) => Promise<string>;
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
  onImageClick,
  onAIEdit,
  pageSlug,
}: SiteRendererProps) {
  // Sanitize once at the top so every block downstream sees arrays that
  // are dense and non-null. Cheap — only touches arrays, not leaves.
  const cleanConfig = sanitizeConfig(config);

  // Resolve the active page. For single-page sites this always returns a
  // synthetic home page built from the root `layout`; for multipage sites
  // it finds the matching `PageConfig` (and falls back to Home on misses).
  const page = resolvePage(cleanConfig, pageSlug);
  const pageConfig = buildPageConfig(cleanConfig, page);

  // Find the page's index in `config.pages` so inline edits on a sub-page
  // can be routed to `pages.<N>.*`. Undefined for single-page sites.
  const pageIndex = cleanConfig.pages
    ? cleanConfig.pages.findIndex((p) => p.slug === page.slug)
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
        images={images}
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
    reviews: <SiteReviews key="reviews" config={pageConfig} images={images} />,
    faq: <SiteFAQ key="faq" config={pageConfig} />,
    contact: <SiteContact key="contact" config={pageConfig} clientId={clientId} apiUrl={apiUrl} />,
    footer: <SiteFooter key="footer" config={pageConfig} businessName={businessName} />,
    menu: <SiteMenu key="menu" config={pageConfig} />,
    priceList: <SitePriceList key="priceList" config={pageConfig} />,
    team: <SiteTeam key="team" config={pageConfig} images={images} />,
    schedule: <SiteSchedule key="schedule" config={pageConfig} />,
    serviceAreas: <SiteServiceAreas key="serviceAreas" config={pageConfig} />,
    beforeAfter: <SiteBeforeAfter key="beforeAfter" config={pageConfig} images={images} />,
    trustBadges: <SiteTrustBadges key="trustBadges" config={pageConfig} />,
    cta: <SiteCta key="cta" config={pageConfig} images={images} />,
    custom: <SiteCustom key="custom" config={pageConfig} images={images} />,
    products: <SiteProducts key="products" config={pageConfig} images={images} />,
    portfolio: <SitePortfolio key="portfolio" config={pageConfig} images={images} />,
    process: <SiteProcess key="process" config={pageConfig} />,
    pricingTiers: <SitePricingTiers key="pricingTiers" config={pageConfig} />,
    announcement: null, // rendered separately above nav — see below
    logoStrip: <SiteLogoStrip key="logoStrip" config={pageConfig} images={images} />,
    video: <SiteVideo key="video" config={pageConfig} />,
    newsletter: <SiteNewsletter key="newsletter" config={pageConfig} />,
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
        images,
        onImageClick,
        onAIEdit,
      }}
    >
      <div
        id="top"
        style={style}
        className={`relative w-full bg-white text-slate-900 ${embedded ? '' : 'min-h-screen'}`}
      >
        {/* Announcement bar — always renders first (above the nav) when
            present, regardless of block order in `layout`. */}
        <SiteAnnouncement config={pageConfig} />
        {page.layout.map((key) => blocks[key] ?? null)}
        {/* Sticky mobile CTA — renders only on phones, auto-hides in preview */}
        <SiteMobileCta config={pageConfig} />
        {/* Floating "Ask AI" chat — only rendered when edit mode is on and
            the host wired an `onAIEdit` callback. */}
        <SiteAIChat />
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
    statsSection: b.statsSection ?? root.statsSection,
    servicesSection: b.servicesSection ?? root.servicesSection,
    services: b.services ?? root.services,
    gallery: b.gallery ?? root.gallery,
    reviewsSection: b.reviewsSection ?? root.reviewsSection,
    reviews: b.reviews ?? root.reviews,
    faqSection: b.faqSection ?? root.faqSection,
    faq: b.faq ?? root.faq,
    contact: b.contact ?? root.contact,
    socials: root.socials,
    mobileCta: root.mobileCta,
    // Industry-specific blocks — inherit per page via blocks.* overrides.
    menu: b.menu ?? root.menu,
    priceList: b.priceList ?? root.priceList,
    team: b.team ?? root.team,
    schedule: b.schedule ?? root.schedule,
    serviceAreas: b.serviceAreas ?? root.serviceAreas,
    beforeAfter: b.beforeAfter ?? root.beforeAfter,
    trustBadges: b.trustBadges ?? root.trustBadges,
    cta: b.cta ?? root.cta,
    customSections: b.customSections ?? root.customSections,
    // Extra small-business blocks — all per-page overridable except the
    // top-of-site announcement, which is global.
    products: b.products ?? root.products,
    portfolio: b.portfolio ?? root.portfolio,
    process: b.process ?? root.process,
    pricingTiers: b.pricingTiers ?? root.pricingTiers,
    announcement: root.announcement,
    logoStrip: b.logoStrip ?? root.logoStrip,
    video: b.video ?? root.video,
    newsletter: b.newsletter ?? root.newsletter,
    footer: b.footer ?? root.footer,
  };
}
