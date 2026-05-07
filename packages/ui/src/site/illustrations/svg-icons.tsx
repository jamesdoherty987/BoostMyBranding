'use client';

/**
 * Hand-tuned SVG illustrations keyed by `HeroIllustrationStyle`. Each
 * component is a compact, brand-colorable SVG built around a single
 * dominant shape so it reads at any size from 200px to 600px+ on the
 * hero.
 *
 * All components accept a BrandPalette and apply the colours through
 * `stop-color`s on gradients so the same component picks up the site's
 * brand automatically with no re-generation required.
 *
 * The illustrations are intentionally stylised and minimal rather than
 * detailed — they're meant to complement copy, not carry the page.
 */

import type { HeroIllustrationStyle } from '@boost/core';
import type { BrandPalette as SharedBrandPalette, IllustrationProps as SharedIllustrationProps } from './svg-types';
export type BrandPalette = SharedBrandPalette;
type IllustrationProps = SharedIllustrationProps;

import {
  Espresso,
  Croissant,
  PizzaSlice,
  WineGlass,
  Cocktail,
  IceCream,
  Cupcake,
  ChefHat,
  HairDryer,
  Lipstick,
  NailPolish,
  Candle,
  Flower,
  Kettlebell,
  RunningShoe,
  YogaPose,
  Stethoscope,
  Pill,
  HeartPulse,
  Dna,
  Key,
  Couch,
  Lamp,
  Hammer,
  Toolbox,
  PaintBrush,
  Gear,
  Drill,
  Motorcycle,
  DeliveryVan,
  Laptop,
  Atom,
  Cpu,
  GiftBox,
  Diamond,
  Book,
  GraduationCap,
  Apple,
  Palette,
  FilmReel,
  MusicNote,
  Tree,
  Mountain,
  Sun,
  Wave,
  Orb,
  CubeIso,
  Prism,
  Spiral,
} from './extra-svgs';

/* ------------------------------------------------------------------ */
/* Gradient helper — three-stop brand gradient used across the styles */
/* ------------------------------------------------------------------ */

function BrandGradient({
  id,
  brand,
  vertical = false,
}: {
  id: string;
  brand: BrandPalette;
  vertical?: boolean;
}) {
  const pop = brand.pop ?? brand.accent;
  return (
    <linearGradient
      id={id}
      x1="0"
      y1="0"
      x2={vertical ? '0' : '1'}
      y2={vertical ? '1' : '0'}
    >
      <stop offset="0" stopColor={brand.primary} />
      <stop offset="0.6" stopColor={brand.accent} />
      <stop offset="1" stopColor={pop} />
    </linearGradient>
  );
}

/* ------------------------------------------------------------------ */
/* Individual illustration components                                  */
/* ------------------------------------------------------------------ */

/** Compact version of the marketing-site rocket — tuned for use inside
 *  the site hero rather than taking up a full viewport. */
function Rocket({ brand, idPrefix, className }: IllustrationProps) {
  const p = idPrefix;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 240 480"
      className={className}
      aria-hidden
    >
      <defs>
        <BrandGradient id={`${p}body`} brand={brand} vertical />
        <linearGradient id={`${p}hull`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#cbd5e1" />
          <stop offset="0.5" stopColor="#ffffff" />
          <stop offset="1" stopColor="#94a3b8" />
        </linearGradient>
        <radialGradient id={`${p}flame`} cx="0.5" cy="0" r="0.9">
          <stop offset="0" stopColor={brand.pop ?? '#FFEC3D'} />
          <stop offset="0.6" stopColor={brand.accent} stopOpacity="0.7" />
          <stop offset="1" stopColor={brand.primary} stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Flame */}
      <path
        d="M 92 330 C 88 390 96 440 120 460 C 144 440 152 390 148 330 Z"
        fill={`url(#${p}flame)`}
      />
      {/* Fins */}
      <path d="M 94 260 L 60 330 L 94 325 Z" fill={brand.primary} />
      <path d="M 146 260 L 180 330 L 146 325 Z" fill={brand.accent} />
      {/* Body */}
      <path
        d="M 94 120 C 94 80 108 30 120 20 C 132 30 146 80 146 120 L 146 325 C 146 330 142 334 138 334 L 102 334 C 98 334 94 330 94 325 Z"
        fill={`url(#${p}hull)`}
      />
      {/* Body accent band */}
      <rect x="94" y="225" width="52" height="22" fill={`url(#${p}body)`} />
      {/* Porthole */}
      <circle cx="120" cy="175" r="20" fill={brand.dark ?? '#0f172a'} />
      <circle cx="120" cy="175" r="16" fill={brand.accent} />
      <ellipse cx="114" cy="168" rx="5" ry="3" fill="white" opacity="0.8" />
    </svg>
  );
}

