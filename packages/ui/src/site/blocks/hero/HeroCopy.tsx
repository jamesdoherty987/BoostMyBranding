'use client';

/**
 * Shared hero copy block: eyebrow + headline + subheadline + CTAs.
 * Every hero variant renders the same copy; only the surrounding layout
 * and effects change. Centralizing it here means a copy-level tweak
 * propagates everywhere without touching five files.
 *
 * The headline's last two words get auto-gradient-highlighted — the
 * generator prompt is written so the last two words form a punchy phrase.
 *
 * Every text field is wrapped in `InlineEditable` so the dashboard
 * preview can offer click-to-edit. Public renders ignore the edit-mode
 * branch and render plain text.
 */

import { motion, useReducedMotion, type MotionStyle } from 'framer-motion';
import type { WebsiteConfig } from '@boost/core';
import { brandGradient } from '../../theme';
import { InlineEditable } from '../../InlineEditable';
import { useSiteContext } from '../../context';
import { TypewriterEffect } from '../../../aceternity/ui/typewriter-effect';
import { FlipWords } from '../../../aceternity/ui/flip-words';
import { TextGenerateEffect } from '../../../aceternity/ui/text-generate-effect';

interface HeroCopyProps {
  config: WebsiteConfig;
  /** Optional motion style override for scroll-linked animations. */
  style?: MotionStyle;
  /** Whether the hero background is dark. Flips foreground colors. */
  dark?: boolean;
  /** Alignment. Most variants are left-aligned; some are centered. */
  align?: 'left' | 'center';
  /** When true, skip scroll-linked opacity/translate. */
  motionDisabled?: boolean;
}

export function HeroCopy({
  config,
  style,
  dark = false,
  align = 'left',
  motionDisabled = false,
}: HeroCopyProps) {
  const reduced = useReducedMotion();
  const { editMode } = useSiteContext();
  const heroHeadline = config.hero?.headline ?? 'Welcome.';
  const heroSubhead = config.hero?.subheadline ?? '';
  const ctaPrimary = config.hero?.ctaPrimary ?? { label: 'Get in touch', href: '#contact' };
  const ctaSecondary = config.hero?.ctaSecondary;
  const eyebrow = config.hero?.eyebrow;
  const alignClass = align === 'center' ? 'text-center items-center' : 'text-left items-start';

  // Disable entrance motion when host asked us to, OR OS reduced-motion.
  const noMotion = motionDisabled || reduced;

  return (
    <motion.div
      className={`relative z-10 flex max-w-3xl flex-col gap-5 ${alignClass}`}
      style={noMotion ? undefined : style}
      initial={noMotion ? false : { opacity: 0, y: 16 }}
      animate={noMotion ? undefined : { opacity: 1, y: 0 }}
      transition={noMotion ? undefined : { duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
    >
      {eyebrow || editMode ? (
        <InlineEditable
          path="hero.eyebrow"
          value={eyebrow ?? ''}
          as="p"
          className="text-xs font-semibold uppercase tracking-[0.25em]"
          placeholder="Optional eyebrow kicker…"
        />
      ) : null}

      <h1
        className={`text-balance text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl ${
          dark ? 'text-white' : 'text-slate-900'
        }`}
      >
        {editMode ? (
          // In edit mode we skip the gradient-split and render as a single
          // editable span so the user can type naturally. Effects are
          // disabled here too so the text stays editable.
          <InlineEditable
            path="hero.headline"
            value={heroHeadline}
            as="span"
            placeholder="Hero headline…"
          />
        ) : config.hero?.headlineEffect === 'typewriter' ? (
          // Typewriter effect — renders character-by-character. We split
          // on words and pass them as an array; the last word gets the
          // accent color via inline class.
          <TypewriterEffect
            words={buildTypewriterWords(heroHeadline, config)}
            className={dark ? 'text-white' : 'text-slate-900'}
            cursorClassName={dark ? 'bg-white' : 'bg-slate-900'}
          />
        ) : config.hero?.headlineEffect === 'flip-words' &&
          config.hero?.flipWords &&
          config.hero.flipWords.length > 0 ? (
          // Flip-words effect — the last word cycles through the
          // `flipWords` list. The prefix is the original headline minus
          // its last word, rendered normally.
          <>
            {stripLastWord(heroHeadline)}{' '}
            <FlipWords
              words={config.hero.flipWords}
              className={dark ? 'text-white' : 'text-slate-900'}
            />
          </>
        ) : config.hero?.headlineEffect === 'generate' ? (
          // Generate effect — words fade in with a slight blur one-by-one
          // when the hero enters view. Works with ANY headline length.
          <TextGenerateEffect
            words={heroHeadline}
            className={`inline ${dark ? 'text-white' : 'text-slate-900'}`}
          />
        ) : (
          splitHeadline(heroHeadline).map((chunk, i) =>
            chunk.accent ? (
              <span
                key={i}
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: brandGradient(config.brand, 90) }}
              >
                {chunk.text}
              </span>
            ) : (
              <span key={i}>{chunk.text}</span>
            ),
          )
        )}
      </h1>

      {heroSubhead || editMode ? (
        <InlineEditable
          path="hero.subheadline"
          value={heroSubhead}
          as="p"
          multiline
          className={`max-w-xl text-base md:text-lg ${
            dark ? 'text-white/80' : 'text-slate-600'
          } ${align === 'center' ? 'mx-auto' : ''}`}
          placeholder="1–2 sentences of supporting copy…"
        />
      ) : null}

      <div
        className={`mt-2 flex flex-col items-stretch gap-3 sm:flex-row ${
          align === 'center' ? 'sm:justify-center' : 'sm:items-center'
        }`}
      >
        <a
          href={ctaPrimary.href}
          onClick={editMode ? (e) => e.preventDefault() : undefined}
          tabIndex={editMode ? -1 : undefined}
          className="group inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold text-white shadow-xl transition-all hover:scale-[1.03] hover:shadow-2xl"
          style={{
            background: brandGradient(config.brand, 120),
            boxShadow: `0 18px 40px -12px ${config.brand.primaryColor}66`,
          }}
        >
          <InlineEditable
            path="hero.ctaPrimary.label"
            value={ctaPrimary.label}
            as="span"
            placeholder="Primary CTA…"
          />
          <span className="inline-block translate-x-0 transition-transform group-hover:translate-x-1">
            →
          </span>
        </a>
        {ctaSecondary ? (
          <a
            href={ctaSecondary.href}
            onClick={editMode ? (e) => e.preventDefault() : undefined}
            tabIndex={editMode ? -1 : undefined}
            className={`inline-flex items-center justify-center gap-2 rounded-full border px-7 py-3.5 text-sm font-semibold backdrop-blur transition-colors ${
              dark
                ? 'border-white/30 bg-white/5 text-white hover:bg-white/10'
                : 'border-slate-200 bg-white/80 text-slate-900 hover:bg-white'
            }`}
          >
            <InlineEditable
              path="hero.ctaSecondary.label"
              value={ctaSecondary.label}
              as="span"
              placeholder="Secondary CTA…"
            />
          </a>
        ) : null}
      </div>
    </motion.div>
  );
}

