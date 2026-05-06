'use client';

/**
 * Shared heading block used across most site sections (Services, About,
 * Reviews, FAQ, Contact, CTA, etc.). Keeps the copy inline-editable via
 * `InlineEditable` and adds a subtle scroll-linked reveal:
 *
 *  - Eyebrow + heading lift and fade in as the section enters the viewport
 *  - An accent underline draws itself from the left in brand gradient
 *
 * All motion respects `prefers-reduced-motion` and the `embedded`
 * preview flag (dashboard preview renders the header statically so the
 * editor stays still).
 */

import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';
import { InlineEditable } from '../InlineEditable';
import { useSiteContext } from '../context';

interface SectionHeaderProps {
  /** Eyebrow text path, e.g. "servicesSection.eyebrow". */
  eyebrowPath: string;
  /** Heading text path, e.g. "servicesSection.heading". */
  headingPath: string;
  /** Eyebrow value; empty string renders nothing in public mode. */
  eyebrow?: string | null;
  /** Heading value. Required — all sections have a heading. */
  heading: string;
  /** Optional tagline path + value rendered below the heading. */
  taglinePath?: string;
  tagline?: string | null;
  /** Placeholder strings for edit mode. */
  placeholders?: {
    eyebrow?: string;
    heading?: string;
    tagline?: string;
  };
  /** Render the header on a dark background — flips text colours. */
  dark?: boolean;
  /** Disable motion (used inside the dashboard preview iframe). */
  embedded?: boolean;
  /** Optional extra node rendered after the tagline (e.g. a small chip). */
  extra?: ReactNode;
  /** Alignment. Default 'center'. */
  align?: 'center' | 'left';
  /** Max width on the text block. Default 'max-w-2xl'. */
  maxWidthClass?: string;
}

export function SectionHeader({
  eyebrowPath,
  headingPath,
  eyebrow,
  heading,
  taglinePath,
  tagline,
  placeholders,
  dark,
  embedded,
  extra,
  align = 'center',
  maxWidthClass = 'max-w-2xl',
}: SectionHeaderProps) {
  const reduced = useReducedMotion();
  const { editMode } = useSiteContext();
  const motionDisabled = Boolean(reduced) || Boolean(embedded);

  const alignmentClass = align === 'center' ? 'mx-auto text-center' : 'text-left';
  const headingColor = dark ? 'text-white' : 'text-slate-900';

  // Eyebrow visibility rules:
  //   - Edit mode: always render it (empty or not) so the user can click
  //     and type a new value — otherwise a blanked eyebrow becomes
  //     permanently unreachable without a refresh.
  //   - Public mode: skip it when empty so we don't leave a blank kicker
  //     above the heading.
  const showEyebrow = editMode || (typeof eyebrow === 'string' && eyebrow.trim() !== '');

  return (
    <motion.div
      className={`${maxWidthClass} ${alignmentClass}`}
      initial={motionDisabled ? undefined : { opacity: 0, y: 20 }}
      whileInView={motionDisabled ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      {showEyebrow ? (
        <InlineEditable
          path={eyebrowPath}
          value={eyebrow ?? ''}
          as="p"
          className={`text-xs font-semibold uppercase tracking-[0.25em] ${
            dark ? 'text-white/80' : ''
          }`}
          style={!dark ? { color: 'var(--bmb-site-primary)' } : undefined}
          placeholder={placeholders?.eyebrow ?? 'Section eyebrow…'}
        />
      ) : null}

      <h2
        className={`${showEyebrow ? 'mt-3' : ''} text-3xl font-bold tracking-tight md:text-5xl ${headingColor}`}
      >
        <InlineEditable
          path={headingPath}
          value={heading}
          as="span"
          placeholder={placeholders?.heading ?? 'Section heading…'}
        />
      </h2>

      {/* Animated brand underline. Draws in on scroll from left to right.
          Uses a scaleX transform with a left-origin so the animation is
          composited on the GPU. */}
      <motion.div
        aria-hidden
        className={`mt-4 h-[3px] rounded-full ${align === 'center' ? 'mx-auto' : ''}`}
        style={{
          width: align === 'center' ? '64px' : '80px',
          background:
            'linear-gradient(90deg, var(--bmb-site-primary), var(--bmb-site-accent))',
          transformOrigin: align === 'center' ? 'center' : 'left',
        }}
        initial={motionDisabled ? undefined : { scaleX: 0 }}
        whileInView={motionDisabled ? undefined : { scaleX: 1 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
      />

      {(editMode || (typeof tagline === 'string' && tagline.trim() !== '')) && taglinePath ? (
        <p
          className={`mt-4 text-base md:text-lg ${
            dark ? 'text-white/80' : 'text-slate-600'
          }`}
        >
          <InlineEditable
            path={taglinePath}
            value={tagline ?? ''}
            as="span"
            multiline
            placeholder={placeholders?.tagline ?? 'Short tagline for this section…'}
          />
        </p>
      ) : null}

      {extra}
    </motion.div>
  );
}