/** Chunky wrench — trades, plumbing, mechanics. */
function Wrench({ brand, idPrefix, className }: IllustrationProps) {
  const p = idPrefix;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 480 480"
      className={className}
      aria-hidden
    >
      <defs>
        <BrandGradient id={`${p}bg`} brand={brand} />
        <linearGradient id={`${p}metal`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e2e8f0" />
          <stop offset="0.5" stopColor="#ffffff" />
          <stop offset="1" stopColor="#64748b" />
        </linearGradient>
      </defs>
      {/* Soft brand disc backdrop */}
      <circle cx="240" cy="240" r="200" fill={`url(#${p}bg)`} opacity="0.18" />
      <circle cx="240" cy="240" r="140" fill={`url(#${p}bg)`} opacity="0.28" />
      {/* Wrench body — rotated 35° */}
      <g transform="translate(240 240) rotate(35) translate(-240 -240)">
        <rect x="200" y="165" width="80" height="230" rx="18" fill={`url(#${p}metal)`} />
        <path
          d="M 168 128 A 76 76 0 1 0 312 128 L 296 108 A 56 56 0 1 1 184 108 Z"
          fill={`url(#${p}metal)`}
        />
        {/* Brand handle grip */}
        <rect x="212" y="280" width="56" height="96" rx="14" fill={brand.primary} />
        <rect x="216" y="290" width="48" height="10" rx="3" fill="white" opacity="0.35" />
        <rect x="216" y="310" width="48" height="10" rx="3" fill="white" opacity="0.25" />
        <rect x="216" y="330" width="48" height="10" rx="3" fill="white" opacity="0.15" />
      </g>
    </svg>
  );
}

/** Steaming coffee cup — cafes, bakeries. */
function CoffeeCup({ brand, idPrefix, className }: IllustrationProps) {
  const p = idPrefix;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 480 480"
      className={className}
      aria-hidden
    >
      <defs>
        <BrandGradient id={`${p}cup`} brand={brand} />
        <radialGradient id={`${p}coffee`} cx="0.5" cy="0.2" r="0.8">
          <stop offset="0" stopColor="#78350f" />
          <stop offset="1" stopColor="#3b1f08" />
        </radialGradient>
      </defs>
      {/* Steam curls */}
      <path
        d="M 190 100 C 210 80 180 60 200 30"
        stroke={brand.accent}
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
        opacity="0.8"
      />
      <path
        d="M 240 110 C 260 90 230 70 250 40"
        stroke={brand.primary}
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
        opacity="0.8"
      />
      <path
        d="M 290 100 C 310 80 280 60 300 30"
        stroke={brand.accent}
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
        opacity="0.8"
      />
      {/* Saucer */}
      <ellipse cx="240" cy="420" rx="170" ry="22" fill={brand.dark ?? '#0f172a'} opacity="0.15" />
      <ellipse cx="240" cy="410" rx="160" ry="18" fill={`url(#${p}cup)`} />
      {/* Cup body */}
      <path
        d="M 130 180 L 140 380 C 142 400 160 410 180 410 L 300 410 C 320 410 338 400 340 380 L 350 180 Z"
        fill={`url(#${p}cup)`}
      />
      {/* Coffee surface */}
      <ellipse cx="240" cy="180" rx="110" ry="18" fill={`url(#${p}coffee)`} />
      <ellipse cx="240" cy="178" rx="70" ry="10" fill="#92400e" opacity="0.6" />
      {/* Handle */}
      <path
        d="M 350 220 C 410 230 410 310 350 320"
        stroke={brand.primary}
        strokeWidth="22"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Chunky dumbbell — gyms, fitness. */
function Dumbbell({ brand, idPrefix, className }: IllustrationProps) {
  const p = idPrefix;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 480 480"
      className={className}
      aria-hidden
    >
      <defs>
        <BrandGradient id={`${p}bell`} brand={brand} />
      </defs>
      <g transform="translate(240 240) rotate(-15) translate(-240 -240)">
        {/* Left weight */}
        <rect x="60" y="160" width="60" height="160" rx="14" fill={brand.dark ?? '#0f172a'} />
        <rect x="120" y="190" width="24" height="100" rx="6" fill={brand.accent} />
        {/* Bar */}
        <rect x="140" y="220" width="200" height="40" rx="10" fill={`url(#${p}bell)`} />
        {/* Right weight */}
        <rect x="336" y="190" width="24" height="100" rx="6" fill={brand.accent} />
        <rect x="360" y="160" width="60" height="160" rx="14" fill={brand.dark ?? '#0f172a'} />
      </g>
    </svg>
  );
}

