/**
 * Public entry for the client-site rendering module. Everything needed to
 * assemble a client site from a `WebsiteConfig` is exported from here.
 */

export { SiteRenderer } from './SiteRenderer';
export { resolveIcon, ICON_MAP } from './icon-map';
export { themeVars, brandGradient } from './theme';
export { SiteContext, useSiteContext, type SiteContextValue } from './context';
export { InlineEditable } from './InlineEditable';

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
