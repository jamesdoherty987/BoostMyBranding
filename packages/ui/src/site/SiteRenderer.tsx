'use client';

import type { CSSProperties, ReactElement } from 'react';
import type { SiteBlockKey, WebsiteConfig } from '@boost/core';
import { DEFAULT_LAYOUT } from '@boost/core';
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
}

/**
 * Assembles a full client site from a `WebsiteConfig`. Iterates the `layout`
 * array (or the template default) and renders each block, skipping any whose
 * data is missing. Every block consumes the same CSS-variable palette so the
 * look adapts to any primary/accent/pop combination the generator chooses.
 *
 * Safe against malformed configs — the `normalizeConfig` step on the server
 * fills defaults, and every block additionally guards against missing data.
 */
export function SiteRenderer({
  config,
  businessName,
  images = [],
  clientId,
  apiUrl,
  embedded = false,
}: SiteRendererProps) {
  const template = config.template ?? 'service';
  const layout: SiteBlockKey[] =
    config.layout && config.layout.length > 0 ? config.layout : DEFAULT_LAYOUT[template];

  // `themeVars` returns a Record<string, string> of CSS custom properties.
  // React's CSSProperties doesn't include custom `--` props in its type, so we
  // cast at the style boundary (which is a common, safe idiom).
  const style = themeVars(config.brand) as CSSProperties;

  const blocks: Record<SiteBlockKey, ReactElement | null> = {
    nav: <SiteNav key="nav" config={config} businessName={businessName} embedded={embedded} />,
    hero: (
      <SiteHero
        key="hero"
        config={config}
        images={images}
        businessName={businessName}
        embedded={embedded}
      />
    ),
    stats: <SiteStats key="stats" config={config} />,
    services: <SiteServices key="services" config={config} />,
    about: <SiteAbout key="about" config={config} images={images} businessName={businessName} />,
    gallery: <SiteGallery key="gallery" config={config} images={images} businessName={businessName} />,
    reviews: <SiteReviews key="reviews" config={config} />,
    faq: <SiteFAQ key="faq" config={config} />,
    contact: <SiteContact key="contact" config={config} clientId={clientId} apiUrl={apiUrl} />,
    footer: <SiteFooter key="footer" config={config} businessName={businessName} />,
  };

  return (
    <SiteContext.Provider value={{ embedded, apiUrl, clientId, businessName }}>
      <div
        id="top"
        style={style}
        className={`relative w-full bg-white text-slate-900 ${embedded ? '' : 'min-h-screen'}`}
      >
        {layout.map((key) => blocks[key] ?? null)}
      </div>
    </SiteContext.Provider>
  );
}
