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
 *
 * Decorative cutouts (`config.hero.cutouts`) are rendered as an absolutely
 * positioned overlay regardless of variant — they sit in two layers, one
 * below the copy (behind) and one above (foreground), and every variant
 * handles the main visuals inside its own section. The dispatcher wraps
 * the variant in a relative container so the cutout layer can anchor to
 * the correct bounds.
 */

import type { WebsiteConfig, HeroVariant, SiteTemplate } from '@boost/core';
import { DEFAULT_HERO_VARIANT, HERO_VARIANTS } from '@boost/core';
import type { ReactElement } from 'react';
import {
  HeroSpotlight,
  HeroBeams,
  HeroFloatingIcons,
  HeroParallaxLayers,
  HeroGradientMesh,
  HeroAurora,
  HeroWavy,
  HeroSparkles,
  HeroHighlightDots,
  HeroDither,
  HeroMulticolor,
  HeroFullBgImage,
  HeroTwoColumnImage,
  HeroMeteors,
  HeroVortex,
  HeroLamp,
  HeroShootingStars,
  HeroBoxes,
  HeroRipple,
} from './hero';
import { HeroCutouts } from './hero/HeroCutouts';

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
  const rawVariant = config.hero?.variant;
  // Validate against the known list so a stale config (from an older schema,
  // or a Claude response that drifted) falls back predictably rather than
  // rendering nothing.
  const variant: HeroVariant =
    rawVariant && (HERO_VARIANTS as readonly string[]).includes(rawVariant)
      ? rawVariant
      : templateDefault;
  if (rawVariant && variant !== rawVariant) {
    // Dev-only warning — swallowed in production via the console noise filter.
    if (typeof console !== 'undefined') {
      console.warn(
        `[SiteHero] Unknown hero variant "${rawVariant}", falling back to "${variant}"`,
      );
    }
  }

  // Resolve which image (if any) the hero should use. Precedence:
  //   1. Explicit client image index
  //   2. AI-generated hero image
  //   3. Nothing — variant falls back to its own visual treatment
  const clientImage =
    config.hero?.imageIndex != null ? images[config.hero.imageIndex] : undefined;
  const heroImage = clientImage ?? config.hero?.aiImageUrl ?? undefined;

  let variantEl: ReactElement;
  switch (variant) {
    case 'spotlight':
      variantEl = <HeroSpotlight config={config} heroImage={heroImage} embedded={embedded} />;
      break;

    case 'beams':
      variantEl = <HeroBeams config={config} embedded={embedded} />;
      break;

    case 'floating-icons':
      variantEl = <HeroFloatingIcons config={config} embedded={embedded} />;
      break;

    case 'gradient-mesh':
      variantEl = <HeroGradientMesh config={config} embedded={embedded} />;
      break;

    case 'aurora':
      variantEl = <HeroAurora config={config} embedded={embedded} />;
      break;

    case 'wavy':
      variantEl = <HeroWavy config={config} embedded={embedded} />;
      break;

    case 'sparkles':
      variantEl = <HeroSparkles config={config} embedded={embedded} />;
      break;

    case 'hero-highlight':
      variantEl = <HeroHighlightDots config={config} embedded={embedded} />;
      break;

    case 'dither':
      variantEl = <HeroDither config={config} embedded={embedded} />;
      break;

    case 'multicolor':
      variantEl = <HeroMulticolor config={config} embedded={embedded} />;
      break;

    case 'full-bg-image':
      variantEl = (
        <HeroFullBgImage config={config} heroImage={heroImage} embedded={embedded} />
      );
      break;

    case 'two-column-image':
      variantEl = (
        <HeroTwoColumnImage config={config} heroImage={heroImage} embedded={embedded} />
      );
      break;

    case 'meteors':
      variantEl = <HeroMeteors config={config} embedded={embedded} />;
      break;

    case 'vortex':
      variantEl = <HeroVortex config={config} embedded={embedded} />;
      break;

    case 'lamp':
      variantEl = <HeroLamp config={config} embedded={embedded} />;
      break;

    case 'shooting-stars':
      variantEl = <HeroShootingStars config={config} embedded={embedded} />;
      break;

    case 'boxes':
      variantEl = <HeroBoxes config={config} embedded={embedded} />;
      break;

    case 'ripple':
      variantEl = <HeroRipple config={config} embedded={embedded} />;
      break;

    case 'parallax-layers':
      variantEl = (
        <HeroParallaxLayers
          config={config}
          heroImage={heroImage}
          businessName={businessName}
          embedded={embedded}
        />
      );
      break;

    default:
      variantEl = (
        <HeroParallaxLayers
          config={config}
          heroImage={heroImage}
          businessName={businessName}
          embedded={embedded}
        />
      );
  }

  const cutouts = config.hero?.cutouts;
  if (!cutouts || cutouts.length === 0) {
    return variantEl;
  }

  // Wrap the variant so the cutouts can overlay it. The variant itself is
  // already `position: relative` on its root <section>, so we use a relative
  // fragment wrapper with cutout layers absolutely positioned inside.
  return (
    <div className="relative">
      <HeroCutouts cutouts={cutouts} embedded={embedded} layer={0} />
      {variantEl}
      <HeroCutouts cutouts={cutouts} embedded={embedded} layer={1} />
    </div>
  );
}