/** Pair of scissors — salons, barbers. */
function Scissors({ brand, idPrefix, className }: IllustrationProps) {
  const p = idPrefix;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 480 480"
      className={className}
      aria-hidden
    >
      <defs>
        <BrandGradient id={`${p}s`} brand={brand} />
        <linearGradient id={`${p}blade`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e2e8f0" />
          <stop offset="0.7" stopColor="#f8fafc" />
          <stop offset="1" stopColor="#94a3b8" />
        </linearGradient>
      </defs>
      <g transform="translate(240 240) rotate(-20) translate(-240 -240)">
        {/* Blades */}
        <path
          d="M 240 240 L 360 80 L 400 110 L 260 260 Z"
          fill={`url(#${p}blade)`}
          stroke={brand.dark ?? '#0f172a'}
          strokeWidth="2"
          strokeOpacity="0.3"
        />
        <path
          d="M 240 240 L 120 80 L 80 110 L 220 260 Z"
          fill={`url(#${p}blade)`}
          stroke={brand.dark ?? '#0f172a'}
          strokeWidth="2"
          strokeOpacity="0.3"
        />
        {/* Pivot */}
        <circle cx="240" cy="250" r="10" fill={brand.dark ?? '#0f172a'} />
        {/* Finger loops */}
        <circle cx="300" cy="370" r="50" stroke={`url(#${p}s)`} strokeWidth="20" fill="none" />
        <circle cx="180" cy="370" r="50" stroke={`url(#${p}s)`} strokeWidth="20" fill="none" />
      </g>
    </svg>
  );
}

/** Simple stylised leaf — wellness, organic, eco. */
function Leaf({ brand, idPrefix, className }: IllustrationProps) {
  const p = idPrefix;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 480 480"
      className={className}
      aria-hidden
    >
      <defs>
        <BrandGradient id={`${p}leaf`} brand={brand} vertical />
      </defs>
      <path
        d="M 360 100 C 280 100 140 200 120 360 C 180 380 300 360 380 260 C 420 200 400 140 360 100 Z"
        fill={`url(#${p}leaf)`}
      />
      {/* Vein */}
      <path
        d="M 120 360 C 200 300 290 200 370 120"
        stroke={brand.dark ?? '#0f172a'}
        strokeWidth="4"
        strokeLinecap="round"
        opacity="0.4"
        fill="none"
      />
      {/* Stem */}
      <path
        d="M 120 360 L 80 420"
        stroke={brand.dark ?? '#0f172a'}
        strokeWidth="10"
        strokeLinecap="round"
        opacity="0.6"
      />
    </svg>
  );
}

/** Cozy house — real estate, home services. */
function House({ brand, idPrefix, className }: IllustrationProps) {
  const p = idPrefix;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 480 480"
      className={className}
      aria-hidden
    >
      <defs>
        <BrandGradient id={`${p}roof`} brand={brand} />
      </defs>
      {/* Shadow */}
      <ellipse cx="240" cy="440" rx="180" ry="14" fill={brand.dark ?? '#0f172a'} opacity="0.14" />
      {/* Body */}
      <rect x="100" y="220" width="280" height="200" rx="6" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="4" />
      {/* Roof */}
      <path d="M 60 240 L 240 90 L 420 240 Z" fill={`url(#${p}roof)`} />
      {/* Door */}
      <rect x="210" y="300" width="60" height="120" rx="4" fill={brand.primary} />
      <circle cx="258" cy="360" r="3" fill={brand.pop ?? '#FFEC3D'} />
      {/* Windows */}
      <rect x="130" y="260" width="60" height="60" rx="4" fill={brand.accent} opacity="0.8" />
      <rect x="290" y="260" width="60" height="60" rx="4" fill={brand.accent} opacity="0.8" />
      <line x1="160" y1="260" x2="160" y2="320" stroke="white" strokeWidth="3" />
      <line x1="130" y1="290" x2="190" y2="290" stroke="white" strokeWidth="3" />
      <line x1="320" y1="260" x2="320" y2="320" stroke="white" strokeWidth="3" />
      <line x1="290" y1="290" x2="350" y2="290" stroke="white" strokeWidth="3" />
    </svg>
  );
}

