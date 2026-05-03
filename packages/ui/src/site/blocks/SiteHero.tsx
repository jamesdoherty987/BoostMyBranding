'use client';

/**
 * Hero dispatcher. Picks one of five visual variants based on the config's
 * `hero.variant` field (or a template-appropriate default). Each variant is
 * a fundamentally different treatment — spotlight, beams, floating icons,
 * parallax layers, gradient mesh — not just toggles on the same layout.
 *
 * Variants are implemented as separate components in ./hero/* so they can
 * be worked on independently and shared with other surfaces later. The
 * generator prompt is expected to pick a variant that matches the
 * business personality; we fall back by template when it doesn't.
 */

import type { WebsiteConfig, HeroVariant, SiteTemplate } from '@boost/core';
import { DEFAULT_HERO_VARIANT } from '@boost/core';
import {
  HeroSpotlight,
  HeroBeams,
  HeroFloatingIcons,
  HeroParallaxLayers,
  HeroGradientMesh,
} from './hero';

interface SiteHeroProps {
  config: WebsiteConfig;
  images: string[];
  businessName: string;
  /** When true, disables scroll-linked transforms that assume the viewport. */
  embedded?: boolean;
}

/**
 * Thin dispatcher — no rendering logic, just pick the variant and pass the
 * right props. Keeping this small means new variants can be added without
 * touching the blocks that already exist.
 *
 * Defensive: if `template` or `variant` contain a value the schema doesn't
 * recognise (e.g. an older config from before we added variants, or a
 * corrupted JSON blob), we fall back to `parallax-layers` rather than crash.
 */
export function SiteHero({ config, images, businessName, embedded }: SiteHeroProps) {
  const template: SiteTemplate = (config.template ?? 'service') as SiteTemplate;
  const templateDefault = DEFAULT_HERO_VARIANT[template] ?? 'parallax-layers';
  const variant: HeroVariant = config.hero?.variant ?? templateDefault;

  // Resolve which image (if any) the hero should use. Precedence:
  //   1. Explicit client image index
  //   2. AI-generated hero image
  //   3. Nothing — variant falls back to its own visual treatment
  const clientImage =
    config.hero?.imageIndex != null ? images[config.hero.imageIndex] : undefined;
  const heroImage = clientImage ?? config.hero?.aiImageUrl ?? undefined;

  switch (variant) {
    case 'spotlight':
      return <HeroSpotlight config={config} heroImage={heroImage} embedded={embedded} />;

    case 'beams':
      return <HeroBeams config={config} embedded={embedded} />;

    case 'floating-icons':
      return <HeroFloatingIcons config={config} embedded={embedded} />;

    case 'gradient-mesh':
      return <HeroGradientMesh config={config} embedded={embedded} />;

    case 'parallax-layers':
      return (
        <HeroParallaxLayers
          config={config}
          heroImage={heroImage}
          businessName={businessName}
          embedded={embedded}
        />
      );

    default:
      // Unknown variant — safe fallback.
      return (
        <HeroParallaxLayers
          config={config}
          heroImage={heroImage}
          businessName={businessName}
          embedded={embedded}
        />
      );
  }
}
