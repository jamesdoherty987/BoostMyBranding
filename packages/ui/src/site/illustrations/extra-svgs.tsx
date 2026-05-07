'use client';

/**
 * Extended illustration library. Each component is hand-crafted for a
 * specific industry with attention to:
 *
 *   - Readable silhouette at 200–560px wide.
 *   - Soft highlight + contact shadow so shapes feel dimensional.
 *   - Brand-palette tinting so illustrations stay on-brand automatically.
 *   - A single dominant subject with room to breathe for motion.
 *
 * All components take the same `IllustrationProps` as the originals so
 * they plug into the dispatcher without ceremony. Gradient ids are
 * prefixed with `idPrefix` to avoid collisions when multiple hero
 * illustrations live on the same page.
 */

import type { BrandPalette, IllustrationProps } from './svg-types';

/* ------------------------------------------------------------------ */
/* Shared helpers — gradient + highlight primitives                    */
/* ------------------------------------------------------------------ */

/** Three-stop brand gradient: primary → accent → pop. */
function BrandGradient({
  id,
  brand,
  vertical = false,
  reverse = false,
}: {
  id: string;
  brand: BrandPalette;
  vertical?: boolean;
  reverse?: boolean;
}) {
  const pop = brand.pop ?? brand.accent;
  const stops = reverse
    ? [pop, brand.accent, brand.primary]
    : [brand.primary, brand.accent, pop];
  return (
    <linearGradient
      id={id}
      x1="0"
      y1="0"
      x2={vertical ? '0' : '1'}
      y2={vertical ? '1' : '0'}
    >
      <stop offset="0" stopColor={stops[0]} />
      <stop offset="0.6" stopColor={stops[1]} />
      <stop offset="1" stopColor={stops[2]} />
    </linearGradient>
  );
}

/** Soft radial "glossy sphere" highlight — place on top-left of round
 *  objects to imply a light source. Returns a <radialGradient>. */
function Shine({ id }: { id: string }) {
  return (
    <radialGradient id={id} cx="0.3" cy="0.25" r="0.8">
      <stop offset="0" stopColor="#ffffff" stopOpacity="0.85" />
      <stop offset="0.35" stopColor="#ffffff" stopOpacity="0.2" />
      <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
    </radialGradient>
  );
}

/** Soft radial bottom shadow — wraps the subject in a cushion so it
 *  doesn't look like it's floating detached. */