/**
 * Split a headline on the last 2-word phrase so we can gradient-highlight it.
 * Produces either one plain chunk (short headlines) or a plain + accent pair.
 * Trailing punctuation is kept OUT of the accent chunk so the gradient text
 * doesn't capture commas or periods.
 */
function splitHeadline(headline: string): Array<{ text: string; accent?: boolean }> {
  const cleaned = headline.trim();
  if (!cleaned) return [{ text: '' }];
  const words = cleaned.split(/\s+/);
  if (words.length <= 3) return [{ text: cleaned }];

  const last = words[words.length - 1] ?? '';
  const match = last.match(/^([^\p{P}\s]+)([\p{P}]*)$/u);
  let accentWords: string;
  let tail = '';
  if (match) {
    accentWords = `${words[words.length - 2]} ${match[1]}`;
    tail = match[2] ?? '';
  } else {
    accentWords = words.slice(-2).join(' ');
  }
  const leadWords = words.slice(0, -2).join(' ');
  return [
    { text: leadWords + ' ' },
    { text: accentWords, accent: true },
    ...(tail ? [{ text: tail }] : []),
  ];
}

/**
 * Build the input the TypewriterEffect primitive expects — an array of
 * `{ text, className? }`. The last word gets a brand-accent color class
 * so the typing-in effect still has the "last two words pop" energy.
 */
function buildTypewriterWords(
  headline: string,
  config: WebsiteConfig,
): Array<{ text: string; className?: string }> {
  const cleaned = headline.trim();
  if (!cleaned) return [{ text: '' }];
  const words = cleaned.split(/\s+/);
  if (words.length === 1) return [{ text: words[0] ?? '' }];
  const lastWord = words.pop() ?? '';
  return [
    ...words.map((w) => ({ text: w })),
    {
      text: lastWord,
      // Use the primary brand color so the typewriter accent matches the
      // rest of the site's accent language.
      className: '[color:var(--bmb-site-primary)]',
    },
  ];
}

/** Strip the last word — used by the flip-words effect's static prefix. */
function stripLastWord(headline: string): string {
  const words = headline.trim().split(/\s+/);
  if (words.length <= 1) return '';
  return words.slice(0, -1).join(' ');
}