/** Simplified molar — dental. */
function Tooth({ brand, idPrefix, className }: IllustrationProps) {
  const p = idPrefix;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 480 480"
      className={className}
      aria-hidden
    >
      <defs>
        <BrandGradient id={`${p}t`} brand={brand} vertical />
      </defs>
      <path
        d="M 240 70 C 170 70 110 110 110 180 C 110 230 130 280 140 350 C 148 400 170 420 190 420 C 210 420 220 380 230 320 C 235 290 245 290 250 320 C 260 380 270 420 290 420 C 310 420 332 400 340 350 C 350 280 370 230 370 180 C 370 110 310 70 240 70 Z"
        fill="#ffffff"
        stroke={`url(#${p}t)`}
        strokeWidth="10"
      />
      {/* Sparkle */}
      <path
        d="M 300 150 L 308 138 L 312 150 L 324 154 L 312 158 L 308 170 L 304 158 L 292 154 Z"
        fill={brand.pop ?? '#FFEC3D'}
      />
    </svg>
  );
}

/** Pencil/pen — education, design, writing. */
function Pencil({ brand, idPrefix, className }: IllustrationProps) {
  const p = idPrefix;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 480 480"
      className={className}
      aria-hidden
    >
      <defs>
        <BrandGradient id={`${p}shaft`} brand={brand} />
      </defs>
      <g transform="translate(240 240) rotate(-35) translate(-240 -240)">
        {/* Tip */}
        <path d="M 70 220 L 130 190 L 130 290 Z" fill="#0f172a" />
        {/* Wood */}
        <path d="M 130 190 L 170 180 L 170 300 L 130 290 Z" fill="#fde68a" />
        {/* Shaft */}
        <rect x="170" y="180" width="200" height="120" fill={`url(#${p}shaft)`} />
        {/* Brand band */}
        <rect x="170" y="215" width="200" height="10" fill={brand.pop ?? '#FFEC3D'} />
        {/* Ferrule */}
        <rect x="370" y="180" width="30" height="120" fill="#9ca3af" />
        <rect x="372" y="200" width="26" height="10" fill="#6b7280" />
        <rect x="372" y="270" width="26" height="10" fill="#6b7280" />
        {/* Eraser */}
        <rect x="400" y="180" width="40" height="120" rx="8" fill="#fca5a5" />
      </g>
    </svg>
  );
}

/** Gavel — legal. */
function Gavel({ brand, idPrefix, className }: IllustrationProps) {
  const p = idPrefix;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 480 480"
      className={className}
      aria-hidden
    >
      <defs>
        <BrandGradient id={`${p}g`} brand={brand} />
      </defs>
      <g transform="translate(240 240) rotate(-25) translate(-240 -240)">
        {/* Head */}
        <rect x="100" y="130" width="160" height="90" rx="12" fill={`url(#${p}g)`} />
        <rect x="108" y="140" width="144" height="8" rx="2" fill="white" opacity="0.4" />
        {/* Neck */}
        <rect x="160" y="220" width="40" height="24" fill="#78350f" />
        {/* Handle */}
        <rect x="150" y="244" width="60" height="190" rx="10" fill="#8b4513" />
        <rect x="156" y="260" width="48" height="8" fill="#6b3410" />
        <rect x="156" y="290" width="48" height="8" fill="#6b3410" />
        <rect x="156" y="320" width="48" height="8" fill="#6b3410" />
        {/* End cap */}
        <rect x="146" y="430" width="68" height="16" rx="6" fill="#5c2e0c" />
      </g>
      {/* Sound block */}
      <rect x="120" y="390" width="240" height="30" rx="8" fill="#78350f" />
      <rect x="140" y="395" width="200" height="6" rx="2" fill="white" opacity="0.3" />
    </svg>
  );
}

