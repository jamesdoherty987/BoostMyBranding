'use client';

/**
 * Left-aligned copy with a parallax-drifting field of industry icons or
 * emojis behind it. Claude picks the icons per business — coffee cups for
 * a cafe, scissors for a salon, dumbbells for a gym. Playful and warm.
 *
 * Best for food / beauty — anywhere the brand personality is the point.
 */

import { useRef } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import type { WebsiteConfig, SiteTemplate } from '@boost/core';
import { FloatingIcons } from '../../effects';
import { HeroCopy } from './HeroCopy';

/**
 * Per-template default icon/emoji sets for when the generator doesn't
 * supply `hero.floatingIcons`. Each list is a mix of Lucide icon names
 * and emojis so the background has visual variety.
 */
const FLOATING_ICON_DEFAULTS: Record<SiteTemplate, string[]> = {
  service: ['Wrench', 'Hammer', 'Truck', 'Shield', '🔧', 'CheckCircle2'],
  food: ['Coffee', 'Utensils', 'Leaf', 'Flame', '☕', '🍴', '🥐', 'Star'],
  beauty: ['Scissors', 'Sparkles', 'Sun', 'HeartPulse', '✂️', '💅', '✨'],
  fitness: ['Dumbbell', 'HeartPulse', 'Zap', 'Award', '💪', '🏋️', '🔥'],
  professional: ['Shield', 'CheckCircle2', 'Award', 'Users', 'Star', 'Globe'],
  retail: ['Star', 'Sparkles', 'Award', 'Truck', '🛍️', '💎', '🎁'],
  medical: ['HeartPulse', 'Shield', 'CheckCircle2', 'Users', 'Sun'],
  creative: ['Camera', 'Sparkles', 'Brush', 'Sun', 'Star', '🎨', '📷'],
  realestate: ['Home', 'MapPin', 'Shield', 'Award', '🏡', 'CheckCircle2'],
  education: ['Award', 'Star', 'Users', 'CheckCircle2', '📚', '🎓', '✏️'],
  automotive: ['Wrench', 'Truck', 'Shield', 'Zap', '🚗', '🔧'],
  hospitality: ['Sun', 'Star', 'Users', 'Coffee', '🛎️', '🏨', '✨'],
  legal: ['Shield', 'CheckCircle2', 'Award', 'Users'],
  nonprofit: ['HeartPulse', 'Users', 'Leaf', 'Sun', 'Star', '❤️'],
  tech: ['Zap', 'Globe', 'Sparkles', 'CheckCircle2', '⚡', '💻'],
};

interface HeroFloatingIconsProps {
  config: WebsiteConfig;
  embedded?: boolean;
}

export function HeroFloatingIcons({ config, embedded }: HeroFloatingIconsProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const dark = config.brand.heroStyle === 'dark';

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });
  const copyY = useTransform(scrollYProgress, [0, 1], ['0px', '-40px']);
  const copyOpacity = useTransform(scrollYProgress, [0, 0.7, 1], [1, 1, 0]);
  const iconsY = useTransform(scrollYProgress, [0, 1], ['0px', '-100px']);
  const motionDisabled = reduced || embedded;

  const icons = config.hero?.floatingIcons?.length
    ? config.hero.floatingIcons
    : FLOATING_ICON_DEFAULTS[config.template ?? 'service'];

  return (
    <section
      ref={ref}
      id="home"
      className={`relative isolate overflow-hidden ${dark ? 'text-white' : 'text-slate-900'}`}
      style={{
        background: dark
          ? 'linear-gradient(180deg, var(--bmb-site-dark) 0%, #0b1220 100%)'
          : `linear-gradient(180deg, color-mix(in srgb, ${config.brand.primaryColor} 6%, white) 0%, #ffffff 60%, #f8fafc 100%)`,
        minHeight: embedded ? '640px' : undefined,
      }}
    >
      {/* Parallax-drifting icons layer */}
      <motion.div
        className="absolute inset-0"
        style={motionDisabled ? undefined : { y: iconsY }}
      >
        <FloatingIcons
          icons={icons}
          color={config.brand.primaryColor}
          opacity={dark ? 0.2 : 0.14}
        />
      </motion.div>

      {/* Soft corner glow to anchor the copy */}
      <div
        aria-hidden
        className="absolute -top-1/3 -left-1/4 h-[70vh] w-[70vh] rounded-full blur-3xl"
        style={{
          background: `radial-gradient(circle, ${config.brand.primaryColor}33, transparent 60%)`,
        }}
      />
      <div
        aria-hidden
        className="absolute -bottom-1/4 -right-1/4 h-[60vh] w-[60vh] rounded-full blur-3xl"
        style={{
          background: `radial-gradient(circle, ${config.brand.accentColor}33, transparent 60%)`,
        }}
      />

      <div className="mx-auto flex min-h-[520px] max-w-6xl md:min-h-[640px] flex-col justify-center px-4 py-14 md:py-24 lg:py-32">
        <HeroCopy
          config={config}
          dark={dark}
          align="left"
          motionDisabled={motionDisabled}
          style={motionDisabled ? undefined : { y: copyY, opacity: copyOpacity }}
        />
      </div>
    </section>
  );
}