function SoftShadow({ id }: { id: string }) {
  return (
    <radialGradient id={id} cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stopColor="#0f172a" stopOpacity="0.35" />
      <stop offset="1" stopColor="#0f172a" stopOpacity="0" />
    </radialGradient>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  FOOD & DRINK                                                        */
/* ═══════════════════════════════════════════════════════════════════ */

export function Espresso({ brand, idPrefix: p, className }: IllustrationProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480" className={className} aria-hidden>
      <defs>
        <BrandGradient id={`${p}cup`} brand={brand} />
        <linearGradient id={`${p}cupSide`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.25" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="1" stopColor="#0f172a" stopOpacity="0.18" />
        </linearGradient>
        <radialGradient id={`${p}crema`} cx="0.5" cy="0.25" r="0.75">
          <stop offset="0" stopColor="#e6a871" />
          <stop offset="0.6" stopColor="#9c5a1f" />
          <stop offset="1" stopColor="#4d2b12" />
        </radialGradient>
        <SoftShadow id={`${p}sh`} />
      </defs>
      {/* Contact shadow */}
      <ellipse cx="240" cy="420" rx="170" ry="18" fill={`url(#${p}sh)`} />
      {/* Saucer — angled ellipse for dimension */}
      <ellipse cx="240" cy="405" rx="170" ry="22" fill={brand.accent} opacity="0.35" />
      <ellipse cx="240" cy="398" rx="160" ry="20" fill={`url(#${p}cup)`} />
      {/* Steam ribbons — three, each with a subtle curve + fade */}
      <path d="M 216 108 Q 200 78 216 48 Q 232 78 216 108" fill={brand.primary} opacity="0.35" />
      <path d="M 260 118 Q 276 88 260 58 Q 244 88 260 118" fill={brand.accent} opacity="0.45" />
      <path d="M 300 108 Q 284 78 300 48 Q 316 78 300 108" fill={brand.primary} opacity="0.3" />
      {/* Cup body — tapered demitasse */}
      <path
        d="M 162 180 Q 168 330 192 354 Q 220 372 258 372 Q 296 372 316 356 Q 340 334 346 180 Z"
        fill={`url(#${p}cup)`}
      />
      {/* Cup rim highlight */}
      <ellipse cx="254" cy="184" rx="92" ry="10" fill="#ffffff" opacity="0.25" />
      {/* Side specular */}
      <path
        d="M 178 200 Q 190 300 212 344"
        stroke="#ffffff"
        strokeWidth="8"
        strokeLinecap="round"
        fill="none"
        opacity="0.35"
      />
      {/* Crema surface */}
      <ellipse cx="254" cy="186" rx="82" ry="10" fill={`url(#${p}crema)`} />
      <ellipse cx="254" cy="184" rx="60" ry="6" fill="#c08a4e" opacity="0.6" />
      <ellipse cx="240" cy="180" rx="14" ry="3" fill="#f8d9b4" opacity="0.7" />
      {/* Handle */}
      <path
        d="M 346 218 C 398 228 398 300 346 310"
        stroke={brand.primary}
        strokeWidth="18"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M 350 222 C 394 232 394 296 350 306"
        stroke="#ffffff"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
        opacity="0.35"
      />
      {/* Body sheen overlay */}
      <path
        d="M 162 180 Q 168 330 192 354 Q 220 372 258 372 Q 296 372 316 356 Q 340 334 346 180 Z"
        fill={`url(#${p}cupSide)`}
      />
    </svg>
  );
}

export function Croissant({ brand, idPrefix: p, className }: IllustrationProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${p}c`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fdc988" />
          <stop offset="0.5" stopColor="#e08a0a" />
          <stop offset="1" stopColor="#7c3f00" />
        </linearGradient>
        <linearGradient id={`${p}gloss`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff3d6" stopOpacity="0.9" />
          <stop offset="1" stopColor="#fff3d6" stopOpacity="0" />
        </linearGradient>
        <BrandGradient id={`${p}plate`} brand={brand} />
        <SoftShadow id={`${p}sh`} />
      </defs>
      <ellipse cx="240" cy="400" rx="190" ry="18" fill={`url(#${p}sh)`} />
      <ellipse cx="240" cy="395" rx="180" ry="14" fill={`url(#${p}plate)`} opacity="0.2" />
      {/* Croissant body — a wider, more realistic crescent with 5 segments */}
      <path
        d="M 72 276 Q 76 174 168 126 Q 236 104 304 126 Q 404 174 408 276 Q 380 298 344 286 Q 324 270 308 258 Q 288 290 268 292 Q 248 294 232 286 Q 212 270 200 258 Q 180 290 160 292 Q 140 294 124 286 Q 108 272 96 268 Q 80 274 72 276 Z"
        fill={`url(#${p}c)`}
      />
      {/* Segment folds — darker lines */}
      <path
        d="M 132 260 Q 170 190 220 178 M 224 142 Q 236 240 248 262 M 308 258 Q 274 188 238 172"
        stroke="#7f3e00"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
        opacity="0.65"
      />
      {/* Flake highlights — short strokes along the top edges */}
      <path
        d="M 110 232 Q 140 190 170 184 M 200 184 Q 230 168 260 168 M 298 184 Q 330 192 360 228"
        stroke="#fff3d6"
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
        opacity="0.7"
      />
      {/* Butter sheen */}
      <path
        d="M 120 226 Q 190 150 260 146 Q 330 150 380 220"
        fill={`url(#${p}gloss)`}
      />
      {/* Crumbs on plate */}
      <circle cx="100" cy="390" r="3" fill="#c57b2e" />
      <circle cx="400" cy="390" r="4" fill="#a76720" />
      <circle cx="380" cy="398" r="2.5" fill="#e08a0a" />
    </svg>
  );
}

export function PizzaSlice({ brand, idPrefix: p, className }: IllustrationProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${p}crust`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d9a15e" />
          <stop offset="1" stopColor="#8a5418" />
        </linearGradient>
        <linearGradient id={`${p}cheese`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe48a" />
          <stop offset="0.6" stopColor="#f4b851" />
          <stop offset="1" stopColor="#d88d25" />
        </linearGradient>
        <BrandGradient id={`${p}pep`} brand={brand} />
        <SoftShadow id={`${p}sh`} />
      </defs>
      <ellipse cx="240" cy="430" rx="190" ry="14" fill={`url(#${p}sh)`} />
      <g transform="translate(240 240) rotate(8) translate(-240 -240)">
        {/* Crust outer */}
        <path d="M 100 430 Q 240 440 380 430 L 240 60 Z" fill={`url(#${p}crust)`} />
        {/* Cheese layer */}
        <path d="M 128 418 Q 240 428 352 418 L 240 100 Z" fill={`url(#${p}cheese)`} />
        {/* Cheese drip edge */}
        <path
          d="M 128 418 Q 180 410 200 418 Q 240 410 260 418 Q 300 410 352 418"
          stroke="#fff5c4"
          strokeWidth="6"
          fill="none"
          strokeLinecap="round"
          opacity="0.75"
        />
        {/* Pepperoni (rotated ellipse gives a 3D lean) */}
        <ellipse cx="220" cy="240" rx="30" ry="26" fill={`url(#${p}pep)`} transform="rotate(-8 220 240)" />
        <ellipse cx="218" cy="236" rx="14" ry="8" fill="#ffffff" opacity="0.35" />
        <ellipse cx="288" cy="340" rx="30" ry="26" fill={`url(#${p}pep)`} transform="rotate(15 288 340)" />
        <ellipse cx="286" cy="336" rx="14" ry="8" fill="#ffffff" opacity="0.3" />
        <ellipse cx="178" cy="352" rx="22" ry="18" fill={`url(#${p}pep)`} transform="rotate(-5 178 352)" />
        <ellipse cx="240" cy="168" rx="20" ry="16" fill={`url(#${p}pep)`} transform="rotate(10 240 168)" />
        {/* Basil leaves */}
        <path d="M 180 260 Q 165 270 175 290 Q 195 278 180 260 Z" fill="#2f7d2f" />
        <path d="M 300 220 Q 285 232 296 250 Q 314 240 300 220 Z" fill="#3e9b3e" />
        {/* Grease specks */}
        <circle cx="160" cy="310" r="3" fill="#fff5c4" opacity="0.7" />
        <circle cx="260" cy="290" r="2" fill="#fff5c4" opacity="0.8" />
        <circle cx="320" cy="260" r="2.5" fill="#fff5c4" opacity="0.7" />
      </g>
    </svg>
  );
}

export function WineGlass({ brand, idPrefix: p, className }: IllustrationProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 480" className={className} aria-hidden>
      <defs>
        <BrandGradient id={`${p}wine`} brand={brand} vertical />
        <linearGradient id={`${p}glass`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.05" />
          <stop offset="1" stopColor="#94a3b8" stopOpacity="0.3" />
        </linearGradient>
        <linearGradient id={`${p}stem`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#d1d5db" />
          <stop offset="0.5" stopColor="#ffffff" />
          <stop offset="1" stopColor="#94a3b8" />
        </linearGradient>
        <SoftShadow id={`${p}sh`} />
      </defs>
      <ellipse cx="160" cy="455" rx="110" ry="12" fill={`url(#${p}sh)`} />
      {/* Bowl outline */}
      <path
        d="M 50 80 L 270 80 L 250 250 Q 236 300 160 302 Q 84 300 70 250 Z"
        fill="#ffffff"
        fillOpacity="0.08"
        stroke="#cbd5e1"
        strokeWidth="3"
      />
      {/* Wine fill */}
      <path
        d="M 74 170 L 246 170 L 240 246 Q 226 292 160 294 Q 94 292 80 246 Z"
        fill={`url(#${p}wine)`}
      />
      {/* Surface meniscus */}
      <ellipse cx="160" cy="170" rx="86" ry="8" fill={brand.pop ?? '#FFEC3D'} opacity="0.2" />
      <path
        d="M 74 170 Q 120 164 160 165 Q 200 166 246 170"
        stroke="#ffffff"
        strokeWidth="2"
        fill="none"
        opacity="0.6"
      />
      {/* Glass specular sheen */}
      <path
        d="M 50 80 L 270 80 L 250 250 Q 236 300 160 302 Q 84 300 70 250 Z"
        fill={`url(#${p}glass)`}
      />
      <path
        d="M 86 100 Q 80 200 100 270"
        stroke="#ffffff"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
        opacity="0.45"
      />
      {/* Stem */}
      <rect x="150" y="302" width="20" height="130" rx="2" fill={`url(#${p}stem)`} />
      {/* Foot */}
      <ellipse cx="160" cy="440" rx="100" ry="10" fill="#cbd5e1" />
      <ellipse cx="160" cy="437" rx="86" ry="6" fill="#ffffff" opacity="0.5" />
    </svg>
  );
}

export function Cocktail({ brand, idPrefix: p, className }: IllustrationProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480" className={className} aria-hidden>
      <defs>
        <BrandGradient id={`${p}liq`} brand={brand} vertical />
        <linearGradient id={`${p}glass`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.05" />
          <stop offset="1" stopColor="#94a3b8" stopOpacity="0.3" />
        </linearGradient>
        <SoftShadow id={`${p}sh`} />
      </defs>
      <ellipse cx="240" cy="450" rx="140" ry="14" fill={`url(#${p}sh)`} />
      {/* Cherry stem */}
      <path d="M 340 74 Q 360 120 338 180" stroke="#15803d" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M 340 74 Q 352 78 358 72" stroke="#15803d" strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* Cherry */}
      <circle cx="336" cy="188" r="18" fill="#b91c1c" />
      <circle cx="336" cy="188" r="18" fill="#dc2626" opacity="0.85" />
      <circle cx="330" cy="182" r="5" fill="#fecaca" opacity="0.8" />
      {/* Glass outline */}
      <path d="M 80 140 L 400 140 L 240 308 Z" fill="#ffffff" fillOpacity="0.08" stroke="#cbd5e1" strokeWidth="3" />
      {/* Liquid */}
      <path d="M 110 158 L 370 158 L 240 294 Z" fill={`url(#${p}liq)`} />
      {/* Surface */}
      <path d="M 110 158 L 370 158" stroke="#ffffff" strokeWidth="2" opacity="0.6" />
      <ellipse cx="240" cy="158" rx="130" ry="4" fill={brand.pop ?? '#FFEC3D'} opacity="0.4" />
      {/* Ice cube */}
      <rect x="190" y="168" width="36" height="36" rx="4" fill="#ffffff" opacity="0.55" transform="rotate(-10 208 186)" />
      <rect x="194" y="172" width="14" height="4" fill="#ffffff" opacity="0.8" transform="rotate(-10 208 186)" />
      <rect x="232" y="176" width="30" height="30" rx="4" fill="#ffffff" opacity="0.4" transform="rotate(14 247 191)" />
      {/* Glass sheen */}
      <path d="M 80 140 L 400 140 L 240 308 Z" fill={`url(#${p}glass)`} />
      <path d="M 110 160 L 200 280" stroke="#ffffff" strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.5" />
      {/* Stem */}
      <rect x="230" y="308" width="20" height="112" rx="2" fill="#cbd5e1" />
      {/* Base */}
      <ellipse cx="240" cy="428" rx="96" ry="10" fill="#94a3b8" />
      <ellipse cx="240" cy="425" rx="82" ry="6" fill="#ffffff" opacity="0.45" />
      {/* Straw */}
      <g transform="rotate(10 290 160)">
        <rect x="284" y="90" width="12" height="160" rx="5" fill={brand.pop ?? '#FFEC3D'} />
        <rect x="287" y="90" width="4" height="160" fill="#ffffff" opacity="0.35" />
      </g>
    </svg>
  );
}

export function IceCream({ brand, idPrefix: p, className }: IllustrationProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 480" className={className} aria-hidden>
      <defs>
        <radialGradient id={`${p}s1`} cx="0.35" cy="0.3" r="0.75">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.8" />
          <stop offset="0.4" stopColor={brand.primary} stopOpacity="0" />
        </radialGradient>
        <BrandGradient id={`${p}scoop`} brand={brand} />
        <linearGradient id={`${p}cone`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f6cc7a" />
          <stop offset="0.5" stopColor="#d39235" />
          <stop offset="1" stopColor="#7c4a10" />
        </linearGradient>
        <SoftShadow id={`${p}sh`} />
      </defs>
      <ellipse cx="180" cy="460" rx="130" ry="10" fill={`url(#${p}sh)`} />
      {/* Bottom scoop */}
      <circle cx="180" cy="200" r="90" fill={`url(#${p}scoop)`} />
      <circle cx="180" cy="200" r="90" fill={`url(#${p}s1)`} />
      {/* Middle scoop */}
      <circle cx="144" cy="138" r="70" fill={brand.accent} />
      <circle cx="130" cy="120" r="14" fill="#ffffff" opacity="0.55" />
      {/* Top scoop */}
      <circle cx="206" cy="82" r="54" fill={brand.pop ?? '#FFEC3D'} />
      <circle cx="192" cy="68" r="12" fill="#ffffff" opacity="0.65" />
      {/* Drips */}
      <path
        d="M 102 258 Q 96 296 114 316"
        stroke={`url(#${p}scoop)`}
        strokeWidth="16"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M 258 256 Q 266 284 250 308"
        stroke={brand.accent}
        strokeWidth="12"
        fill="none"
        strokeLinecap="round"
        opacity="0.9"
      />
      {/* Sprinkles */}
      <rect x="166" y="142" width="4" height="10" rx="2" fill="#f43f5e" transform="rotate(20 168 147)" />
      <rect x="190" y="128" width="4" height="10" rx="2" fill="#22d3ee" transform="rotate(-15 192 133)" />
      <rect x="210" y="150" width="4" height="10" rx="2" fill="#a855f7" transform="rotate(40 212 155)" />
      <rect x="152" y="168" width="4" height="10" rx="2" fill="#facc15" transform="rotate(-20 154 173)" />
      {/* Cherry with a stem on top */}
      <path d="M 206 32 Q 216 20 232 22" stroke="#15803d" strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="204" cy="40" r="10" fill="#dc2626" />
      <circle cx="201" cy="37" r="3" fill="#fecaca" opacity="0.9" />
      {/* Cone */}
      <path d="M 96 270 L 264 270 L 180 468 Z" fill={`url(#${p}cone)`} />
      {/* Waffle grid */}
      <g stroke="#5c3410" strokeWidth="3" opacity="0.55">
        <line x1="112" y1="292" x2="248" y2="292" />
        <line x1="122" y1="322" x2="238" y2="322" />
        <line x1="134" y1="352" x2="226" y2="352" />
        <line x1="148" y1="382" x2="212" y2="382" />
        <line x1="162" y1="412" x2="198" y2="412" />
      </g>
      <g stroke="#5c3410" strokeWidth="3" opacity="0.55">
        <line x1="124" y1="270" x2="180" y2="468" />
        <line x1="156" y1="270" x2="180" y2="468" />
        <line x1="204" y1="270" x2="180" y2="468" />
        <line x1="236" y1="270" x2="180" y2="468" />
      </g>
      {/* Cone rim highlight */}
      <path d="M 96 270 L 264 270" stroke="#fff3d6" strokeWidth="4" strokeLinecap="round" opacity="0.8" />
    </svg>
  );
}

export function Cupcake({ brand, idPrefix: p, className }: IllustrationProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480" className={className} aria-hidden>
      <defs>
        <BrandGradient id={`${p}frost`} brand={brand} />
        <radialGradient id={`${p}frostGloss`} cx="0.35" cy="0.25" r="0.65">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.8" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${p}wrap`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ef4444" />
          <stop offset="0.6" stopColor="#b91c1c" />
          <stop offset="1" stopColor="#7f1d1d" />
        </linearGradient>
        <SoftShadow id={`${p}sh`} />
      </defs>
      <ellipse cx="240" cy="440" rx="130" ry="12" fill={`url(#${p}sh)`} />
      {/* Wrapper */}
      <path d="M 128 272 L 352 272 L 328 424 Q 326 434 316 434 L 164 434 Q 154 434 152 424 Z" fill={`url(#${p}wrap)`} />
      {/* Wrapper rib shadows */}
      <path
        d="M 170 272 L 158 426 M 210 272 L 204 432 M 250 272 L 250 434 M 290 272 L 296 432 M 330 272 L 342 426"
        stroke="#5f0f0f"
        strokeWidth="4"
        opacity="0.5"
        strokeLinecap="round"
      />
      {/* Wrapper highlight */}
      <path d="M 134 274 L 350 274" stroke="#ffffff" strokeWidth="3" opacity="0.45" strokeLinecap="round" />
      {/* Frosting — swirled */}
      <path
        d="M 124 276 Q 120 226 148 200 Q 180 174 216 172 Q 240 156 264 172 Q 300 174 332 200 Q 360 226 356 276 Z"
        fill={`url(#${p}frost)`}
      />
      <path
        d="M 140 244 Q 180 210 222 202 Q 260 196 298 210 Q 332 224 344 252"
        stroke="#ffffff"
        strokeWidth="4"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M 170 222 Q 210 192 244 186 Q 280 188 314 208"
        stroke="#ffffff"
        strokeWidth="3"
        fill="none"
        opacity="0.4"
      />
      <path
        d="M 124 276 Q 120 226 148 200 Q 180 174 216 172 Q 240 156 264 172 Q 300 174 332 200 Q 360 226 356 276 Z"
        fill={`url(#${p}frostGloss)`}
      />
      {/* Cherry */}
      <path d="M 240 156 Q 256 138 252 118" stroke="#15803d" strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="240" cy="148" r="22" fill="#b91c1c" />
      <circle cx="240" cy="148" r="22" fill="#dc2626" opacity="0.85" />
      <circle cx="232" cy="140" r="6" fill="#fecaca" opacity="0.85" />
    </svg>
  );
}

export function ChefHat({ brand, idPrefix: p, className }: IllustrationProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480" className={className} aria-hidden>
      <defs>
        <BrandGradient id={`${p}band`} brand={brand} />
        <radialGradient id={`${p}puff`} cx="0.5" cy="0.4" r="0.6">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#dfe4e8" />
        </radialGradient>
        <SoftShadow id={`${p}sh`} />
      </defs>
      <ellipse cx="240" cy="400" rx="170" ry="12" fill={`url(#${p}sh)`} />
      {/* Puffy top — overlapping circles for a soft marshmallow shape */}
      <circle cx="160" cy="188" r="72" fill={`url(#${p}puff)`} />
      <circle cx="240" cy="156" r="82" fill={`url(#${p}puff)`} />
      <circle cx="324" cy="188" r="72" fill={`url(#${p}puff)`} />
      <circle cx="200" cy="212" r="60" fill={`url(#${p}puff)`} />
      <circle cx="288" cy="212" r="60" fill={`url(#${p}puff)`} />
      {/* Base pleated band */}
      <rect x="110" y="246" width="260" height="120" rx="10" fill={`url(#${p}puff)`} stroke="#d4d7db" strokeWidth="2" />
      {/* Pleat shadow lines */}
      <g stroke="#cfd3d8" strokeWidth="2" opacity="0.7">
        <line x1="146" y1="246" x2="146" y2="366" />
        <line x1="196" y1="246" x2="196" y2="366" />
        <line x1="246" y1="246" x2="246" y2="366" />
        <line x1="296" y1="246" x2="296" y2="366" />
        <line x1="346" y1="246" x2="346" y2="366" />
      </g>
      {/* Brand ribbon across the band */}
      <rect x="110" y="298" width="260" height="28" fill={`url(#${p}band)`} />
      <rect x="110" y="298" width="260" height="3" fill="#ffffff" opacity="0.45" />
      <rect x="110" y="323" width="260" height="3" fill="#0f172a" opacity="0.2" />
      {/* Top highlights */}
      <ellipse cx="212" cy="130" rx="22" ry="8" fill="#ffffff" opacity="0.85" />
      <ellipse cx="286" cy="174" rx="16" ry="6" fill="#ffffff" opacity="0.8" />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  BEAUTY & WELLNESS                                                   */
/* ═══════════════════════════════════════════════════════════════════ */

export function HairDryer({ brand, idPrefix: p, className }: IllustrationProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480" className={className} aria-hidden>
      <defs>
        <BrandGradient id={`${p}d`} brand={brand} />
        <linearGradient id={`${p}body`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={brand.accent} />
          <stop offset="0.5" stopColor={brand.primary} />
          <stop offset="1" stopColor={brand.dark ?? '#0f172a'} />
        </linearGradient>
        <SoftShadow id={`${p}sh`} />
      </defs>
      <ellipse cx="240" cy="450" rx="120" ry="10" fill={`url(#${p}sh)`} />
      <g transform="translate(240 240) rotate(-25) translate(-240 -240)">
        {/* Barrel */}
        <rect x="120" y="158" width="220" height="142" rx="44" fill={`url(#${p}body)`} />
        <rect x="120" y="162" width="220" height="12" rx="6" fill="#ffffff" opacity="0.25" />
        <rect x="120" y="284" width="220" height="10" rx="5" fill="#0f172a" opacity="0.25" />
        {/* Nozzle cone */}
        <path d="M 338 178 L 428 194 L 428 264 L 338 280 Z" fill={`url(#${p}body)`} />
        <path d="M 336 178 L 428 194 L 428 206 L 336 194 Z" fill="#ffffff" opacity="0.2" />
        {/* Back filter plate */}
        <circle cx="122" cy="230" r="36" fill={brand.dark ?? '#0f172a'} />
        <circle cx="122" cy="230" r="22" fill={brand.dark ?? '#0f172a'} />
        <g stroke="#ffffff" strokeWidth="2" opacity="0.45">
          <circle cx="122" cy="230" r="10" fill="none" />
          <circle cx="122" cy="230" r="18" fill="none" />
        </g>
        {/* Handle */}
        <rect x="176" y="300" width="66" height="160" rx="16" fill={brand.dark ?? '#0f172a'} />
        <rect x="180" y="306" width="10" height="148" fill="#ffffff" opacity="0.15" />
        {/* Speed dial markers */}
        <rect x="188" y="320" width="42" height="5" rx="2" fill={brand.pop ?? '#FFEC3D'} />
        <rect x="188" y="335" width="42" height="5" rx="2" fill={brand.pop ?? '#FFEC3D'} opacity="0.7" />
        <rect x="188" y="350" width="42" height="5" rx="2" fill={brand.pop ?? '#FFEC3D'} opacity="0.4" />
        {/* Cord */}
        <path
          d="M 208 460 Q 236 478 196 490 Q 160 498 200 504"
          stroke="#1e293b"
          strokeWidth="6"
          fill="none"
          strokeLinecap="round"
        />
      </g>
      {/* Airflow lines */}
      <g stroke={brand.accent} strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.65">
        <path d="M 396 120 Q 440 102 468 110" />
        <path d="M 400 160 Q 448 154 474 166" />
        <path d="M 396 200 Q 442 204 470 222" />
      </g>
    </svg>
  );
}

export function Lipstick({ brand, idPrefix: p, className }: IllustrationProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 480" className={className} aria-hidden>
      <defs>
        <BrandGradient id={`${p}tube`} brand={brand} vertical />
        <linearGradient id={`${p}stick`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fb7185" />
          <stop offset="0.5" stopColor="#e11d48" />
          <stop offset="1" stopColor="#881337" />
        </linearGradient>
        <linearGradient id={`${p}tubeShine`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.3" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="1" stopColor="#0f172a" stopOpacity="0.25" />
        </linearGradient>
        <SoftShadow id={`${p}sh`} />
      </defs>
      <ellipse cx="120" cy="460" rx="70" ry="8" fill={`url(#${p}sh)`} />
      {/* Bullet tip — angled cut */}
      <path d="M 72 36 L 168 36 L 180 120 L 60 120 Z" fill={`url(#${p}stick)`} />
      <path d="M 72 36 L 168 36 L 150 66 L 90 66 Z" fill="#ffffff" opacity="0.2" />
      <ellipse cx="120" cy="36" rx="48" ry="12" fill="#f43f5e" />
      {/* Inner bevel */}
      <ellipse cx="120" cy="38" rx="34" ry="6" fill="#ffffff" opacity="0.45" />
      {/* Collar — ring between stick and tube */}
      <rect x="56" y="120" width="128" height="32" fill={brand.pop ?? '#FFEC3D'} />
      <rect x="56" y="120" width="128" height="6" fill="#ffffff" opacity="0.5" />
      <rect x="56" y="144" width="128" height="6" fill="#0f172a" opacity="0.25" />
      {/* Tube body */}
      <rect x="48" y="152" width="144" height="288" rx="8" fill={`url(#${p}tube)`} />
      <rect x="48" y="152" width="144" height="288" rx="8" fill={`url(#${p}tubeShine)`} />
      {/* Brand monogram */}
      <circle cx="120" cy="296" r="22" fill="#ffffff" opacity="0.9" />
      <text x="120" y="304" textAnchor="middle" fontSize="22" fontWeight="700" fill={brand.primary} fontFamily="system-ui, sans-serif">
        B
      </text>
    </svg>
  );
}

export function NailPolish({ brand, idPrefix: p, className }: IllustrationProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 480" className={className} aria-hidden>
      <defs>
        <BrandGradient id={`${p}liq`} brand={brand} vertical />
        <linearGradient id={`${p}glass`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.25" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.02" />
          <stop offset="1" stopColor="#0f172a" stopOpacity="0.2" />
        </linearGradient>
        <SoftShadow id={`${p}sh`} />
      </defs>
      <ellipse cx="160" cy="460" rx="100" ry="10" fill={`url(#${p}sh)`} />
      {/* Cap (rounded-rect) */}
      <rect x="110" y="36" width="100" height="132" rx="10" fill={brand.dark ?? '#0f172a'} />
      <rect x="110" y="44" width="100" height="6" fill="#ffffff" opacity="0.3" />
      <rect x="110" y="158" width="100" height="6" fill="#ffffff" opacity="0.1" />
      <rect x="114" y="40" width="6" height="124" fill="#ffffff" opacity="0.12" />
      {/* Cap ribbon */}
      <rect x="110" y="86" width="100" height="14" fill={brand.pop ?? '#FFEC3D'} />
      {/* Collar */}
      <rect x="122" y="168" width="76" height="18" fill="#94a3b8" />
      <rect x="122" y="168" width="76" height="4" fill="#ffffff" opacity="0.5" />
      {/* Bottle body — bowed hourglass */}
      <path
        d="M 70 188 L 250 188 L 244 232 L 256 252 L 256 420 Q 256 438 238 438 L 82 438 Q 64 438 64 420 L 64 252 L 76 232 Z"
        fill="#f1f5f9"
        stroke="#cbd5e1"
        strokeWidth="2"
      />
      {/* Polish fill */}
      <path
        d="M 80 208 L 240 208 L 236 232 L 248 252 L 248 420 Q 248 430 238 430 L 82 430 Q 72 430 72 420 L 72 252 L 84 232 Z"
        fill={`url(#${p}liq)`}
      />
      {/* Surface highlight band */}
      <rect x="72" y="252" width="176" height="4" fill="#ffffff" opacity="0.35" />
      {/* Vertical sheen */}
      <rect x="94" y="220" width="14" height="200" fill="#ffffff" opacity="0.25" />
      {/* Glass overlay */}
      <path
        d="M 70 188 L 250 188 L 244 232 L 256 252 L 256 420 Q 256 438 238 438 L 82 438 Q 64 438 64 420 L 64 252 L 76 232 Z"
        fill={`url(#${p}glass)`}
      />
      {/* Label */}
      <rect x="108" y="316" width="104" height="52" rx="4" fill="#ffffff" opacity="0.92" />
      <line x1="122" y1="336" x2="198" y2="336" stroke={brand.primary} strokeWidth="3" strokeLinecap="round" />
      <line x1="122" y1="352" x2="174" y2="352" stroke={brand.primary} strokeWidth="3" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

export function Candle({ brand, idPrefix: p, className }: IllustrationProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 480" className={className} aria-hidden>
      <defs>
        <BrandGradient id={`${p}wax`} brand={brand} vertical />
        <radialGradient id={`${p}flame`} cx="0.5" cy="0.6" r="0.6">
          <stop offset="0" stopColor="#fef9c3" />
          <stop offset="0.3" stopColor="#fbbf24" />
          <stop offset="0.7" stopColor="#f97316" stopOpacity="0.8" />
          <stop offset="1" stopColor="#ea580c" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${p}glow`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fbbf24" stopOpacity="0.45" />
          <stop offset="1" stopColor="#fbbf24" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${p}jar`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#e0e7ff" stopOpacity="0.3" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.15" />
          <stop offset="1" stopColor="#0f172a" stopOpacity="0.2" />
        </linearGradient>
        <SoftShadow id={`${p}sh`} />
      </defs>
      <ellipse cx="160" cy="460" rx="120" ry="10" fill={`url(#${p}sh)`} />
      {/* Glow halo around flame */}
      <ellipse cx="160" cy="100" rx="110" ry="80" fill={`url(#${p}glow)`} />
      {/* Flame — teardrop */}
      <path d="M 160 30 Q 140 90 160 148 Q 180 90 160 30 Z" fill={`url(#${p}flame)`} />
      <path d="M 160 60 Q 150 100 160 134 Q 170 100 160 60 Z" fill="#fef3c7" opacity="0.85" />
      {/* Wick */}
      <rect x="158" y="148" width="4" height="20" rx="1" fill="#1f2937" />
      {/* Jar */}
      <rect x="50" y="170" width="220" height="280" rx="18" fill="#f1f5f9" opacity="0.25" stroke="#cbd5e1" strokeWidth="3" />
      {/* Wax */}
      <rect x="72" y="196" width="176" height="234" rx="10" fill={`url(#${p}wax)`} />
      {/* Melted top pool */}
      <ellipse cx="160" cy="196" rx="88" ry="14" fill={brand.accent} opacity="0.75" />
      <ellipse cx="160" cy="192" rx="60" ry="6" fill="#ffffff" opacity="0.45" />
      {/* Label */}
      <rect x="100" y="290" width="120" height="90" rx="4" fill="#ffffff" opacity="0.92" />
      <line x1="118" y1="320" x2="202" y2="320" stroke={brand.primary} strokeWidth="3" strokeLinecap="round" />
      <line x1="118" y1="340" x2="178" y2="340" stroke={brand.primary} strokeWidth="3" strokeLinecap="round" opacity="0.6" />
      <line x1="118" y1="360" x2="188" y2="360" stroke={brand.primary} strokeWidth="3" strokeLinecap="round" opacity="0.4" />
      {/* Jar sheen */}
      <rect x="50" y="170" width="220" height="280" rx="18" fill={`url(#${p}jar)`} />
      <rect x="64" y="190" width="12" height="240" rx="2" fill="#ffffff" opacity="0.35" />
    </svg>
  );
}

export function Flower({ brand, idPrefix: p, className }: IllustrationProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480" className={className} aria-hidden>
      <defs>
        <radialGradient id={`${p}pet`} cx="0.5" cy="0.3" r="0.7">
          <stop offset="0" stopColor={brand.pop ?? '#FFEC3D'} />
          <stop offset="0.5" stopColor={brand.accent} />
          <stop offset="1" stopColor={brand.primary} />
        </radialGradient>
        <radialGradient id={`${p}centre`} cx="0.4" cy="0.4" r="0.6">
          <stop offset="0" stopColor="#fef3c7" />
          <stop offset="0.6" stopColor="#f59e0b" />
          <stop offset="1" stopColor="#78350f" />
        </radialGradient>
        <SoftShadow id={`${p}sh`} />
      </defs>
      <ellipse cx="240" cy="440" rx="110" ry="10" fill={`url(#${p}sh)`} />
      {/* Petals — 8 for fuller bloom, alternating sizes */}
      <g transform="translate(240 196)">
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
          <g key={angle} transform={`rotate(${angle})`}>
            <ellipse
              cx="0"
              cy="-74"
              rx={i % 2 === 0 ? 38 : 32}
              ry={i % 2 === 0 ? 72 : 64}
              fill={`url(#${p}pet)`}
            />
            <ellipse cx="-8" cy="-94" rx="8" ry="18" fill="#ffffff" opacity="0.35" />
          </g>
        ))}
      </g>
      {/* Seed centre with tiny specks */}
      <circle cx="240" cy="196" r="44" fill={`url(#${p}centre)`} />
      <g fill="#78350f">
        <circle cx="230" cy="188" r="3" />
        <circle cx="246" cy="184" r="3" />
        <circle cx="256" cy="196" r="3" />
        <circle cx="244" cy="208" r="3" />
        <circle cx="226" cy="204" r="3" />
        <circle cx="222" cy="192" r="2.5" />
      </g>
      {/* Stem with subtle curve */}
      <path d="M 238 240 Q 250 310 224 396" stroke="#15803d" strokeWidth="10" fill="none" strokeLinecap="round" />
      <path d="M 236 252 Q 246 310 226 390" stroke="#22c55e" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.6" />
      {/* Leaves */}
      <path d="M 236 326 Q 176 310 162 356 Q 212 372 238 344 Z" fill="#16a34a" />
      <path d="M 236 326 Q 176 310 162 356" stroke="#0e7d35" strokeWidth="2" fill="none" opacity="0.6" />
      <path d="M 232 372 Q 278 362 300 394 Q 262 406 234 386 Z" fill="#22c55e" />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  FITNESS                                                             */
/* ═══════════════════════════════════════════════════════════════════ */

export function Kettlebell({ brand, idPrefix: p, className }: IllustrationProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480" className={className} aria-hidden>
      <defs>
        <radialGradient id={`${p}ball`} cx="0.3" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#64748b" />
          <stop offset="0.5" stopColor={brand.primary} />
          <stop offset="1" stopColor={brand.dark ?? '#0f172a'} />
        </radialGradient>
        <BrandGradient id={`${p}grip`} brand={brand} />
        <SoftShadow id={`${p}sh`} />
      </defs>
      <ellipse cx="240" cy="460" rx="160" ry="14" fill={`url(#${p}sh)`} />
      {/* Handle loop */}
      <path
        d="M 174 140 C 174 92 212 66 240 66 C 268 66 306 92 306 140"
        stroke={brand.dark ?? '#0f172a'}
        strokeWidth="30"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M 180 138 C 180 100 214 78 240 78 C 266 78 300 100 300 138"
        stroke="#64748b"
        strokeWidth="10"
        fill="none"
        strokeLinecap="round"
        opacity="0.8"
      />
      {/* Saddle (connector between handle and bell) */}
      <path d="M 170 130 Q 180 165 192 180 L 288 180 Q 300 165 310 130 Z" fill={brand.dark ?? '#0f172a'} />
      <path d="M 192 148 Q 200 172 210 180 L 270 180 Q 280 172 288 148" stroke="#ffffff" strokeWidth="2" fill="none" opacity="0.35" />
      {/* Bell body */}
      <circle cx="240" cy="310" r="140" fill={`url(#${p}ball)`} />
      {/* Specular highlight */}
      <ellipse cx="192" cy="250" rx="36" ry="20" fill="#ffffff" opacity="0.45" />
      <ellipse cx="180" cy="238" rx="10" ry="6" fill="#ffffff" opacity="0.8" />
      {/* Weight stamp disc */}
      <circle cx="240" cy="340" r="50" fill="#ffffff" opacity="0.92" />
      <circle cx="240" cy="340" r="50" fill={`url(#${p}grip)`} opacity="0.12" />
      <text x="240" y="352" textAnchor="middle" fontSize="30" fontWeight="800" fill={brand.dark ?? '#0f172a'} fontFamily="system-ui, sans-serif">
        20
      </text>
      <text x="240" y="378" textAnchor="middle" fontSize="12" fontWeight="600" fill={brand.dark ?? '#0f172a'} fontFamily="system-ui, sans-serif" opacity="0.7">
        KG
      </text>
    </svg>
  );
}

export function RunningShoe({ brand, idPrefix: p, className }: IllustrationProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 360" className={className} aria-hidden>
      <defs>
        <BrandGradient id={`${p}upper`} brand={brand} />
        <linearGradient id={`${p}sole`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#64748b" />
          <stop offset="1" stopColor="#1f2937" />
        </linearGradient>
        <SoftShadow id={`${p}sh`} />
      </defs>
      <ellipse cx="240" cy="320" rx="210" ry="14" fill={`url(#${p}sh)`} />
      {/* Outer sole — tread */}
      <path
        d="M 40 260 Q 40 294 90 300 L 416 300 Q 462 296 460 268 L 460 250 L 40 250 Z"
        fill={`url(#${p}sole)`}
      />
      {/* Tread blocks */}
      <g fill="#111827">
        <rect x="60" y="286" width="20" height="14" rx="2" />
        <rect x="100" y="286" width="20" height="14" rx="2" />
        <rect x="140" y="286" width="20" height="14" rx="2" />
        <rect x="180" y="286" width="20" height="14" rx="2" />
        <rect x="220" y="286" width="20" height="14" rx="2" />
        <rect x="260" y="286" width="20" height="14" rx="2" />
        <rect x="300" y="286" width="20" height="14" rx="2" />
        <rect x="340" y="286" width="20" height="14" rx="2" />
        <rect x="380" y="286" width="20" height="14" rx="2" />
      </g>
      {/* Midsole cushion */}
      <path
        d="M 40 230 L 460 230 L 460 252 L 40 252 Z"
        fill="#ffffff"
      />
      <path
        d="M 40 248 L 460 248"
        stroke={brand.accent}
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.65"
      />
      {/* Heel counter */}
      <path d="M 44 208 Q 42 150 92 138 L 92 230 L 44 230 Z" fill={`url(#${p}upper)`} />
      {/* Upper main */}
      <path
        d="M 92 230 Q 90 130 140 110 Q 220 90 272 114 L 366 152 Q 430 178 462 228 Q 464 232 460 230 L 92 230 Z"
        fill={`url(#${p}upper)`}
      />
      {/* Toe cap */}
      <path d="M 400 190 Q 446 204 462 228" stroke="#ffffff" strokeWidth="6" fill="none" strokeLinecap="round" opacity="0.9" />
      {/* Logo stripe */}
      <path
        d="M 110 232 Q 220 156 400 188"
        stroke="#ffffff"
        strokeWidth="18"
        fill="none"
        strokeLinecap="round"
        opacity="0.85"
      />
      <path
        d="M 110 232 Q 220 156 400 188"
        stroke={brand.dark ?? '#0f172a'}
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
        opacity="0.25"
      />
      {/* Ankle collar */}
      <path d="M 92 130 Q 120 100 168 100 Q 196 102 208 114" stroke={brand.dark ?? '#0f172a'} strokeWidth="8" fill="none" strokeLinecap="round" />
      {/* Tongue */}
      <path d="M 138 118 Q 148 84 176 86 Q 200 90 202 122" fill={`url(#${p}upper)`} />
      {/* Laces */}
      <g stroke="#ffffff" strokeWidth="5" strokeLinecap="round" fill="none">
        <path d="M 138 138 Q 168 130 198 154" />
        <path d="M 138 162 Q 170 156 204 176" />
        <path d="M 138 186 Q 172 184 210 198" />
        <path d="M 138 208 Q 174 210 214 220" />
      </g>
      <g fill="#f8fafc">
        <circle cx="140" cy="138" r="3.5" />
        <circle cx="140" cy="162" r="3.5" />
        <circle cx="140" cy="186" r="3.5" />
        <circle cx="140" cy="208" r="3.5" />
      </g>
      {/* Motion lines */}
      <g stroke={brand.pop ?? '#FFEC3D'} strokeWidth="5" strokeLinecap="round" opacity="0.75">
        <line x1="-10" y1="220" x2="24" y2="220" />
        <line x1="-10" y1="244" x2="30" y2="244" />
        <line x1="-10" y1="268" x2="24" y2="268" />
      </g>
    </svg>
  );
}

export function YogaPose({ brand, idPrefix: p, className }: IllustrationProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480" className={className} aria-hidden>
      <defs>
        <BrandGradient id={`${p}y`} brand={brand} vertical />
        <radialGradient id={`${p}halo`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={brand.accent} stopOpacity="0.35" />
          <stop offset="1" stopColor={brand.accent} stopOpacity="0" />
        </radialGradient>
        <SoftShadow id={`${p}sh`} />
      </defs>
      <ellipse cx="240" cy="430" rx="160" ry="14" fill={`url(#${p}sh)`} />
      {/* Halo */}
      <circle cx="240" cy="230" r="200" fill={`url(#${p}halo)`} />
      {/* Concentric zen rings */}
      <circle cx="240" cy="230" r="170" stroke={brand.primary} strokeWidth="2" fill="none" opacity="0.2" />
      <circle cx="240" cy="230" r="130" stroke={brand.accent} strokeWidth="2" fill="none" opacity="0.25" />
      {/* Head */}
      <circle cx="240" cy="140" r="30" fill={brand.primary} />
      <circle cx="232" cy="134" r="6" fill="#ffffff" opacity="0.5" />
      {/* Neck */}
      <rect x="232" y="168" width="16" height="16" rx="6" fill={brand.primary} />
      {/* Torso silhouette — elongated oval for meditation */}
      <path
        d="M 240 184 C 268 192 286 220 284 248 C 282 278 268 296 248 298 L 232 298 C 212 296 198 278 196 248 C 194 220 212 192 240 184 Z"
        fill={`url(#${p}y)`}
      />
      {/* Shoulder highlight */}
      <path d="M 220 192 Q 210 210 204 236" stroke="#ffffff" strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.45" />
      {/* Crossed legs — triangular base */}
      <path
        d="M 164 320 Q 180 298 240 296 Q 300 298 316 320 Q 280 338 240 338 Q 200 338 164 320 Z"
        fill={`url(#${p}y)`}
        opacity="0.95"
      />
      <path
        d="M 150 366 Q 180 344 240 344 Q 300 344 330 366 Q 280 384 240 384 Q 200 384 150 366 Z"
        fill={brand.dark ?? '#0f172a'}
        opacity="0.85"
      />
      {/* Arms resting — mudra hands on knees */}
      <path
        d="M 206 250 Q 150 270 130 310 Q 158 312 192 298 Q 218 288 224 270"
        fill={brand.accent}
      />
      <path
        d="M 274 250 Q 330 270 350 310 Q 322 312 288 298 Q 262 288 256 270"
        fill={brand.accent}
      />
      {/* Hands (mudra) */}
      <circle cx="132" cy="312" r="12" fill={brand.primary} />
      <circle cx="348" cy="312" r="12" fill={brand.primary} />
      {/* Top energy point */}
      <circle cx="240" cy="106" r="6" fill={brand.pop ?? '#FFEC3D'} opacity="0.8" />
      <circle cx="240" cy="106" r="14" stroke={brand.pop ?? '#FFEC3D'} strokeWidth="2" fill="none" opacity="0.5" />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  MEDICAL                                                             */
/* ═══════════════════════════════════════════════════════════════════ */

export function Stethoscope({ brand, idPrefix: p, className }: IllustrationProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480" className={className} aria-hidden>
      <defs>
        <radialGradient id={`${p}bell`} cx="0.3" cy="0.3" r="0.7">
          <stop offset="0" stopColor="#f8fafc" />
          <stop offset="0.4" stopColor={brand.accent} />
          <stop offset="1" stopColor={brand.primary} />
        </radialGradient>
        <BrandGradient id={`${p}tube`} brand={brand} />
        <SoftShadow id={`${p}sh`} />
      </defs>
      <ellipse cx="240" cy="460" rx="120" ry="10" fill={`url(#${p}sh)`} />
      {/* Earpieces — angled tips */}
      <g transform="rotate(-20 132 90)">
        <rect x="112" y="72" width="40" height="40" rx="10" fill={brand.dark ?? '#0f172a'} />
        <rect x="118" y="78" width="28" height="8" rx="3" fill="#ffffff" opacity="0.3" />
      </g>
      <g transform="rotate(20 348 90)">
        <rect x="328" y="72" width="40" height="40" rx="10" fill={brand.dark ?? '#0f172a'} />
        <rect x="334" y="78" width="28" height="8" rx="3" fill="#ffffff" opacity="0.3" />
      </g>
      {/* Tubing — headset arc */}
      <path
        d="M 140 110 Q 108 180 130 250 Q 160 310 240 320"
        stroke={`url(#${p}tube)`}
        strokeWidth="16"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M 340 110 Q 372 180 350 250 Q 320 310 240 320"
        stroke={`url(#${p}tube)`}
        strokeWidth="16"
        fill="none"
        strokeLinecap="round"
      />
      {/* Tubing highlights */}
      <path d="M 144 116 Q 120 170 138 224" stroke="#ffffff" strokeWidth="3" fill="none" opacity="0.35" />
      <path d="M 336 116 Q 360 170 342 224" stroke="#ffffff" strokeWidth="3" fill="none" opacity="0.35" />
      {/* Tube stem into chest piece */}
      <rect x="228" y="296" width="24" height="60" rx="6" fill={brand.dark ?? '#0f172a'} />
      {/* Chest piece (diaphragm) */}
      <circle cx="240" cy="374" r="74" fill={brand.dark ?? '#0f172a'} />
      <circle cx="240" cy="374" r="60" fill={`url(#${p}bell)`} />
      <circle cx="240" cy="374" r="50" stroke="#0f172a" strokeWidth="2" fill="none" opacity="0.35" />
      {/* Diaphragm inner ring */}
      <circle cx="240" cy="374" r="40" fill={brand.dark ?? '#0f172a'} opacity="0.35" />
      {/* Specular highlight */}
      <ellipse cx="218" cy="354" rx="18" ry="10" fill="#ffffff" opacity="0.55" />
      <ellipse cx="212" cy="348" rx="5" ry="3" fill="#ffffff" opacity="0.9" />
      {/* Subtle heartbeat */}
      <path
        d="M 198 380 L 218 380 L 224 368 L 236 394 L 248 370 L 256 380 L 282 380"
        stroke={brand.pop ?? '#FFEC3D'}
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.9"
      />
    </svg>
  );
}

export function Pill({ brand, idPrefix: p, className }: IllustrationProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480" className={className} aria-hidden>
      <defs>
        <BrandGradient id={`${p}a`} brand={brand} />
        <linearGradient id={`${p}white`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#cbd5e1" />
        </linearGradient>
        <SoftShadow id={`${p}sh`} />
      </defs>
      <ellipse cx="240" cy="340" rx="200" ry="14" fill={`url(#${p}sh)`} />
      <g transform="translate(240 240) rotate(-25) translate(-240 -240)">
        {/* White half */}
        <rect x="80" y="196" width="180" height="92" rx="46" fill={`url(#${p}white)`} />
        {/* Coloured half */}
        <rect x="240" y="196" width="160" height="92" rx="46" fill={`url(#${p}a)`} />
        {/* Seam */}
        <rect x="236" y="196" width="8" height="92" fill={brand.dark ?? '#0f172a'} opacity="0.25" />
        {/* Specular highlights */}
        <rect x="96" y="204" width="150" height="14" rx="7" fill="#ffffff" opacity="0.6" />
        <rect x="246" y="204" width="140" height="14" rx="7" fill="#ffffff" opacity="0.35" />
        {/* Bottom shadows */}
        <rect x="96" y="268" width="150" height="10" rx="5" fill="#0f172a" opacity="0.12" />
        <rect x="246" y="268" width="140" height="10" rx="5" fill="#0f172a" opacity="0.25" />
        {/* Tiny monogram */}
        <text
          x="170"
          y="252"
          textAnchor="middle"
          fontSize="22"
          fontWeight="700"
          fill={brand.primary}
          fontFamily="system-ui, sans-serif"
        >
          Rx
        </text>
      </g>
    </svg>
  );
}

export function HeartPulse({ brand, idPrefix: p, className }: IllustrationProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480" className={className} aria-hidden>
      <defs>
        <radialGradient id={`${p}h`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#fb7185" />
          <stop offset="0.5" stopColor={brand.primary} />
          <stop offset="1" stopColor={brand.dark ?? '#0f172a'} />
        </radialGradient>
        <SoftShadow id={`${p}sh`} />
      </defs>
      <ellipse cx="240" cy="420" rx="170" ry="14" fill={`url(#${p}sh)`} />
      {/* Heart body — smoother bezier so the two lobes feel round */}
      <path
        d="M 240 400 C 170 354 60 270 60 178 C 60 120 110 76 164 76 C 202 76 228 100 240 126 C 252 100 278 76 316 76 C 370 76 420 120 420 178 C 420 270 310 354 240 400 Z"
        fill={`url(#${p}h)`}
      />
      {/* Left lobe specular */}
      <path
        d="M 126 124 C 112 142 108 170 116 196"
        stroke="#ffffff"
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
        opacity="0.45"
      />
      {/* Tiny top spots */}
      <circle cx="186" cy="118" r="6" fill="#ffffff" opacity="0.5" />
      {/* Pulse line — thicker, with end caps */}
      <path
        d="M 72 232 L 150 232 L 172 186 L 210 290 L 258 178 L 296 232 L 408 232"
        stroke="#ffffff"
        strokeWidth="10"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.95"
      />
      <circle cx="72" cy="232" r="5" fill="#ffffff" />
      <circle cx="408" cy="232" r="5" fill="#ffffff" />
    </svg>
  );
}

export function Dna({ brand, idPrefix: p, className }: IllustrationProps) {
  // 8 pairs of nodes along the helix; each pair is joined by a rung and
  // the nodes drift in X based on a sine wave for the double-helix feel.
  const pairs = 10;
  const width = 240;
  const height = 480;
  const amp = 70;
  const midX = width / 2;
  const stepY = height / (pairs + 1);

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden>
      <defs>
        <BrandGradient id={`${p}a`} brand={brand} vertical />
        <BrandGradient id={`${p}b`} brand={brand} vertical reverse />
        <SoftShadow id={`${p}sh`} />
      </defs>
      <ellipse cx={midX} cy={height - 12} rx="80" ry="8" fill={`url(#${p}sh)`} />
      {/* Rails — two sine curves 180° out of phase */}
      {(() => {
        const steps = 80;
        const leftPath: string[] = [];
        const rightPath: string[] = [];
        for (let i = 0; i <= steps; i += 1) {
          const y = (i / steps) * height;
          const phase = (i / steps) * Math.PI * 4;
          const lx = midX + Math.sin(phase) * amp;
          const rx = midX - Math.sin(phase) * amp;
          leftPath.push(`${i === 0 ? 'M' : 'L'} ${lx.toFixed(1)} ${y.toFixed(1)}`);
          rightPath.push(`${i === 0 ? 'M' : 'L'} ${rx.toFixed(1)} ${y.toFixed(1)}`);
        }
        return (
          <>
            <path d={leftPath.join(' ')} stroke={brand.primary} strokeWidth="6" fill="none" strokeLinecap="round" opacity="0.9" />
            <path d={rightPath.join(' ')} stroke={brand.accent} strokeWidth="6" fill="none" strokeLinecap="round" opacity="0.9" />
          </>
        );
      })()}
      {/* Rungs */}
      {Array.from({ length: pairs }).map((_, i) => {
        const y = (i + 1) * stepY;
        const phase = (y / height) * Math.PI * 4;
        const lx = midX + Math.sin(phase) * amp;
        const rx = midX - Math.sin(phase) * amp;
        // Thinner when rails cross each other, gives depth
        const opacity = 0.3 + 0.55 * Math.abs(Math.sin(phase));
        return (
          <g key={i}>
            <line x1={lx} y1={y} x2={rx} y2={y} stroke={brand.dark ?? '#0f172a'} strokeWidth="3" opacity={opacity} />
            <circle cx={lx} cy={y} r="9" fill={`url(#${p}a)`} />
            <circle cx={rx} cy={y} r="9" fill={`url(#${p}b)`} />
            <circle cx={lx - 3} cy={y - 3} r="3" fill="#ffffff" opacity="0.7" />
            <circle cx={rx - 3} cy={y - 3} r="3" fill="#ffffff" opacity="0.7" />
          </g>
        );
      })}
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  HOME                                                                */
/* ═══════════════════════════════════════════════════════════════════ */

export function Key({ brand, idPrefix: p, className }: IllustrationProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 360" className={className} aria-hidden>
      <defs>
        <BrandGradient id={`${p}k`} brand={brand} />
        <radialGradient id={`${p}metal`} cx="0.3" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.3" stopColor={brand.accent} />
          <stop offset="0.8" stopColor={brand.primary} />
          <stop offset="1" stopColor={brand.dark ?? '#0f172a'} />
        </radialGradient>
        <SoftShadow id={`${p}sh`} />
      </defs>
      <ellipse cx="240" cy="326" rx="180" ry="12" fill={`url(#${p}sh)`} />
      <g transform="translate(240 180) rotate(-10) translate(-240 -180)">
        {/* Bow (head) */}
        <circle cx="118" cy="180" r="76" fill={`url(#${p}metal)`} />
        <circle cx="118" cy="180" r="58" fill={brand.dark ?? '#0f172a'} opacity="0.25" />
        <circle cx="118" cy="180" r="36" fill={`url(#${p}k)`} />
        <circle cx="104" cy="166" r="10" fill="#ffffff" opacity="0.7" />
        {/* Bow decorative ring */}
        <circle cx="118" cy="180" r="72" stroke={brand.dark ?? '#0f172a'} strokeWidth="2" fill="none" opacity="0.35" />
        {/* Shaft */}
        <rect x="194" y="158" width="240" height="44" rx="6" fill={`url(#${p}metal)`} />
        <rect x="194" y="162" width="240" height="8" fill="#ffffff" opacity="0.55" />
        <rect x="194" y="192" width="240" height="8" fill="#0f172a" opacity="0.25" />
        {/* Teeth */}
        <rect x="326" y="202" width="22" height="34" rx="3" fill={`url(#${p}metal)`} />
        <rect x="360" y="202" width="22" height="22" rx="3" fill={`url(#${p}metal)`} />
        <rect x="394" y="202" width="22" height="36" rx="3" fill={`url(#${p}metal)`} />
        <rect x="326" y="200" width="22" height="4" fill="#ffffff" opacity="0.4" />
        <rect x="360" y="200" width="22" height="4" fill="#ffffff" opacity="0.4" />
        <rect x="394" y="200" width="22" height="4" fill="#ffffff" opacity="0.4" />
      </g>
      {/* Sparkle */}
      <g fill={brand.pop ?? '#FFEC3D'}>
        <path d="M 380 80 L 386 94 L 400 100 L 386 106 L 380 120 L 374 106 L 360 100 L 374 94 Z" opacity="0.9" />
      </g>
    </svg>
  );
}

export function Couch({ brand, idPrefix: p, className }: IllustrationProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 360" className={className} aria-hidden>
      <defs>
        <BrandGradient id={`${p}c`} brand={brand} />
        <linearGradient id={`${p}fabric`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={brand.accent} />
          <stop offset="1" stopColor={brand.primary} />
        </linearGradient>
        <SoftShadow id={`${p}sh`} />
      </defs>
      <ellipse cx="240" cy="330" rx="220" ry="10" fill={`url(#${p}sh)`} />
      {/* Back cushion */}
      <path
        d="M 56 116 Q 56 92 80 92 L 400 92 Q 424 92 424 116 L 422 214 Q 400 202 240 200 Q 80 202 58 214 Z"
        fill={`url(#${p}c)`}
      />
      {/* Back cushion seams */}
      <path d="M 140 108 L 140 206 M 240 108 L 240 204 M 340 108 L 340 206" stroke="#0f172a" strokeWidth="2" opacity="0.2" />
      {/* Back cushion highlights */}
      <path d="M 80 104 L 400 104" stroke="#ffffff" strokeWidth="3" opacity="0.35" />
      {/* Armrests */}
      <path d="M 20 146 Q 20 132 40 132 L 58 132 L 58 286 L 20 286 Z" fill={`url(#${p}c)`} />
      <path d="M 460 146 Q 460 132 440 132 L 422 132 L 422 286 L 460 286 Z" fill={`url(#${p}c)`} />
      <rect x="20" y="140" width="38" height="6" fill="#ffffff" opacity="0.3" />
      <rect x="422" y="140" width="38" height="6" fill="#ffffff" opacity="0.3" />
      {/* Seat cushions */}
      <rect x="58" y="196" width="168" height="110" rx="18" fill={`url(#${p}fabric)`} />
      <rect x="254" y="196" width="168" height="110" rx="18" fill={`url(#${p}fabric)`} />
      <rect x="58" y="200" width="168" height="10" fill="#ffffff" opacity="0.3" />
      <rect x="254" y="200" width="168" height="10" fill="#ffffff" opacity="0.3" />
      {/* Throw pillows */}
      <rect x="88" y="150" width="62" height="48" rx="10" fill={brand.pop ?? '#FFEC3D'} transform="rotate(-8 119 174)" />
      <rect x="330" y="148" width="58" height="56" rx="10" fill="#ffffff" opacity="0.9" transform="rotate(8 359 176)" />
      <line x1="336" y1="164" x2="378" y2="164" stroke={brand.primary} strokeWidth="3" strokeLinecap="round" opacity="0.7" transform="rotate(8 357 164)" />
      {/* Legs */}
      <rect x="58" y="306" width="20" height="22" fill={brand.dark ?? '#0f172a'} />
      <rect x="402" y="306" width="20" height="22" fill={brand.dark ?? '#0f172a'} />
    </svg>
  );
}

export function Lamp({ brand, idPrefix: p, className }: IllustrationProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 480" className={className} aria-hidden>
      <defs>
        <BrandGradient id={`${p}shade`} brand={brand} />
        <radialGradient id={`${p}glow`} cx="0.5" cy="0.8" r="0.75">
          <stop offset="0" stopColor={brand.pop ?? '#FFEC3D'} stopOpacity="0.9" />
          <stop offset="0.5" stopColor={brand.pop ?? '#FFEC3D'} stopOpacity="0.25" />
          <stop offset="1" stopColor={brand.pop ?? '#FFEC3D'} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${p}shadeSide`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.05" />
          <stop offset="1" stopColor="#0f172a" stopOpacity="0.25" />
        </linearGradient>
        <SoftShadow id={`${p}sh`} />
      </defs>
      <ellipse cx="180" cy="460" rx="130" ry="10" fill={`url(#${p}sh)`} />
      {/* Cone of light */}
      <path d="M 60 240 L 300 240 L 360 460 L 0 460 Z" fill={`url(#${p}glow)`} opacity="0.7" />
      {/* Shade body */}
      <path d="M 92 100 L 268 100 L 304 240 L 56 240 Z" fill={`url(#${p}shade)`} />
      {/* Shade cap */}
      <ellipse cx="180" cy="100" rx="88" ry="14" fill={brand.primary} />
      <ellipse cx="180" cy="98" rx="74" ry="6" fill="#ffffff" opacity="0.55" />
      {/* Shade bottom rim */}
      <ellipse cx="180" cy="240" rx="124" ry="14" fill={brand.dark ?? '#0f172a'} opacity="0.3" />
      <path d="M 92 100 L 268 100 L 304 240 L 56 240 Z" fill={`url(#${p}shadeSide)`} />
      {/* Bulb hint */}
      <ellipse cx="180" cy="234" rx="26" ry="12" fill={brand.pop ?? '#FFEC3D'} opacity="0.9" />
      {/* Neck */}
      <rect x="170" y="240" width="20" height="30" fill={brand.dark ?? '#0f172a'} />
      {/* Stem */}
      <rect x="174" y="270" width="12" height="150" fill={brand.dark ?? '#0f172a'} />
      <rect x="174" y="270" width="4" height="150" fill="#ffffff" opacity="0.18" />
      {/* Base */}
      <rect x="100" y="420" width="160" height="30" rx="10" fill={brand.dark ?? '#0f172a'} />
      <rect x="106" y="426" width="148" height="4" rx="2" fill="#ffffff" opacity="0.3" />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  TRADES                                                              */
/* ═══════════════════════════════════════════════════════════════════ */

export function Hammer({ brand, idPrefix: p, className }: IllustrationProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480" className={className} aria-hidden>
      <defs>
        <BrandGradient id={`${p}grip`} brand={brand} />
        <linearGradient id={`${p}head`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#cbd5e1" />
          <stop offset="0.5" stopColor="#f1f5f9" />
          <stop offset="1" stopColor="#475569" />
        </linearGradient>
        <linearGradient id={`${p}handle`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8a5418" />
          <stop offset="0.5" stopColor="#b87333" />
          <stop offset="1" stopColor="#5c2e0c" />
        </linearGradient>
        <SoftShadow id={`${p}sh`} />
      </defs>
      <ellipse cx="240" cy="450" rx="150" ry="10" fill={`url(#${p}sh)`} />
      <g transform="translate(240 240) rotate(-35) translate(-240 -240)">
        {/* Claw back of head */}
        <path
          d="M 80 130 Q 60 160 80 200 Q 90 180 120 178 L 120 130 Z"
          fill={`url(#${p}head)`}
        />
        {/* Head */}
        <rect x="118" y="110" width="220" height="104" rx="10" fill={`url(#${p}head)`} />
        <rect x="118" y="112" width="220" height="10" fill="#ffffff" opacity="0.55" />
        <rect x="118" y="202" width="220" height="10" fill="#0f172a" opacity="0.3" />
        {/* Striking face (rounded) */}
        <path d="M 338 110 L 378 138 L 378 186 L 338 214 Z" fill={`url(#${p}head)`} />
        <rect x="370" y="122" width="4" height="88" fill="#ffffff" opacity="0.5" />
        {/* Head-to-handle collar */}
        <rect x="214" y="214" width="52" height="24" fill="#334155" />
        <rect x="214" y="214" width="52" height="6" fill="#ffffff" opacity="0.25" />
        {/* Handle shaft */}
        <rect x="220" y="238" width="40" height="190" fill={`url(#${p}handle)`} />
        <rect x="224" y="242" width="8" height="184" fill="#ffffff" opacity="0.25" />
        {/* Grip (rubber) */}
        <rect x="214" y="366" width="52" height="90" rx="12" fill={`url(#${p}grip)`} />
        <rect x="220" y="376" width="40" height="4" rx="2" fill="#ffffff" opacity="0.4" />
        <rect x="220" y="392" width="40" height="4" rx="2" fill="#ffffff" opacity="0.3" />
        <rect x="220" y="408" width="40" height="4" rx="2" fill="#ffffff" opacity="0.2" />
        <rect x="220" y="424" width="40" height="4" rx="2" fill="#ffffff" opacity="0.15" />
        {/* End cap */}
        <rect x="210" y="456" width="60" height="12" rx="3" fill="#0f172a" />
      </g>
    </svg>
  );
}

export function Toolbox({ brand, idPrefix: p, className }: IllustrationProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480" className={className} aria-hidden>
      <defs>
        <BrandGradient id={`${p}box`} brand={brand} vertical />
        <linearGradient id={`${p}body`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={brand.accent} />
          <stop offset="1" stopColor={brand.primary} />
        </linearGradient>
        <SoftShadow id={`${p}sh`} />
      </defs>
      <ellipse cx="240" cy="420" rx="180" ry="12" fill={`url(#${p}sh)`} />
      {/* Handle */}
      <path
        d="M 176 124 Q 180 82 240 80 Q 300 82 304 124"
        stroke={brand.dark ?? '#0f172a'}
        strokeWidth="16"
        fill="none"
        strokeLinecap="round"
      />
      {/* Handle grip wrap */}
      <rect x="208" y="78" width="64" height="26" rx="8" fill={brand.pop ?? '#FFEC3D'} />
      <rect x="214" y="84" width="52" height="4" fill="#0f172a" opacity="0.25" />
      <rect x="214" y="94" width="52" height="4" fill="#0f172a" opacity="0.2" />
      {/* Lid */}
      <path d="M 68 132 L 412 132 L 412 190 L 68 190 Z" fill={`url(#${p}box)`} />
      <rect x="68" y="132" width="344" height="8" fill="#ffffff" opacity="0.35" />
      {/* Latch */}
      <rect x="214" y="160" width="52" height="40" rx="4" fill="#0f172a" />
      <rect x="222" y="170" width="36" height="6" rx="2" fill={brand.pop ?? '#FFEC3D'} />
      <circle cx="230" cy="188" r="3" fill="#64748b" />
      <circle cx="250" cy="188" r="3" fill="#64748b" />
      {/* Body */}
      <rect x="68" y="190" width="344" height="194" rx="14" fill={`url(#${p}body)`} />
      <rect x="68" y="192" width="344" height="10" fill="#0f172a" opacity="0.25" />
      <rect x="68" y="378" width="344" height="8" fill="#0f172a" opacity="0.3" />
      {/* Tool tops peeking out */}
      <rect x="118" y="104" width="18" height="28" rx="3" fill="#64748b" />
      <rect x="120" y="108" width="4" height="20" fill="#f1f5f9" opacity="0.5" />
      <path d="M 334 104 L 356 104 L 358 132 L 332 132 Z" fill={brand.accent} />
      <rect x="336" y="108" width="18" height="4" fill="#ffffff" opacity="0.4" />
      {/* Hinges */}
      <rect x="84" y="186" width="20" height="12" rx="2" fill="#0f172a" opacity="0.4" />
      <rect x="376" y="186" width="20" height="12" rx="2" fill="#0f172a" opacity="0.4" />
      {/* Side rivets */}
      <circle cx="82" cy="340" r="4" fill="#ffffff" opacity="0.55" />
      <circle cx="398" cy="340" r="4" fill="#ffffff" opacity="0.55" />
    </svg>
  );
}

export function PaintBrush({ brand, idPrefix: p, className }: IllustrationProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480" className={className} aria-hidden>
      <defs>
        <BrandGradient id={`${p}paint`} brand={brand} />
        <linearGradient id={`${p}handle`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#c2410c" />
          <stop offset="0.5" stopColor="#9a3412" />
          <stop offset="1" stopColor="#7c2d12" />
        </linearGradient>
        <linearGradient id={`${p}ferrule`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#cbd5e1" />
          <stop offset="0.5" stopColor="#f1f5f9" />
          <stop offset="1" stopColor="#64748b" />
        </linearGradient>
        <SoftShadow id={`${p}sh`} />
      </defs>
      <ellipse cx="240" cy="450" rx="160" ry="10" fill={`url(#${p}sh)`} />
      <g transform="translate(240 240) rotate(-32) translate(-240 -240)">
        {/* Handle */}
        <path
          d="M 202 60 L 278 60 Q 282 60 282 66 L 282 310 Q 242 320 202 310 L 202 66 Q 202 60 202 60 Z"
          fill={`url(#${p}handle)`}
        />
        {/* Handle highlight */}
        <rect x="206" y="70" width="10" height="232" fill="#fed7aa" opacity="0.25" />
        {/* Metal ferrule */}
        <rect x="194" y="310" width="92" height="56" rx="3" fill={`url(#${p}ferrule)`} />
        <rect x="194" y="316" width="92" height="4" fill="#64748b" opacity="0.8" />
        <rect x="194" y="352" width="92" height="4" fill="#64748b" opacity="0.8" />
        {/* Ferrule rivets */}
        <circle cx="220" cy="340" r="3" fill="#94a3b8" />
        <circle cx="240" cy="340" r="3" fill="#94a3b8" />
        <circle cx="260" cy="340" r="3" fill="#94a3b8" />
        {/* Bristles bundle */}
        <path d="M 186 366 L 294 366 L 306 450 L 174 450 Z" fill="#e7e5e4" />
        {/* Individual bristle strokes */}
        <g stroke="#a8a29e" strokeWidth="2" strokeLinecap="round" opacity="0.8">
          <line x1="196" y1="366" x2="192" y2="450" />
          <line x1="212" y1="366" x2="208" y2="450" />
          <line x1="228" y1="366" x2="228" y2="450" />
          <line x1="244" y1="366" x2="244" y2="450" />
          <line x1="260" y1="366" x2="264" y2="450" />
          <line x1="276" y1="366" x2="280" y2="450" />
          <line x1="292" y1="366" x2="296" y2="450" />
        </g>
        {/* Wet paint at tip */}
        <path d="M 184 430 L 296 430 L 306 450 L 174 450 Z" fill={`url(#${p}paint)`} />
      </g>
      {/* Paint stroke coming off brush */}
      <path
        d="M 86 390 Q 140 432 220 432"
        stroke={`url(#${p}paint)`}
        strokeWidth="20"
        fill="none"
        strokeLinecap="round"
      />
      {/* Drip */}
      <circle cx="110" cy="432" r="10" fill={brand.primary} />
      <ellipse cx="106" cy="428" rx="4" ry="2" fill="#ffffff" opacity="0.6" />
    </svg>
  );
}

export function Gear({ brand, idPrefix: p, className }: IllustrationProps) {
  // Build a proper gear using teeth as rectangles around a circle.
  const teeth = 12;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480" className={className} aria-hidden>
      <defs>
        <radialGradient id={`${p}metal`} cx="0.3" cy="0.3" r="0.9">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.3" stopColor={brand.accent} />
          <stop offset="0.7" stopColor={brand.primary} />
          <stop offset="1" stopColor={brand.dark ?? '#0f172a'} />
        </radialGradient>
        <SoftShadow id={`${p}sh`} />
      </defs>
      <ellipse cx="240" cy="440" rx="150" ry="12" fill={`url(#${p}sh)`} />
      <g transform="translate(240 240)">
        {Array.from({ length: teeth }).map((_, i) => {
          const angle = (i * 360) / teeth;
          return (
            <rect
              key={i}
              x="-22"
              y="-210"
              width="44"
              height="64"
              rx="6"
              fill={`url(#${p}metal)`}
              transform={`rotate(${angle})`}
            />
          );
        })}
      </g>
      {/* Outer ring */}
      <circle cx="240" cy="240" r="150" fill={`url(#${p}metal)`} />
      <circle cx="240" cy="240" r="150" stroke={brand.dark ?? '#0f172a'} strokeWidth="3" fill="none" opacity="0.25" />
      {/* Middle ring */}
      <circle cx="240" cy="240" r="90" fill={brand.dark ?? '#0f172a'} />
      <circle cx="240" cy="240" r="90" stroke={brand.accent} strokeWidth="2" fill="none" opacity="0.6" />
      {/* Centre hub */}
      <circle cx="240" cy="240" r="40" fill={brand.pop ?? '#FFEC3D'} />
      <circle cx="240" cy="240" r="40" stroke={brand.dark ?? '#0f172a'} strokeWidth="3" fill="none" opacity="0.35" />
      <circle cx="240" cy="240" r="12" fill={brand.dark ?? '#0f172a'} />
      {/* Bolts */}
      {[0, 90, 180, 270].map((a) => {
        const x = 240 + Math.cos((a * Math.PI) / 180) * 64;
        const y = 240 + Math.sin((a * Math.PI) / 180) * 64;
        return <circle key={a} cx={x} cy={y} r="6" fill="#ffffff" opacity="0.85" />;
      })}
      {/* Specular highlight */}
      <ellipse cx="194" cy="192" rx="28" ry="14" fill="#ffffff" opacity="0.4" />
      <ellipse cx="184" cy="182" rx="6" ry="4" fill="#ffffff" opacity="0.9" />
    </svg>
  );
}

export function Drill({ brand, idPrefix: p, className }: IllustrationProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480" className={className} aria-hidden>
      <defs>
        <BrandGradient id={`${p}body`} brand={brand} />
        <linearGradient id={`${p}chuck`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#cbd5e1" />
          <stop offset="0.5" stopColor="#f1f5f9" />
          <stop offset="1" stopColor="#475569" />
        </linearGradient>
        <SoftShadow id={`${p}sh`} />
      </defs>
      <ellipse cx="240" cy="460" rx="160" ry="10" fill={`url(#${p}sh)`} />
      <g transform="translate(240 240) rotate(-8) translate(-240 -240)">
        {/* Body */}
        <rect x="130" y="150" width="220" height="150" rx="34" fill={`url(#${p}body)`} />
        <rect x="136" y="160" width="208" height="14" rx="7" fill="#ffffff" opacity="0.3" />
        <rect x="136" y="282" width="208" height="10" rx="5" fill="#0f172a" opacity="0.25" />
        {/* Branding stripe */}
        <rect x="150" y="204" width="180" height="26" fill={brand.pop ?? '#FFEC3D'} opacity="0.9" />
        <rect x="150" y="204" width="180" height="4" fill="#ffffff" opacity="0.5" />
        <text x="240" y="226" textAnchor="middle" fontSize="16" fontWeight="800" fill={brand.dark ?? '#0f172a'} fontFamily="system-ui, sans-serif">
          PRO
        </text>
        {/* Chuck collar */}
        <rect x="340" y="190" width="28" height="70" fill="#334155" />
        {/* Chuck */}
        <rect x="366" y="198" width="58" height="54" rx="6" fill={`url(#${p}chuck)`} />
        <rect x="366" y="202" width="58" height="6" fill="#ffffff" opacity="0.6" />
        <g stroke="#475569" strokeWidth="2" strokeLinecap="round">
          <line x1="376" y1="208" x2="376" y2="244" />
          <line x1="388" y1="208" x2="388" y2="244" />
          <line x1="400" y1="208" x2="400" y2="244" />
          <line x1="412" y1="208" x2="412" y2="244" />
        </g>
        {/* Drill bit */}
        <path d="M 424 216 L 470 220 L 474 230 L 424 232 Z" fill="#0f172a" />
        <path d="M 424 232 L 474 230 L 470 240 L 424 242 Z" fill="#334155" />
        {/* Trigger */}
        <path d="M 266 300 L 306 314 L 296 342 L 260 330 Z" fill={brand.pop ?? '#FFEC3D'} />
        <path d="M 266 300 L 306 314 L 304 322 L 264 308 Z" fill="#ffffff" opacity="0.35" />
        {/* Handle */}
        <path
          d="M 168 300 L 270 300 L 266 460 L 176 460 Z"
          fill={brand.dark ?? '#0f172a'}
        />
        {/* Grip pattern */}
        <g fill={brand.pop ?? '#FFEC3D'} opacity="0.7">
          <rect x="186" y="322" width="70" height="4" rx="2" />
          <rect x="186" y="340" width="70" height="4" rx="2" />
          <rect x="186" y="358" width="70" height="4" rx="2" />
          <rect x="186" y="376" width="70" height="4" rx="2" />
        </g>
        {/* Battery pack */}
        <rect x="158" y="440" width="124" height="36" rx="6" fill="#1e293b" />
        <rect x="164" y="446" width="40" height="6" rx="2" fill="#22c55e" opacity="0.9" />
        <rect x="208" y="446" width="28" height="6" rx="2" fill="#22c55e" opacity="0.6" />
      </g>
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  AUTOMOTIVE                                                          */
/* ═══════════════════════════════════════════════════════════════════ */

export function Motorcycle({ brand, idPrefix: p, className }: IllustrationProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 320" className={className} aria-hidden>
      <defs>
        <BrandGradient id={`${p}m`} brand={brand} />
        <radialGradient id={`${p}tank`} cx="0.3" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.6" />
          <stop offset="0.3" stopColor={brand.accent} />
          <stop offset="1" stopColor={brand.primary} />
        </radialGradient>
        <SoftShadow id={`${p}sh`} />
      </defs>
      <ellipse cx="240" cy="296" rx="220" ry="12" fill={`url(#${p}sh)`} />
      {/* Wheels */}
      <g>
        <circle cx="110" cy="234" r="62" fill="#0f172a" />
        <circle cx="110" cy="234" r="46" fill="#1e293b" />
        <circle cx="110" cy="234" r="30" fill="#64748b" />
        <circle cx="110" cy="234" r="10" fill={brand.pop ?? '#FFEC3D'} />
        {/* Spokes */}
        <g stroke="#94a3b8" strokeWidth="2">
          <line x1="110" y1="188" x2="110" y2="280" />
          <line x1="64" y1="234" x2="156" y2="234" />
          <line x1="78" y1="202" x2="142" y2="266" />
          <line x1="78" y1="266" x2="142" y2="202" />
        </g>
      </g>
      <g>
        <circle cx="376" cy="234" r="62" fill="#0f172a" />
        <circle cx="376" cy="234" r="46" fill="#1e293b" />
        <circle cx="376" cy="234" r="30" fill="#64748b" />
        <circle cx="376" cy="234" r="10" fill={brand.pop ?? '#FFEC3D'} />
        <g stroke="#94a3b8" strokeWidth="2">
          <line x1="376" y1="188" x2="376" y2="280" />
          <line x1="330" y1="234" x2="422" y2="234" />
          <line x1="344" y1="202" x2="408" y2="266" />
          <line x1="344" y1="266" x2="408" y2="202" />
        </g>
      </g>
      {/* Exhaust pipe */}
      <path d="M 64 234 L 40 240 L 34 254 L 60 252 Z" fill="#94a3b8" />
      <circle cx="38" cy="248" r="4" fill="#0f172a" />
      {/* Frame spine */}
      <path d="M 110 234 L 200 150 L 320 150 L 376 234" stroke="#0f172a" strokeWidth="14" fill="none" strokeLinecap="round" />
      {/* Seat */}
      <path d="M 250 120 Q 260 100 326 100 Q 342 106 344 130 L 322 148 L 254 148 Z" fill="#1e293b" />
      <path d="M 254 112 L 338 112" stroke="#fbbf24" strokeWidth="2" opacity="0.8" />
      {/* Tank */}
      <path d="M 164 146 Q 172 92 244 88 Q 312 102 324 146 Z" fill={`url(#${p}tank)`} />
      <path d="M 172 142 Q 182 100 244 96" stroke="#ffffff" strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.55" />
      {/* Tank vent */}
      <rect x="232" y="112" width="22" height="10" rx="2" fill="#0f172a" opacity="0.5" />
      {/* Handlebars */}
      <path d="M 156 70 L 248 70" stroke="#0f172a" strokeWidth="10" strokeLinecap="round" />
      <path d="M 156 70 L 148 124" stroke="#0f172a" strokeWidth="8" strokeLinecap="round" />
      {/* Mirror */}
      <circle cx="152" cy="50" r="12" fill="#334155" />
      <circle cx="152" cy="50" r="8" fill={brand.accent} opacity="0.7" />
      {/* Headlight */}
      <circle cx="376" cy="140" r="22" fill={brand.pop ?? '#FFEC3D'} />
      <circle cx="372" cy="136" r="8" fill="#ffffff" opacity="0.8" />
      {/* Motion lines */}
      <g stroke={brand.pop ?? '#FFEC3D'} strokeWidth="4" strokeLinecap="round" opacity="0.7">
        <line x1="0" y1="190" x2="40" y2="190" />
        <line x1="0" y1="216" x2="50" y2="216" />
        <line x1="0" y1="242" x2="44" y2="242" />
      </g>
    </svg>
  );
}

export function DeliveryVan({ brand, idPrefix: p, className }: IllustrationProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 320" className={className} aria-hidden>
      <defs>
        <BrandGradient id={`${p}v`} brand={brand} vertical />
        <linearGradient id={`${p}body`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={brand.accent} />
          <stop offset="0.5" stopColor={brand.primary} />
          <stop offset="1" stopColor={brand.dark ?? '#0f172a'} />
        </linearGradient>
        <SoftShadow id={`${p}sh`} />
      </defs>
      <ellipse cx="240" cy="292" rx="220" ry="10" fill={`url(#${p}sh)`} />
      {/* Cargo box */}
      <rect x="56" y="90" width="286" height="172" rx="10" fill={`url(#${p}body)`} />
      {/* Cab */}
      <path d="M 342 144 L 344 88 Q 344 84 350 84 L 420 84 Q 434 84 444 96 L 460 150 L 460 262 L 342 262 Z" fill={`url(#${p}body)`} />
      {/* Windshield */}
      <path d="M 352 148 L 354 106 Q 354 102 360 102 L 416 102 Q 428 102 436 112 L 448 148 Z" fill={brand.dark ?? '#0f172a'} opacity="0.85" />
      <path d="M 354 140 L 440 140" stroke="#ffffff" strokeWidth="2" opacity="0.4" />
      {/* Cab door */}
      <rect x="350" y="168" width="94" height="78" rx="3" fill={brand.primary} opacity="0.6" />
      <rect x="360" y="176" width="74" height="28" rx="2" fill={brand.dark ?? '#0f172a'} opacity="0.6" />
      <circle cx="430" cy="212" r="3" fill="#ffffff" opacity="0.85" />
      {/* Highlight along top */}
      <rect x="56" y="98" width="404" height="6" fill="#ffffff" opacity="0.35" />
      {/* Brand panel */}
      <rect x="80" y="130" width="240" height="100" rx="6" fill="#ffffff" opacity="0.95" />
      <rect x="80" y="130" width="240" height="6" fill={brand.accent} />
      <text x="200" y="178" textAnchor="middle" fontSize="26" fontWeight="800" fill={brand.primary} fontFamily="system-ui, sans-serif">
        BrandCo
      </text>
      <line x1="110" y1="202" x2="290" y2="202" stroke={brand.primary} strokeWidth="3" strokeLinecap="round" />
      <line x1="110" y1="214" x2="240" y2="214" stroke={brand.primary} strokeWidth="3" strokeLinecap="round" opacity="0.5" />
      {/* Back door seam */}
      <line x1="56" y1="108" x2="56" y2="262" stroke={brand.dark ?? '#0f172a'} strokeWidth="3" opacity="0.25" />
      <circle cx="70" cy="180" r="4" fill={brand.dark ?? '#0f172a'} opacity="0.5" />
      {/* Headlight */}
      <rect x="452" y="190" width="16" height="18" rx="3" fill={brand.pop ?? '#FFEC3D'} />
      {/* Bumper */}
      <rect x="342" y="252" width="128" height="14" fill="#334155" />
      <rect x="344" y="254" width="124" height="3" fill="#ffffff" opacity="0.3" />
      {/* Wheels */}
      <circle cx="124" cy="262" r="36" fill="#0f172a" />
      <circle cx="124" cy="262" r="18" fill="#64748b" />
      <circle cx="124" cy="262" r="6" fill={brand.pop ?? '#FFEC3D'} />
      <circle cx="388" cy="262" r="36" fill="#0f172a" />
      <circle cx="388" cy="262" r="18" fill="#64748b" />
      <circle cx="388" cy="262" r="6" fill={brand.pop ?? '#FFEC3D'} />
      {/* Motion lines */}
      <g stroke={brand.accent} strokeWidth="4" strokeLinecap="round" opacity="0.5">
        <line x1="0" y1="140" x2="40" y2="140" />
        <line x1="0" y1="170" x2="48" y2="170" />
        <line x1="0" y1="200" x2="36" y2="200" />
      </g>
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  TECH                                                                */
/* ═══════════════════════════════════════════════════════════════════ */

export function Laptop({ brand, idPrefix: p, className }: IllustrationProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 360" className={className} aria-hidden>
      <defs>
        <BrandGradient id={`${p}screen`} brand={brand} />
        <linearGradient id={`${p}body`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#94a3b8" />
          <stop offset="0.5" stopColor="#cbd5e1" />
          <stop offset="1" stopColor="#475569" />
        </linearGradient>
        <SoftShadow id={`${p}sh`} />
      </defs>
      <ellipse cx="240" cy="332" rx="230" ry="10" fill={`url(#${p}sh)`} />
      {/* Screen bezel */}
      <rect x="72" y="50" width="336" height="226" rx="12" fill="#0f172a" />
      {/* Inner screen */}
      <rect x="84" y="62" width="312" height="200" rx="5" fill={`url(#${p}screen)`} />
      {/* Top bar */}
      <rect x="84" y="62" width="312" height="24" fill="#0f172a" opacity="0.35" />
      <circle cx="100" cy="74" r="4" fill="#ef4444" />
      <circle cx="114" cy="74" r="4" fill="#fbbf24" />
      <circle cx="128" cy="74" r="4" fill="#22c55e" />
      {/* UI content — hero section mock */}
      <rect x="100" y="104" width="76" height="14" rx="4" fill="#ffffff" opacity="0.7" />
      <rect x="100" y="128" width="196" height="22" rx="4" fill="#ffffff" opacity="0.55" />
      <rect x="100" y="160" width="150" height="14" rx="3" fill="#ffffff" opacity="0.35" />
      <rect x="100" y="208" width="80" height="28" rx="6" fill={brand.pop ?? '#FFEC3D'} />
      {/* Side image mock */}
      <rect x="280" y="104" width="100" height="140" rx="8" fill="#ffffff" opacity="0.3" />
      <circle cx="330" cy="150" r="18" fill="#ffffff" opacity="0.55" />
      {/* Webcam */}
      <circle cx="240" cy="66" r="3" fill="#0f172a" />
      <circle cx="240" cy="66" r="2" fill="#1e293b" />
      {/* Base */}
      <path d="M 40 276 L 440 276 L 464 316 L 16 316 Z" fill={`url(#${p}body)`} />
      <rect x="40" y="276" width="400" height="6" fill="#ffffff" opacity="0.45" />
      {/* Trackpad divot */}
      <rect x="208" y="284" width="64" height="10" rx="4" fill="#64748b" />
    </svg>
  );
}

export function Atom({ brand, idPrefix: p, className }: IllustrationProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480" className={className} aria-hidden>
      <defs>
        <radialGradient id={`${p}nuc`} cx="0.35" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.4" stopColor={brand.accent} />
          <stop offset="1" stopColor={brand.primary} />
        </radialGradient>
        <SoftShadow id={`${p}sh`} />
      </defs>
      <ellipse cx="240" cy="450" rx="110" ry="10" fill={`url(#${p}sh)`} />
      <g transform="translate(240 240)">
        {/* Three orbits — each rotated to show 3D */}
        <ellipse cx="0" cy="0" rx="190" ry="76" stroke={brand.primary} strokeWidth="6" fill="none" />
        <ellipse cx="0" cy="0" rx="190" ry="76" stroke={brand.accent} strokeWidth="6" fill="none" transform="rotate(60)" />
        <ellipse cx="0" cy="0" rx="190" ry="76" stroke={brand.pop ?? '#FFEC3D'} strokeWidth="6" fill="none" transform="rotate(-60)" />
        {/* Orbit highlights */}
        <ellipse cx="0" cy="0" rx="190" ry="76" stroke="#ffffff" strokeWidth="2" fill="none" opacity="0.35" />
      </g>
      {/* Electrons */}
      <circle cx="430" cy="240" r="14" fill={brand.accent} />
      <circle cx="426" cy="236" r="4" fill="#ffffff" opacity="0.8" />
      <circle cx="146" cy="406" r="14" fill={brand.primary} />
      <circle cx="142" cy="402" r="4" fill="#ffffff" opacity="0.8" />
      <circle cx="334" cy="74" r="14" fill={brand.pop ?? '#FFEC3D'} />
      <circle cx="330" cy="70" r="4" fill="#ffffff" opacity="0.8" />
      {/* Nucleus */}
      <circle cx="240" cy="240" r="42" fill={`url(#${p}nuc)`} />
      <circle cx="225" cy="225" r="10" fill="#ffffff" opacity="0.7" />
    </svg>
  );
}

export function Cpu({ brand, idPrefix: p, className }: IllustrationProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480" className={className} aria-hidden>
      <defs>
        <BrandGradient id={`${p}c`} brand={brand} />
        <linearGradient id={`${p}die`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={brand.accent} />
          <stop offset="0.5" stopColor={brand.primary} />
          <stop offset="1" stopColor={brand.dark ?? '#0f172a'} />
        </linearGradient>
        <SoftShadow id={`${p}sh`} />
      </defs>
      <ellipse cx="240" cy="450" rx="170" ry="10" fill={`url(#${p}sh)`} />
      {/* Package body */}
      <rect x="116" y="116" width="248" height="248" rx="18" fill={brand.dark ?? '#0f172a'} />
      <rect x="124" y="124" width="232" height="232" rx="14" fill={`url(#${p}c)`} />
      <rect x="124" y="124" width="232" height="8" fill="#ffffff" opacity="0.3" />
      <rect x="124" y="348" width="232" height="8" fill="#0f172a" opacity="0.35" />
      {/* Die */}
      <rect x="164" y="164" width="152" height="152" rx="8" fill={`url(#${p}die)`} />
      <rect x="180" y="180" width="120" height="120" rx="4" fill="#0f172a" opacity="0.4" />
      {/* Circuit traces */}
      <g stroke={brand.pop ?? '#FFEC3D'} strokeWidth="2" fill="none" opacity="0.75">
        <path d="M 196 200 L 220 200 L 220 220 L 260 220" />
        <path d="M 260 196 L 300 196 L 300 232" />
        <path d="M 196 260 L 240 260 L 240 280 L 280 280" />
        <path d="M 196 288 L 220 288" />
      </g>
      <g fill={brand.pop ?? '#FFEC3D'}>
        <circle cx="196" cy="200" r="3" />
        <circle cx="260" cy="196" r="3" />
        <circle cx="300" cy="232" r="3" />
        <circle cx="280" cy="280" r="3" />
        <circle cx="220" cy="288" r="3" />
      </g>
      {/* Label */}
      <text x="240" y="256" textAnchor="middle" fontSize="30" fontWeight="800" fill="#ffffff" fontFamily="system-ui, sans-serif">
        AI
      </text>
      {/* Corner dot — indicates pin 1 */}
      <circle cx="140" cy="140" r="6" fill={brand.pop ?? '#FFEC3D'} />
      {/* Pins */}
      {Array.from({ length: 7 }).map((_, i) => {
        const pos = 136 + i * 32;
        return (
          <g key={i}>
            <rect x={pos} y="76" width="14" height="40" fill="#94a3b8" />
            <rect x={pos} y="76" width="14" height="6" fill="#cbd5e1" />
            <rect x={pos} y="364" width="14" height="40" fill="#94a3b8" />
            <rect x={pos} y="398" width="14" height="6" fill="#64748b" />
            <rect x="76" y={pos} width="40" height="14" fill="#94a3b8" />
            <rect x="76" y={pos} width="6" height="14" fill="#cbd5e1" />
            <rect x="364" y={pos} width="40" height="14" fill="#94a3b8" />
            <rect x="398" y={pos} width="6" height="14" fill="#64748b" />
          </g>
        );
      })}
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  RETAIL                                                              */
/* ═══════════════════════════════════════════════════════════════════ */

export function GiftBox({ brand, idPrefix: p, className }: IllustrationProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480" className={className} aria-hidden>
      <defs>
        <BrandGradient id={`${p}lid`} brand={brand} />
        <linearGradient id={`${p}body`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={brand.primary} />
          <stop offset="1" stopColor={brand.dark ?? '#0f172a'} />
        </linearGradient>
        <SoftShadow id={`${p}sh`} />
      </defs>
      <ellipse cx="240" cy="450" rx="190" ry="10" fill={`url(#${p}sh)`} />
      {/* Bow loops */}
      <path d="M 146 82 Q 186 142 238 138 Q 220 108 182 80 Q 160 72 146 82 Z" fill={brand.pop ?? '#FFEC3D'} />
      <path d="M 334 82 Q 294 142 242 138 Q 260 108 298 80 Q 320 72 334 82 Z" fill={brand.pop ?? '#FFEC3D'} />
      <path d="M 146 82 Q 186 142 238 138" stroke={brand.primary} strokeWidth="2" fill="none" opacity="0.35" />
      <path d="M 334 82 Q 294 142 242 138" stroke={brand.primary} strokeWidth="2" fill="none" opacity="0.35" />
      {/* Bow centre knot */}
      <ellipse cx="240" cy="140" rx="30" ry="22" fill={brand.pop ?? '#FFEC3D'} />
      <ellipse cx="240" cy="140" rx="30" ry="22" fill="#fbbf24" opacity="0.4" />
      <line x1="222" y1="130" x2="222" y2="152" stroke="#b45309" strokeWidth="2" opacity="0.7" />
      <line x1="258" y1="130" x2="258" y2="152" stroke="#b45309" strokeWidth="2" opacity="0.7" />
      {/* Ribbon tails */}
      <path d="M 210 156 Q 204 186 220 210 L 200 200 L 218 238" stroke={brand.pop ?? '#FFEC3D'} strokeWidth="14" fill="none" strokeLinecap="round" opacity="0.95" />
      <path d="M 270 156 Q 276 186 260 210 L 280 200 L 262 238" stroke={brand.pop ?? '#FFEC3D'} strokeWidth="14" fill="none" strokeLinecap="round" opacity="0.95" />
      {/* Lid */}
      <rect x="68" y="162" width="344" height="64" rx="8" fill={`url(#${p}lid)`} />
      <rect x="68" y="164" width="344" height="10" fill="#ffffff" opacity="0.4" />
      {/* Body */}
      <rect x="86" y="222" width="308" height="210" rx="8" fill={`url(#${p}body)`} />
      {/* Ribbon vertical over body */}
      <rect x="230" y="222" width="20" height="210" fill={brand.pop ?? '#FFEC3D'} />
      <rect x="230" y="222" width="4" height="210" fill="#ffffff" opacity="0.45" />
      {/* Ribbon horizontal on lid */}
      <rect x="68" y="182" width="344" height="20" fill={brand.pop ?? '#FFEC3D'} />
      <rect x="68" y="182" width="344" height="4" fill="#ffffff" opacity="0.45" />
      {/* Lid side accent */}
      <rect x="68" y="214" width="344" height="12" fill="#0f172a" opacity="0.35" />
      {/* Sparkles */}
      <g fill="#ffffff">
        <path d="M 130 300 L 134 310 L 144 314 L 134 318 L 130 328 L 126 318 L 116 314 L 126 310 Z" opacity="0.85" />
        <circle cx="360" cy="260" r="4" opacity="0.85" />
        <circle cx="360" cy="360" r="3" opacity="0.75" />
      </g>
    </svg>
  );
}

export function Diamond({ brand, idPrefix: p, className }: IllustrationProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${p}top`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor={brand.accent} />
        </linearGradient>
        <linearGradient id={`${p}left`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={brand.primary} />
          <stop offset="1" stopColor={brand.dark ?? '#0f172a'} />
        </linearGradient>
        <linearGradient id={`${p}right`} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={brand.accent} />
          <stop offset="1" stopColor={brand.primary} />
        </linearGradient>
        <SoftShadow id={`${p}sh`} />
      </defs>
      <ellipse cx="240" cy="440" rx="120" ry="10" fill={`url(#${p}sh)`} />
      {/* Top band — crown facets */}
      <polygon points="120,180 180,120 300,120 360,180" fill={`url(#${p}top)`} />
      {/* Crown facet lines */}
      <polygon points="120,180 180,120 240,180" fill="#ffffff" opacity="0.4" />
      <polygon points="240,180 300,120 360,180" fill={brand.primary} opacity="0.4" />
      <polygon points="180,120 240,180 300,120" fill={brand.accent} opacity="0.55" />
      {/* Pavilion (body) */}
      <polygon points="120,180 240,420 180,180" fill={`url(#${p}left)`} />
      <polygon points="180,180 240,420 240,180" fill={brand.accent} opacity="0.85" />
      <polygon points="240,180 240,420 300,180" fill={`url(#${p}right)`} />
      <polygon points="300,180 240,420 360,180" fill={brand.primary} opacity="0.9" />
      {/* Central facet highlight */}
      <polygon points="180,180 240,420 300,180" fill="#ffffff" opacity="0.1" />
      <line x1="120" y1="180" x2="360" y2="180" stroke="#0f172a" strokeWidth="2" opacity="0.35" />
      {/* Sparkles */}
      <g fill="#ffffff">
        <path d="M 150 212 L 156 222 L 166 228 L 156 234 L 150 244 L 144 234 L 134 228 L 144 222 Z" opacity="0.85" />
        <circle cx="310" cy="260" r="4" opacity="0.9" />
        <circle cx="200" cy="340" r="3" opacity="0.75" />
      </g>
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  EDUCATION                                                           */
/* ═══════════════════════════════════════════════════════════════════ */

export function Book({ brand, idPrefix: p, className }: IllustrationProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480" className={className} aria-hidden>
      <defs>
        <BrandGradient id={`${p}cover`} brand={brand} />
        <linearGradient id={`${p}pages`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fafaf9" />
          <stop offset="1" stopColor="#e7e5e4" />
        </linearGradient>
        <SoftShadow id={`${p}sh`} />
      </defs>
      <ellipse cx="240" cy="420" rx="180" ry="12" fill={`url(#${p}sh)`} />
      {/* Trailing pages */}
      <g transform="rotate(-4 240 240)">
        <rect x="94" y="104" width="300" height="300" rx="4" fill={`url(#${p}pages)`} />
        <g stroke="#d6d3d1" strokeWidth="1">
          <line x1="104" y1="140" x2="384" y2="140" />
          <line x1="104" y1="180" x2="384" y2="180" />
          <line x1="104" y1="220" x2="384" y2="220" />
          <line x1="104" y1="260" x2="384" y2="260" />
          <line x1="104" y1="300" x2="384" y2="300" />
          <line x1="104" y1="340" x2="384" y2="340" />
        </g>
      </g>
      {/* Cover */}
      <rect x="74" y="90" width="300" height="300" rx="6" fill={`url(#${p}cover)`} />
      {/* Spine */}
      <rect x="74" y="90" width="18" height="300" fill={brand.dark ?? '#0f172a'} opacity="0.4" />
      <rect x="74" y="90" width="2" height="300" fill="#ffffff" opacity="0.4" />
      {/* Cover embossed title */}
      <rect x="120" y="180" width="180" height="10" rx="3" fill="#ffffff" opacity="0.9" />
      <rect x="120" y="202" width="220" height="10" rx="3" fill="#ffffff" opacity="0.75" />
      <rect x="120" y="224" width="140" height="8" rx="3" fill="#ffffff" opacity="0.55" />
      <rect x="120" y="328" width="100" height="8" rx="3" fill="#ffffff" opacity="0.55" />
      {/* Emblem */}
      <circle cx="224" cy="140" r="14" fill="#ffffff" opacity="0.92" />
      <text x="224" y="146" textAnchor="middle" fontSize="16" fontWeight="800" fill={brand.primary} fontFamily="system-ui, sans-serif">
        B
      </text>
      {/* Bookmark ribbon */}
      <path d="M 320 90 L 320 220 L 338 200 L 356 220 L 356 90 Z" fill={brand.pop ?? '#FFEC3D'} />
      <path d="M 320 90 L 356 90 L 356 100 L 320 100 Z" fill="#0f172a" opacity="0.15" />
    </svg>
  );
}

export function GraduationCap({ brand, idPrefix: p, className }: IllustrationProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 360" className={className} aria-hidden>
      <defs>
        <BrandGradient id={`${p}c`} brand={brand} />
        <linearGradient id={`${p}top`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1f2937" />
          <stop offset="1" stopColor="#0f172a" />
        </linearGradient>
        <SoftShadow id={`${p}sh`} />
      </defs>
      <ellipse cx="240" cy="320" rx="200" ry="10" fill={`url(#${p}sh)`} />
      {/* Cap crown */}
      <path d="M 88 210 Q 240 288 392 210 L 392 254 Q 240 314 88 254 Z" fill={`url(#${p}c)`} />
      <path d="M 88 210 Q 240 288 392 210" stroke="#ffffff" strokeWidth="3" fill="none" opacity="0.35" />
      {/* Flat top (mortarboard) */}
      <polygon points="240,100 452,174 240,248 28,174" fill={`url(#${p}top)`} />
      <polygon points="240,100 452,174 240,184 28,174" fill="#1e293b" opacity="0.6" />
      <polygon points="240,100 452,174 240,184 28,174" fill="#ffffff" opacity="0.15" />
      {/* Button */}
      <circle cx="240" cy="176" r="8" fill={brand.pop ?? '#FFEC3D'} />
      {/* Tassel cord */}
      <path d="M 240 176 L 414 198" stroke={brand.pop ?? '#FFEC3D'} strokeWidth="4" strokeLinecap="round" />
      {/* Tassel */}
      <path d="M 408 196 L 424 282 L 440 200 Z" fill={brand.pop ?? '#FFEC3D'} />
      {/* Fringes on the tassel */}
      <g stroke="#ea580c" strokeWidth="2" strokeLinecap="round" opacity="0.7">
        <line x1="412" y1="230" x2="414" y2="280" />
        <line x1="420" y1="232" x2="422" y2="284" />
        <line x1="428" y1="230" x2="430" y2="282" />
        <line x1="436" y1="228" x2="438" y2="278" />
      </g>
    </svg>
  );
}

export function Apple({ brand, idPrefix: p, className }: IllustrationProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480" className={className} aria-hidden>
      <defs>
        <radialGradient id={`${p}a`} cx="0.3" cy="0.3" r="0.85">
          <stop offset="0" stopColor="#fecaca" />
          <stop offset="0.3" stopColor="#f87171" />
          <stop offset="0.7" stopColor="#dc2626" />
          <stop offset="1" stopColor="#7f1d1d" />
        </radialGradient>
        <linearGradient id={`${p}leaf`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4ade80" />
          <stop offset="1" stopColor="#15803d" />
        </linearGradient>
        <SoftShadow id={`${p}sh`} />
      </defs>
      <ellipse cx="240" cy="450" rx="150" ry="12" fill={`url(#${p}sh)`} />
      {/* Apple — two overlapping bumps for the classic lobed look */}
      <path
        d="M 240 140 C 200 140 170 172 170 220 C 160 240 132 260 132 300 C 132 378 186 440 232 434 Q 240 430 248 434 C 294 440 348 378 348 300 C 348 260 320 240 310 220 C 310 172 280 140 240 140 Z"
        fill={`url(#${p}a)`}
      />
      {/* Specular highlight */}
      <ellipse cx="184" cy="224" rx="30" ry="18" fill="#ffffff" opacity="0.5" transform="rotate(-25 184 224)" />
      <ellipse cx="178" cy="218" rx="8" ry="4" fill="#ffffff" opacity="0.9" />
      {/* Leaf */}
      <path d="M 240 146 Q 284 102 316 124 Q 308 160 256 158 Q 244 156 240 146 Z" fill={`url(#${p}leaf)`} />
      <path d="M 248 150 Q 278 126 308 130" stroke="#065f46" strokeWidth="2" fill="none" opacity="0.6" />
      {/* Stem */}
      <path d="M 232 132 Q 236 110 244 94" stroke="#78350f" strokeWidth="8" fill="none" strokeLinecap="round" />
      {/* Tiny second highlight */}
      <circle cx="288" cy="336" r="10" fill="#ffffff" opacity="0.35" />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  CREATIVE                                                            */
/* ═══════════════════════════════════════════════════════════════════ */

export function Palette({ brand, idPrefix: p, className }: IllustrationProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${p}wood`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fde68a" />
          <stop offset="0.5" stopColor="#f5b461" />
          <stop offset="1" stopColor="#c57f1b" />
        </linearGradient>
        <BrandGradient id={`${p}brand`} brand={brand} />
        <SoftShadow id={`${p}sh`} />
      </defs>
      <ellipse cx="240" cy="440" rx="180" ry="12" fill={`url(#${p}sh)`} />
      {/* Palette body — organic peanut shape with a thumb hole */}
      <path
        d="M 76 238 C 76 138 176 74 262 80 C 370 82 416 158 402 220 C 394 260 342 248 322 278 C 314 298 334 316 322 338 C 314 360 286 358 264 358 C 170 376 80 338 76 238 Z M 300 322 C 300 302 322 290 342 290 C 362 290 376 304 376 322 C 376 342 360 356 342 356 C 322 356 300 342 300 322 Z"
        fill={`url(#${p}wood)`}
        fillRule="evenodd"
      />
      {/* Wood grain highlights */}
      <path d="M 100 210 Q 200 180 300 210" stroke="#c57f1b" strokeWidth="2" fill="none" opacity="0.35" />
      <path d="M 110 260 Q 210 230 310 260" stroke="#c57f1b" strokeWidth="2" fill="none" opacity="0.3" />
      {/* Paint blobs */}
      <ellipse cx="160" cy="176" rx="32" ry="26" fill={brand.primary} transform="rotate(-15 160 176)" />
      <ellipse cx="154" cy="170" rx="10" ry="6" fill="#ffffff" opacity="0.55" />
      <ellipse cx="244" cy="136" rx="32" ry="26" fill={brand.accent} transform="rotate(10 244 136)" />
      <ellipse cx="238" cy="130" rx="10" ry="6" fill="#ffffff" opacity="0.55" />
      <ellipse cx="338" cy="174" rx="30" ry="24" fill={brand.pop ?? '#FFEC3D'} transform="rotate(-10 338 174)" />
      <ellipse cx="332" cy="168" rx="10" ry="6" fill="#ffffff" opacity="0.65" />
      <ellipse cx="204" cy="268" rx="30" ry="24" fill="#ec4899" transform="rotate(5 204 268)" />
      <ellipse cx="198" cy="262" rx="10" ry="6" fill="#ffffff" opacity="0.55" />
      <ellipse cx="296" cy="248" rx="30" ry="24" fill="#22c55e" transform="rotate(-18 296 248)" />
      <ellipse cx="290" cy="242" rx="10" ry="6" fill="#ffffff" opacity="0.55" />
      {/* Brush tucked through thumb hole */}
      <g transform="rotate(-30 342 320)">
        <rect x="324" y="280" width="64" height="14" rx="3" fill={`url(#${p}brand)`} />
        <rect x="324" y="280" width="64" height="4" fill="#ffffff" opacity="0.45" />
        <path d="M 386 282 L 414 276 L 418 294 L 386 292 Z" fill="#94a3b8" />
      </g>
    </svg>
  );
}

export function FilmReel({ brand, idPrefix: p, className }: IllustrationProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480" className={className} aria-hidden>
      <defs>
        <radialGradient id={`${p}r`} cx="0.35" cy="0.35" r="0.8">
          <stop offset="0" stopColor="#475569" />
          <stop offset="0.6" stopColor="#1f2937" />
          <stop offset="1" stopColor="#0f172a" />
        </radialGradient>
        <BrandGradient id={`${p}band`} brand={brand} />
        <SoftShadow id={`${p}sh`} />
      </defs>
      <ellipse cx="240" cy="440" rx="170" ry="12" fill={`url(#${p}sh)`} />
      {/* Reel base */}
      <circle cx="240" cy="240" r="200" fill={`url(#${p}r)`} />
      <circle cx="240" cy="240" r="180" stroke={brand.accent} strokeWidth="6" fill="none" opacity="0.5" />
      {/* Spoke holes */}
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i * 45 * Math.PI) / 180;
        return (
          <circle
            key={i}
            cx={240 + Math.cos(angle) * 110}
            cy={240 + Math.sin(angle) * 110}
            r="28"
            fill="#0f172a"
          />
        );
      })}
      {/* Hub */}
      <circle cx="240" cy="240" r="38" fill={brand.pop ?? '#FFEC3D'} />
      <circle cx="240" cy="240" r="24" fill={brand.dark ?? '#0f172a'} />
      <circle cx="240" cy="240" r="10" fill="#ffffff" opacity="0.6" />
      {/* Rim tick marks (perforations) */}
      {Array.from({ length: 36 }).map((_, i) => {
        const a = (i * 10 * Math.PI) / 180;
        const x = 240 + Math.cos(a) * 180;
        const y = 240 + Math.sin(a) * 180;
        return (
          <rect
            key={i}
            x={x - 3}
            y={y - 5}
            width="6"
            height="10"
            rx="1.5"
            fill={brand.accent}
            transform={`rotate(${i * 10} ${x} ${y})`}
          />
        );
      })}
      {/* Film strip trailing */}
      <path d="M 430 200 L 470 180 L 470 300 L 430 280 Z" fill={brand.dark ?? '#0f172a'} />
      <g fill={brand.pop ?? '#FFEC3D'}>
        <rect x="446" y="190" width="10" height="6" rx="1" />
        <rect x="446" y="210" width="10" height="6" rx="1" />
        <rect x="446" y="230" width="10" height="6" rx="1" />
        <rect x="446" y="250" width="10" height="6" rx="1" />
        <rect x="446" y="270" width="10" height="6" rx="1" />
      </g>
      {/* Specular */}
      <ellipse cx="180" cy="170" rx="36" ry="18" fill="#ffffff" opacity="0.25" />
    </svg>
  );
}

export function MusicNote({ brand, idPrefix: p, className }: IllustrationProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480" className={className} aria-hidden>
      <defs>
        <BrandGradient id={`${p}n`} brand={brand} />
        <SoftShadow id={`${p}sh`} />
      </defs>
      <ellipse cx="240" cy="440" rx="150" ry="12" fill={`url(#${p}sh)`} />
      {/* Stem */}
      <rect x="232" y="68" width="18" height="278" fill={`url(#${p}n)`} />
      <rect x="234" y="72" width="4" height="270" fill="#ffffff" opacity="0.4" />
      {/* Flag — two layers for bolder look */}
      <path d="M 250 68 C 330 90 370 168 336 238 C 336 196 288 148 250 142 Z" fill={`url(#${p}n)`} />
      <path d="M 250 148 C 322 164 352 220 336 260 C 336 224 290 192 250 188 Z" fill={brand.accent} opacity="0.85" />
      <path d="M 256 80 C 320 98 352 168 332 212" stroke="#ffffff" strokeWidth="3" fill="none" opacity="0.4" strokeLinecap="round" />
      {/* Note head */}
      <ellipse cx="200" cy="348" rx="68" ry="50" fill={`url(#${p}n)`} transform="rotate(-22 200 348)" />
      <ellipse cx="204" cy="352" rx="50" ry="34" fill={brand.dark ?? '#0f172a'} transform="rotate(-22 204 352)" />
      <ellipse cx="182" cy="324" rx="12" ry="6" fill="#ffffff" opacity="0.55" transform="rotate(-22 182 324)" />
      {/* Tiny music notes floating */}
      <g fill={brand.accent} opacity="0.7">
        <circle cx="372" cy="108" r="10" />
        <rect x="380" y="60" width="4" height="48" />
        <circle cx="404" cy="164" r="7" />
        <rect x="410" y="128" width="3" height="36" />
      </g>
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  NATURE                                                              */
/* ═══════════════════════════════════════════════════════════════════ */

export function Tree({ brand, idPrefix: p, className }: IllustrationProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480" className={className} aria-hidden>
      <defs>
        <radialGradient id={`${p}can`} cx="0.3" cy="0.3" r="0.85">
          <stop offset="0" stopColor="#86efac" />
          <stop offset="0.4" stopColor={brand.accent} />
          <stop offset="1" stopColor={brand.primary} />
        </radialGradient>
        <linearGradient id={`${p}trunk`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#92400e" />
          <stop offset="0.5" stopColor="#d97706" />
          <stop offset="1" stopColor="#78350f" />
        </linearGradient>
        <SoftShadow id={`${p}sh`} />
      </defs>
      <ellipse cx="240" cy="440" rx="170" ry="14" fill={`url(#${p}sh)`} />
      {/* Trunk */}
      <path d="M 220 296 Q 228 378 210 436 L 270 436 Q 252 378 260 296 Z" fill={`url(#${p}trunk)`} />
      <path d="M 232 310 Q 240 380 232 430" stroke="#5c2e0c" strokeWidth="2" fill="none" opacity="0.5" />
      {/* Roots */}
      <path d="M 220 428 Q 200 432 190 444" stroke="#5c2e0c" strokeWidth="6" fill="none" strokeLinecap="round" />
      <path d="M 260 428 Q 280 432 290 444" stroke="#5c2e0c" strokeWidth="6" fill="none" strokeLinecap="round" />
      {/* Canopy — layered ellipses for lushness */}
      <circle cx="150" cy="234" r="88" fill={`url(#${p}can)`} />
      <circle cx="330" cy="234" r="88" fill={`url(#${p}can)`} />
      <circle cx="240" cy="156" r="110" fill={`url(#${p}can)`} />
      <circle cx="200" cy="270" r="62" fill={`url(#${p}can)`} />
      <circle cx="280" cy="270" r="62" fill={`url(#${p}can)`} />
      {/* Canopy highlights */}
      <circle cx="208" cy="128" r="26" fill="#ffffff" opacity="0.35" />
      <circle cx="304" cy="200" r="14" fill="#ffffff" opacity="0.3" />
      {/* Leaf texture specks */}
      <g fill="#166534" opacity="0.35">
        <circle cx="180" cy="180" r="4" />
        <circle cx="290" cy="170" r="3" />
        <circle cx="248" cy="220" r="4" />
        <circle cx="200" cy="262" r="3" />
        <circle cx="320" cy="260" r="4" />
      </g>
      {/* Falling leaf */}
      <path d="M 80 320 Q 86 296 102 290" stroke="#65a30d" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M 80 320 Q 92 328 102 332 Q 96 320 80 320 Z" fill="#84cc16" />
    </svg>
  );
}

export function Mountain({ brand, idPrefix: p, className }: IllustrationProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 320" className={className} aria-hidden>
      <defs>
        <BrandGradient id={`${p}front`} brand={brand} />
        <linearGradient id={`${p}back`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={brand.accent} opacity="0.7" />
          <stop offset="1" stopColor={brand.primary} opacity="0.6" />
        </linearGradient>
        <linearGradient id={`${p}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={brand.pop ?? '#FFEC3D'} stopOpacity="0.35" />
          <stop offset="1" stopColor={brand.pop ?? '#FFEC3D'} stopOpacity="0" />
        </linearGradient>
        <SoftShadow id={`${p}sh`} />
      </defs>
      {/* Sky glow */}
      <rect x="0" y="0" width="480" height="280" fill={`url(#${p}sky)`} />
      {/* Sun */}
      <circle cx="106" cy="82" r="48" fill={brand.pop ?? '#FFEC3D'} />
      <circle cx="106" cy="82" r="48" fill="#ffffff" opacity="0.25" />
      <circle cx="92" cy="72" r="14" fill="#ffffff" opacity="0.55" />
      {/* Back mountain */}
      <path d="M 40 290 L 208 72 L 340 290 Z" fill={`url(#${p}back)`} />
      <path d="M 170 126 L 208 72 L 246 126 L 234 148 L 182 148 Z" fill="#ffffff" opacity="0.85" />
      {/* Front mountain */}
      <path d="M 160 290 L 290 96 L 460 290 Z" fill={`url(#${p}front)`} />
      {/* Snow cap */}
      <path d="M 246 154 L 290 96 L 334 154 L 316 176 L 264 176 Z" fill="#ffffff" />
      {/* Tiny valleys */}
      <path d="M 256 176 L 280 210 L 296 176" stroke="#ffffff" strokeWidth="3" fill="none" opacity="0.5" />
      {/* Contact shadow + foreground ground */}
      <ellipse cx="240" cy="300" rx="200" ry="10" fill={`url(#${p}sh)`} />
      <rect x="0" y="290" width="480" height="30" fill={brand.dark ?? '#0f172a'} opacity="0.55" />
      {/* Little pine */}
      <g transform="translate(386 250)">
        <polygon points="0,-40 -14,0 14,0" fill="#166534" />
        <polygon points="0,-26 -20,14 20,14" fill="#166534" />
        <rect x="-4" y="14" width="8" height="16" fill="#78350f" />
      </g>
    </svg>
  );
}

export function Sun({ brand, idPrefix: p, className }: IllustrationProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480" className={className} aria-hidden>
      <defs>
        <radialGradient id={`${p}s`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fefce8" />
          <stop offset="0.5" stopColor={brand.pop ?? '#FFEC3D'} />
          <stop offset="1" stopColor={brand.accent} />
        </radialGradient>
        <radialGradient id={`${p}halo`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={brand.pop ?? '#FFEC3D'} stopOpacity="0.4" />
          <stop offset="1" stopColor={brand.pop ?? '#FFEC3D'} stopOpacity="0" />
        </radialGradient>
        <SoftShadow id={`${p}sh`} />
      </defs>
      <ellipse cx="240" cy="430" rx="120" ry="10" fill={`url(#${p}sh)`} />
      {/* Halo */}
      <circle cx="240" cy="240" r="220" fill={`url(#${p}halo)`} />
      {/* 12 rays alternating long/short */}
      {Array.from({ length: 12 }).map((_, i) => {
        const long = i % 2 === 0;
        const h = long ? 56 : 36;
        const y = long ? -196 : -186;
        return (
          <rect
            key={i}
            x={-6}
            y={y}
            width="12"
            height={h}
            rx="4"
            fill={brand.accent}
            transform={`translate(240 240) rotate(${i * 30})`}
          />
        );
      })}
      {/* Sun body */}
      <circle cx="240" cy="240" r="110" fill={`url(#${p}s)`} />
      <circle cx="212" cy="212" r="32" fill="#ffffff" opacity="0.5" />
      <circle cx="200" cy="200" r="10" fill="#ffffff" opacity="0.9" />
      {/* Friendly smile (subtle) */}
      <path d="M 210 260 Q 240 286 270 260" stroke={brand.primary} strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.35" />
      <circle cx="216" cy="232" r="4" fill={brand.primary} opacity="0.35" />
      <circle cx="264" cy="232" r="4" fill={brand.primary} opacity="0.35" />
    </svg>
  );
}

export function Wave({ brand, idPrefix: p, className }: IllustrationProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${p}w`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a5f3fc" />
          <stop offset="0.5" stopColor={brand.accent} />
          <stop offset="1" stopColor={brand.primary} />
        </linearGradient>
        <linearGradient id={`${p}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={brand.pop ?? '#FFEC3D'} stopOpacity="0.35" />
          <stop offset="1" stopColor={brand.pop ?? '#FFEC3D'} stopOpacity="0" />
        </linearGradient>
        <SoftShadow id={`${p}sh`} />
      </defs>
      <rect x="0" y="0" width="480" height="240" fill={`url(#${p}sky)`} />
      <circle cx="380" cy="90" r="40" fill={brand.pop ?? '#FFEC3D'} opacity="0.8" />
      {/* Back wave */}
      <path d="M 0 340 Q 120 300 240 340 T 480 340 L 480 480 L 0 480 Z" fill={brand.accent} opacity="0.4" />
      {/* Main curling wave */}
      <path
        d="M 50 200 Q 130 80 260 140 Q 360 188 420 280 Q 390 246 350 240 Q 300 238 256 256 Q 200 282 134 274 Q 86 270 60 254 Q 50 242 50 200 Z"
        fill={`url(#${p}w)`}
      />
      {/* Curl detail */}
      <path d="M 80 210 Q 160 104 260 148" stroke="#ffffff" strokeWidth="6" fill="none" strokeLinecap="round" opacity="0.8" />
      <path d="M 150 170 Q 200 140 256 170" stroke="#ffffff" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.5" />
      {/* Mid wave */}
      <path d="M 0 380 Q 140 340 280 380 T 480 380 L 480 480 L 0 480 Z" fill={`url(#${p}w)`} opacity="0.9" />
      <path d="M 0 380 Q 140 340 280 380 T 480 380" stroke="#ffffff" strokeWidth="2" fill="none" opacity="0.5" />
      {/* Foam droplets */}
      <circle cx="130" cy="154" r="6" fill="#ffffff" opacity="0.8" />
      <circle cx="170" cy="124" r="4" fill="#ffffff" opacity="0.85" />
      <circle cx="100" cy="190" r="3" fill="#ffffff" opacity="0.7" />
      <circle cx="60" cy="222" r="5" fill="#ffffff" opacity="0.6" />
      {/* Shore shadow */}
      <ellipse cx="240" cy="472" rx="200" ry="6" fill={`url(#${p}sh)`} />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  ABSTRACT / GEOMETRIC                                                */
/* ═══════════════════════════════════════════════════════════════════ */

export function Orb({ brand, idPrefix: p, className }: IllustrationProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480" className={className} aria-hidden>
      <defs>
        <radialGradient id={`${p}o`} cx="0.35" cy="0.3" r="0.9">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.2" stopColor={brand.accent} />
          <stop offset="0.6" stopColor={brand.primary} />
          <stop offset="1" stopColor={brand.dark ?? '#0f172a'} />
        </radialGradient>
        <radialGradient id={`${p}halo`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0.7" stopColor={brand.pop ?? '#FFEC3D'} stopOpacity="0" />
          <stop offset="1" stopColor={brand.pop ?? '#FFEC3D'} stopOpacity="0.25" />
        </radialGradient>
        <SoftShadow id={`${p}sh`} />
      </defs>
      <ellipse cx="240" cy="430" rx="120" ry="12" fill={`url(#${p}sh)`} />
      {/* Outer halo */}
      <circle cx="240" cy="240" r="200" fill={`url(#${p}halo)`} />
      {/* Sphere */}
      <circle cx="240" cy="240" r="180" fill={`url(#${p}o)`} />
      {/* Tilted ring */}
      <g transform="translate(240 240) rotate(-15)">
        <ellipse cx="0" cy="0" rx="230" ry="46" stroke={brand.pop ?? '#FFEC3D'} strokeWidth="8" fill="none" opacity="0.85" />
        {/* Ring shine on the front side only */}
        <path d="M -220 0 A 230 46 0 0 1 220 0" stroke="#ffffff" strokeWidth="3" fill="none" opacity="0.6" />
      </g>
      {/* Specular highlights */}
      <ellipse cx="172" cy="180" rx="44" ry="26" fill="#ffffff" opacity="0.55" />
      <ellipse cx="160" cy="170" rx="14" ry="8" fill="#ffffff" opacity="0.9" />
      {/* Ambient occlusion at the base */}
      <ellipse cx="240" cy="400" rx="150" ry="18" fill="#0f172a" opacity="0.25" />
    </svg>
  );
}

export function CubeIso({ brand, idPrefix: p, className }: IllustrationProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${p}top`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.5" stopColor={brand.accent} />
          <stop offset="1" stopColor={brand.primary} />
        </linearGradient>
        <linearGradient id={`${p}left`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={brand.primary} />
          <stop offset="1" stopColor={brand.dark ?? '#0f172a'} />
        </linearGradient>
        <linearGradient id={`${p}right`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={brand.accent} />
          <stop offset="1" stopColor={brand.primary} />
        </linearGradient>
        <SoftShadow id={`${p}sh`} />
      </defs>
      <ellipse cx="240" cy="456" rx="180" ry="14" fill={`url(#${p}sh)`} />
      {/* Top */}
      <polygon points="240,80 400,180 240,280 80,180" fill={`url(#${p}top)`} />
      {/* Top edge highlight */}
      <polygon points="240,80 400,180 240,200 80,180" fill="#ffffff" opacity="0.18" />
      {/* Left */}
      <polygon points="80,180 240,280 240,440 80,340" fill={`url(#${p}left)`} />
      {/* Right */}
      <polygon points="400,180 240,280 240,440 400,340" fill={`url(#${p}right)`} />
      {/* Front seam glow */}
      <line x1="240" y1="80" x2="240" y2="440" stroke={brand.pop ?? '#FFEC3D'} strokeWidth="2" opacity="0.5" />
      {/* Edges */}
      <polyline points="240,80 400,180 240,280 80,180 240,80" stroke="#0f172a" strokeWidth="2" fill="none" opacity="0.25" />
      {/* Inner surface shapes — little cube print */}
      <rect x="140" y="250" width="40" height="32" fill="#ffffff" opacity="0.2" />
      <rect x="300" y="250" width="40" height="32" fill="#ffffff" opacity="0.1" />
      {/* Specular */}
      <polygon points="130,200 180,180 200,210 140,230" fill="#ffffff" opacity="0.35" />
    </svg>
  );
}

export function Prism({ brand, idPrefix: p, className }: IllustrationProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${p}pr`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={brand.accent} stopOpacity="0.85" />
          <stop offset="0.5" stopColor={brand.primary} stopOpacity="0.95" />
          <stop offset="1" stopColor={brand.dark ?? '#0f172a'} stopOpacity="0.9" />
        </linearGradient>
        <SoftShadow id={`${p}sh`} />
      </defs>
      <ellipse cx="240" cy="420" rx="170" ry="10" fill={`url(#${p}sh)`} />
      {/* Incoming white light */}
      <path d="M 20 240 L 180 240" stroke="#ffffff" strokeWidth="6" strokeLinecap="round" />
      <path d="M 20 240 L 180 240" stroke={brand.pop ?? '#FFEC3D'} strokeWidth="2" strokeLinecap="round" opacity="0.75" />
      {/* Rainbow spectrum */}
      <g strokeWidth="6" strokeLinecap="round" fill="none">
        <path d="M 280 240 L 460 150" stroke="#ef4444" />
        <path d="M 280 240 L 464 192" stroke="#f97316" />
        <path d="M 280 240 L 466 232" stroke="#eab308" />
        <path d="M 280 240 L 464 272" stroke="#22c55e" />
        <path d="M 280 240 L 460 314" stroke="#3b82f6" />
        <path d="M 280 240 L 448 358" stroke="#a855f7" />
      </g>
      <g fill="#ffffff" opacity="0.9">
        <circle cx="460" cy="150" r="4" />
        <circle cx="464" cy="192" r="4" />
        <circle cx="466" cy="232" r="4" />
        <circle cx="464" cy="272" r="4" />
        <circle cx="460" cy="314" r="4" />
        <circle cx="448" cy="358" r="4" />
      </g>
      {/* Prism triangle (slightly transparent so spectrum peeks through) */}
      <polygon points="180,100 280,240 180,380" fill={`url(#${p}pr)`} stroke={brand.pop ?? '#FFEC3D'} strokeWidth="3" opacity="0.92" />
      <polygon points="180,100 280,240 180,380" fill="#ffffff" opacity="0.08" />
      {/* Edge highlights */}
      <path d="M 180 100 L 280 240" stroke="#ffffff" strokeWidth="3" opacity="0.55" strokeLinecap="round" />
      <path d="M 280 240 L 180 380" stroke="#ffffff" strokeWidth="2" opacity="0.25" strokeLinecap="round" />
    </svg>
  );
}

export function Spiral({ brand, idPrefix: p, className }: IllustrationProps) {
  // Archimedean spiral approximation using a single smooth cubic path —
  // avoids the dashed-circle hack that had visible seams.
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${p}s`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={brand.pop ?? '#FFEC3D'} />
          <stop offset="0.5" stopColor={brand.accent} />
          <stop offset="1" stopColor={brand.primary} />
        </linearGradient>
        <SoftShadow id={`${p}sh`} />
      </defs>
      <ellipse cx="240" cy="440" rx="150" ry="10" fill={`url(#${p}sh)`} />
      {(() => {
        // Generate the spiral path points.
        const cx = 240;
        const cy = 240;
        const turns = 3.2;
        const maxR = 200;
        const points: string[] = [];
        const steps = 220;
        for (let i = 0; i <= steps; i += 1) {
          const t = i / steps;
          const angle = turns * Math.PI * 2 * t - Math.PI / 2;
          const r = maxR * t;
          const x = cx + Math.cos(angle) * r;
          const y = cy + Math.sin(angle) * r;
          points.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`);
        }
        const path = points.join(' ');
        return (
          <>
            <path
              d={path}
              stroke={brand.primary}
              strokeWidth="22"
              fill="none"
              strokeLinecap="round"
              opacity="0.35"
            />
            <path
              d={path}
              stroke={`url(#${p}s)`}
              strokeWidth="14"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d={path}
              stroke="#ffffff"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              opacity="0.4"
            />
          </>
        );
      })()}
      {/* Centre bead */}
      <circle cx="240" cy="240" r="20" fill={brand.pop ?? '#FFEC3D'} />
      <circle cx="240" cy="240" r="20" fill="#ffffff" opacity="0.25" />
      <circle cx="234" cy="234" r="6" fill="#ffffff" opacity="0.85" />
    </svg>
  );
}