/** Stylised camera — photography, creative. */
function Camera({ brand, idPrefix, className }: IllustrationProps) {
  const p = idPrefix;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 480 480"
      className={className}
      aria-hidden
    >
      <defs>
        <BrandGradient id={`${p}body`} brand={brand} />
        <radialGradient id={`${p}lens`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={brand.accent} />
          <stop offset="0.6" stopColor={brand.primary} />
          <stop offset="1" stopColor={brand.dark ?? '#0f172a'} />
        </radialGradient>
      </defs>
      {/* Viewfinder bump */}
      <rect x="170" y="110" width="140" height="50" rx="8" fill={brand.dark ?? '#0f172a'} />
      <rect x="200" y="120" width="80" height="6" rx="2" fill={brand.pop ?? '#FFEC3D'} />
      {/* Body */}
      <rect x="80" y="150" width="320" height="220" rx="24" fill={`url(#${p}body)`} />
      <rect x="90" y="162" width="300" height="20" rx="10" fill="white" opacity="0.15" />
      {/* Lens */}
      <circle cx="240" cy="260" r="90" fill={brand.dark ?? '#0f172a'} />
      <circle cx="240" cy="260" r="78" fill={`url(#${p}lens)`} />
      <circle cx="240" cy="260" r="50" fill={brand.dark ?? '#0f172a'} opacity="0.6" />
      <circle cx="224" cy="244" r="14" fill="white" opacity="0.4" />
      {/* Flash */}
      <circle cx="340" cy="200" r="14" fill={brand.pop ?? '#FFEC3D'} />
    </svg>
  );
}

/** Side-view stylised car — automotive. */
function Car({ brand, idPrefix, className }: IllustrationProps) {
  const p = idPrefix;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 480 360"
      className={className}
      aria-hidden
    >
      <defs>
        <BrandGradient id={`${p}car`} brand={brand} />
      </defs>
      {/* Shadow */}
      <ellipse cx="240" cy="310" rx="200" ry="12" fill="#0f172a" opacity="0.18" />
      {/* Body lower */}
      <path
        d="M 60 260 L 60 210 L 120 200 L 180 140 L 300 140 L 360 200 L 420 210 L 420 260 Z"
        fill={`url(#${p}car)`}
      />
      {/* Windows */}
      <path
        d="M 190 150 L 200 200 L 290 200 L 290 150 Z"
        fill={brand.dark ?? '#0f172a'}
        opacity="0.8"
      />
      <rect x="240" y="148" width="4" height="54" fill="white" opacity="0.4" />
      {/* Highlight band */}
      <path
        d="M 60 220 L 420 220 L 420 230 L 60 230 Z"
        fill="white"
        opacity="0.25"
      />
      {/* Wheel wells */}
      <circle cx="140" cy="265" r="42" fill="#0f172a" />
      <circle cx="340" cy="265" r="42" fill="#0f172a" />
      <circle cx="140" cy="265" r="24" fill="#64748b" />
      <circle cx="340" cy="265" r="24" fill="#64748b" />
      <circle cx="140" cy="265" r="8" fill={brand.pop ?? '#FFEC3D'} />
      <circle cx="340" cy="265" r="8" fill={brand.pop ?? '#FFEC3D'} />
    </svg>
  );
}

/** Paw print — pet care. */
function Paw({ brand, idPrefix, className }: IllustrationProps) {
  const p = idPrefix;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 480 480"
      className={className}
      aria-hidden
    >
      <defs>
        <BrandGradient id={`${p}paw`} brand={brand} vertical />
      </defs>
      {/* Main pad */}
      <path
        d="M 240 220 C 180 220 150 260 150 310 C 150 360 200 400 240 400 C 280 400 330 360 330 310 C 330 260 300 220 240 220 Z"
        fill={`url(#${p}paw)`}
      />
      {/* Toe beans */}
      <ellipse cx="140" cy="200" rx="36" ry="46" fill={`url(#${p}paw)`} />
      <ellipse cx="200" cy="130" rx="32" ry="44" fill={`url(#${p}paw)`} />
      <ellipse cx="280" cy="130" rx="32" ry="44" fill={`url(#${p}paw)`} />
      <ellipse cx="340" cy="200" rx="36" ry="46" fill={`url(#${p}paw)`} />
    </svg>
  );
}

/** Briefcase — professional / consulting. */
function Briefcase({ brand, idPrefix, className }: IllustrationProps) {
  const p = idPrefix;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 480 480"
      className={className}
      aria-hidden
    >
      <defs>
        <BrandGradient id={`${p}case`} brand={brand} />
      </defs>
      {/* Handle */}
      <path
        d="M 180 140 L 180 110 C 180 96 192 84 206 84 L 274 84 C 288 84 300 96 300 110 L 300 140"
        stroke={brand.dark ?? '#0f172a'}
        strokeWidth="16"
        fill="none"
        strokeLinecap="round"
      />
      {/* Body */}
      <rect x="90" y="140" width="300" height="240" rx="20" fill={`url(#${p}case)`} />
      {/* Divider band */}
      <rect x="90" y="240" width="300" height="14" fill={brand.dark ?? '#0f172a'} opacity="0.3" />
      {/* Clasp */}
      <rect x="220" y="230" width="40" height="34" rx="4" fill={brand.pop ?? '#FFEC3D'} />
      <rect x="230" y="242" width="20" height="8" rx="2" fill={brand.dark ?? '#0f172a'} opacity="0.4" />
    </svg>
  );
}

