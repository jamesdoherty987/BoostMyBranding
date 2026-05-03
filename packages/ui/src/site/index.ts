/**
 * Public entry for the client-site rendering module. Everything needed to
 * assemble a client site from a `WebsiteConfig` is exported from here.
 */

export { SiteRenderer } from './SiteRenderer';
export { sanitizeConfig } from './sanitize-config';
export { SiteAIChat } from './SiteAIChat';
export { resolveIcon, ICON_MAP } from './icon-map';
export { themeVars, brandGradient } from './theme';
export { SiteContext, useSiteContext, type SiteContextValue } from './context';
export { InlineEditable } from './InlineEditable';
export { InlineImage } from './InlineImage';

export { SiteNav } from './blocks/SiteNav';
export { SiteHero } from './blocks/SiteHero';
export { SiteStats } from './blocks/SiteStats';
export { SiteServices } from './blocks/SiteServices';
export { SiteAbout } from './blocks/SiteAbout';
export { SiteGallery } from './blocks/SiteGallery';
export { SiteReviews } from './blocks/SiteReviews';
export { SiteFAQ } from './blocks/SiteFAQ';
export { SiteContact } from './blocks/SiteContact';
export { SiteFooter } from './blocks/SiteFooter';
export { SiteMobileCta } from './blocks/SiteMobileCta';
export { SiteMenu } from './blocks/SiteMenu';
export { SitePriceList } from './blocks/SitePriceList';
export { SiteTeam } from './blocks/SiteTeam';
export { SiteSchedule } from './blocks/SiteSchedule';
export { SiteServiceAreas } from './blocks/SiteServiceAreas';
export { SiteBeforeAfter } from './blocks/SiteBeforeAfter';
export { SiteTrustBadges } from './blocks/SiteTrustBadges';
export { SiteCta } from './blocks/SiteCta';
export { SiteCustom } from './blocks/SiteCustom';
export { SiteProducts } from './blocks/SiteProducts';
export { SitePortfolio } from './blocks/SitePortfolio';
export { SiteProcess } from './blocks/SiteProcess';
export { SitePricingTiers } from './blocks/SitePricingTiers';
export { SiteAnnouncement } from './blocks/SiteAnnouncement';
export { SiteLogoStrip } from './blocks/SiteLogoStrip';
export { SiteVideo } from './blocks/SiteVideo';
export { SiteNewsletter } from './blocks/SiteNewsletter';

// Hero variants, exported so the dashboard can preview them individually.
export {
  HeroSpotlight,
  HeroBeams,
  HeroFloatingIcons,
  HeroParallaxLayers,
  HeroGradientMesh,
  HeroCopy,
} from './blocks/hero';

// Effect primitives, exported so they can be composed outside the site
// renderer too (e.g. on a landing page hero).
export {
  BackgroundBeams,
  Spotlight,
  FloatingIcons,
  GradientMesh,
} from './effects';