/** Shopping bag — retail. */
function ShoppingBag({ brand, idPrefix, className }: IllustrationProps) {
  const p = idPrefix;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 480 480"
      className={className}
      aria-hidden
    >
      <defs>
        <BrandGradient id={`${p}bag`} brand={brand} vertical />
      </defs>
      {/* Handles */}
      <path
        d="M 165 170 C 165 110 205 80 240 80 C 275 80 315 110 315 170"
        stroke={brand.dark ?? '#0f172a'}
        strokeWidth="14"
        fill="none"
        strokeLinecap="round"
      />
      {/* Body */}
      <path
        d="M 90 160 L 390 160 L 370 420 C 369 432 360 440 348 440 L 132 440 C 120 440 111 432 110 420 Z"
        fill={`url(#${p}bag)`}
      />
      {/* Brand tag */}
      <rect x="200" y="240" width="80" height="60" rx="6" fill="white" opacity="0.95" />
      <line x1="214" y1="260" x2="266" y2="260" stroke={brand.primary} strokeWidth="4" strokeLinecap="round" />
      <line x1="214" y1="278" x2="248" y2="278" stroke={brand.primary} strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Dispatcher                                                          */
/* ------------------------------------------------------------------ */

const COMPONENTS: Record<
  HeroIllustrationStyle,
  (props: IllustrationProps) => React.ReactElement
> = {
  // Originals
  rocket: Rocket,
  wrench: Wrench,
  'coffee-cup': CoffeeCup,
  dumbbell: Dumbbell,
  scissors: Scissors,
  leaf: Leaf,
  house: House,
  tooth: Tooth,
  pencil: Pencil,
  gavel: Gavel,
  camera: Camera,
  car: Car,
  paw: Paw,
  briefcase: Briefcase,
  'shopping-bag': ShoppingBag,
  // Food & drink
  espresso: Espresso,
  croissant: Croissant,
  'pizza-slice': PizzaSlice,
  'wine-glass': WineGlass,
  cocktail: Cocktail,
  'ice-cream': IceCream,
  cupcake: Cupcake,
  'chef-hat': ChefHat,
  // Beauty
  'hair-dryer': HairDryer,
  lipstick: Lipstick,
  'nail-polish': NailPolish,
  candle: Candle,
  flower: Flower,
  // Fitness
  kettlebell: Kettlebell,
  'running-shoe': RunningShoe,
  'yoga-pose': YogaPose,
  // Medical
  stethoscope: Stethoscope,
  pill: Pill,
  'heart-pulse': HeartPulse,
  dna: Dna,
  // Home
  key: Key,
  couch: Couch,
  lamp: Lamp,
  // Trades
  hammer: Hammer,
  toolbox: Toolbox,
  'paint-brush': PaintBrush,
  gear: Gear,
  drill: Drill,
  // Automotive
  motorcycle: Motorcycle,
  'delivery-van': DeliveryVan,
  // Tech
  laptop: Laptop,
  atom: Atom,
  cpu: Cpu,
  // Retail
  'gift-box': GiftBox,
  diamond: Diamond,
  // Education
  book: Book,
  'graduation-cap': GraduationCap,
  apple: Apple,
  // Creative
  palette: Palette,
  'film-reel': FilmReel,
  'music-note': MusicNote,
  // Nature
  tree: Tree,
  mountain: Mountain,
  sun: Sun,
  wave: Wave,
  // Abstract
  orb: Orb,
  'cube-iso': CubeIso,
  prism: Prism,
  spiral: Spiral,
};

/**
 * Pick the SVG component for a given style. Falls back to the rocket
 * when the id is unknown — better than rendering nothing.
 */
export function IllustrationSvg({
  style,
  brand,
  idPrefix,
  className,
}: {
  style: HeroIllustrationStyle;
  brand: BrandPalette;
  idPrefix: string;
  className?: string;
}) {
  const Component = COMPONENTS[style] ?? Rocket;
  return <Component brand={brand} idPrefix={idPrefix} className={className} />;
}
