'use client';

import { motion } from 'framer-motion';
import type { WebsiteConfig } from '@boost/core';
import { SectionWrapper } from '../../section-wrapper';
import { useSiteContext } from '../context';
import { brandGradient } from '../theme';
import { InlineEditable } from '../InlineEditable';
import { InlineImage } from '../InlineImage';

interface SiteTeamProps {
  config: WebsiteConfig;
  images: string[];
}

type TeamMember = NonNullable<NonNullable<WebsiteConfig['team']>['members']>[number];
type TeamVariant = NonNullable<NonNullable<WebsiteConfig['team']>['variant']>;

/**
 * Team / practitioner grid. Dispatches each member to a card variant so
 * agencies can mix & match layouts.
 *
 * Variants:
 *   portrait  — tall 3/4 photo + full info (default; salons, agencies)
 *   minimal   — small avatar + name + role (dense grid, efficient)
 *   quote     — photo + name + short bio as a pull-style card
 *   banner    — wide landscape with overlay text (good for 1–3 featured)
 *
 * The block-level `team.variant` is the default; a member's own `variant`
 * overrides it for that single card.
 */
export function SiteTeam({ config, images }: SiteTeamProps) {
  const { embedded } = useSiteContext();
  const team = config.team;
  // Filter out any null / undefined members (sparse-hole legacy safety).
  const members = team?.members?.filter(
    (m): m is TeamMember => m != null,
  );
  if (!team || !members || members.length === 0) return null;

  const blockVariant: TeamVariant = team.variant ?? 'portrait';

  // Pick a grid class based on the dominant variant. Mixed rows use the
  // default container and let each card shrink/grow via `col-span-*`.
  const gridClass =
    blockVariant === 'minimal'
      ? 'mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 md:gap-5'
      : blockVariant === 'banner'
        ? 'mt-12 grid grid-cols-1 gap-6 md:grid-cols-2'
        : blockVariant === 'quote'
          ? 'mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3'
          : 'mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4';

  return (
    <SectionWrapper immediate={embedded} id="team" className="bg-white py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <InlineEditable
            path="team.eyebrow"
            value={team.eyebrow ?? 'The team'}
            as="p"
            className="text-xs font-semibold uppercase tracking-[0.25em]"
            style={{ color: 'var(--bmb-site-primary)' }}
            placeholder="Section eyebrow…"
          />
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-5xl">
            <InlineEditable
              path="team.heading"
              value={team.heading ?? 'Meet the people.'}
              as="span"
              placeholder="Section heading…"
            />
          </h2>
        </div>

        <div className={gridClass}>
          {members.map((m, i) => {
            const variant: TeamVariant = m.variant ?? blockVariant;
            const photo =
              m.photoUrl ??
              (typeof m.photoIndex === 'number' ? images[m.photoIndex] : undefined);
            // Featured members take two columns on the default `portrait`
            // grid. The banner variant is already wide so we just lift it
            // with a ring; the minimal variant stays single-column to
            // protect the dense grid's rhythm.
            const featuredSpan =
              m.featured && (variant === 'portrait' || variant === 'quote')
                ? 'sm:col-span-2'
                : '';
            const featuredRing = m.featured
              ? 'rounded-3xl ring-2 ring-offset-2 ring-[color:var(--bmb-site-primary)]'
              : '';
            return (
              <motion.div
                key={i}
                initial={embedded ? false : { opacity: 0, y: 16 }}
                whileInView={embedded ? undefined : { opacity: 1, y: 0 }}
                animate={embedded ? { opacity: 1, y: 0 } : undefined}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ delay: i * 0.05, duration: 0.5 }}
                className={`${featuredSpan} ${featuredRing}`.trim()}
              >
                {variant === 'minimal' ? (
                  <MinimalCard member={m} index={i} photo={photo} brand={config.brand} />
                ) : variant === 'quote' ? (
                  <QuoteCard member={m} index={i} photo={photo} brand={config.brand} />
                ) : variant === 'banner' ? (
                  <BannerCard member={m} index={i} photo={photo} brand={config.brand} />
                ) : (
                  <PortraitCard member={m} index={i} photo={photo} brand={config.brand} />
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </SectionWrapper>
  );
}

/* ---- Shared bits used by every variant ----------------------------- */

interface CardProps {
  member: TeamMember;
  index: number;
  photo: string | undefined;
  brand: WebsiteConfig['brand'];
}

function Initials({ name }: { name: string | undefined }) {
  // Guard: if the config somehow has a nameless member (legacy data or
  // freshly-added placeholder), show a neutral glyph instead of crashing
  // on `.split` of undefined.
  const safe = (name ?? '').trim();
  if (!safe) return <>?</>;
  return (
    <>
      {safe
        .split(' ')
        .map((p) => p[0])
        .slice(0, 2)
        .join('')}
    </>
  );
}

function SpecialtyChips({ member, limit = 5 }: { member: TeamMember; limit?: number }) {
  if (!member.specialties || member.specialties.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1">
      {member.specialties.slice(0, limit).map((s, si) => (
        <span
          key={si}
          className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600"
        >
          {s}
        </span>
      ))}
    </div>
  );
}

/* ---- Variants ------------------------------------------------------- */

/** Tall 3/4 portrait photo + full info. The classic. */
function PortraitCard({ member, index, photo, brand }: CardProps) {
  return (
    <div className="group overflow-hidden rounded-3xl border border-slate-200 bg-white transition-all hover:-translate-y-1 hover:shadow-xl">
      <div className="relative aspect-[3/4] overflow-hidden">
        <InlineImage
          src={photo}
          alt={member.name ?? ""}
          path={`team.members.${index}`}
          fieldName="photoIndex"
          className="h-full w-full"
          placeholder={
            <div
              className="flex h-full w-full items-center justify-center text-4xl font-bold text-white"
              style={{ background: brandGradient(brand, 140) }}
              aria-hidden
            >
              <Initials name={member.name} />
            </div>
          }
        />
      </div>
      <div className="p-4">
        <h3 className="text-base font-semibold text-slate-900">
          <InlineEditable
            path={`team.members.${index}.name`}
            value={member.name ?? ""}
            as="span"
            placeholder="Name…"
          />
        </h3>
        <p className="text-xs font-medium" style={{ color: 'var(--bmb-site-primary)' }}>
          <InlineEditable
            path={`team.members.${index}.role`}
            value={member.role ?? ""}
            as="span"
            placeholder="Role…"
          />
        </p>
        {member.credentials ? (
          <p className="mt-0.5 text-[10px] uppercase tracking-wider text-slate-500">
            <InlineEditable
              path={`team.members.${index}.credentials`}
              value={member.credentials}
              as="span"
              placeholder="Credentials…"
            />
          </p>
        ) : null}
        {member.bio ? (
          <p className="mt-2 text-xs text-slate-600">
            <InlineEditable
              path={`team.members.${index}.bio`}
              value={member.bio}
              as="span"
              multiline
              placeholder="Short bio…"
            />
          </p>
        ) : null}
        <SpecialtyChips member={member} />
      </div>
    </div>
  );
}

/** Small round avatar + name + role. Dense, efficient grid. */
function MinimalCard({ member, index, photo, brand }: CardProps) {
  return (
    <div className="flex flex-col items-center rounded-2xl bg-slate-50 p-4 text-center">
      <div className="relative h-20 w-20 overflow-hidden rounded-full ring-2 ring-white">
        <InlineImage
          src={photo}
          alt={member.name ?? ""}
          path={`team.members.${index}`}
          fieldName="photoIndex"
          className="h-full w-full"
          placeholder={
            <div
              className="flex h-full w-full items-center justify-center text-lg font-bold text-white"
              style={{ background: brandGradient(brand, 140) }}
              aria-hidden
            >
              <Initials name={member.name} />
            </div>
          }
        />
      </div>
      <h3 className="mt-3 text-sm font-semibold text-slate-900">
        <InlineEditable
          path={`team.members.${index}.name`}
          value={member.name ?? ""}
          as="span"
          placeholder="Name…"
        />
      </h3>
      <p className="text-[11px] font-medium" style={{ color: 'var(--bmb-site-primary)' }}>
        <InlineEditable
          path={`team.members.${index}.role`}
          value={member.role ?? ""}
          as="span"
          placeholder="Role…"
        />
      </p>
    </div>
  );
}

/** Photo + pull-quote-style bio. Good for featured voices. */
function QuoteCard({ member, index, photo, brand }: CardProps) {
  return (
    <figure className="flex h-full flex-col rounded-3xl border border-slate-200 bg-slate-50 p-6">
      <div className="flex items-center gap-4">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full ring-2 ring-white">
          <InlineImage
            src={photo}
            alt={member.name ?? ""}
            path={`team.members.${index}`}
            fieldName="photoIndex"
            className="h-full w-full"
            placeholder={
              <div
                className="flex h-full w-full items-center justify-center text-base font-bold text-white"
                style={{ background: brandGradient(brand, 140) }}
                aria-hidden
              >
                <Initials name={member.name} />
              </div>
            }
          />
        </div>
        <figcaption className="min-w-0">
          <p className="truncate text-base font-semibold text-slate-900">
            <InlineEditable
              path={`team.members.${index}.name`}
              value={member.name ?? ""}
              as="span"
              placeholder="Name…"
            />
          </p>
          <p
            className="truncate text-xs font-medium"
            style={{ color: 'var(--bmb-site-primary)' }}
          >
            <InlineEditable
              path={`team.members.${index}.role`}
              value={member.role ?? ""}
              as="span"
              placeholder="Role…"
            />
          </p>
        </figcaption>
      </div>
      <blockquote className="mt-4 text-sm leading-relaxed text-slate-700">
        <span aria-hidden>&ldquo;</span>
        <InlineEditable
          path={`team.members.${index}.bio`}
          value={member.bio ?? ''}
          as="span"
          multiline
          placeholder="Short quote or bio…"
        />
        <span aria-hidden>&rdquo;</span>
      </blockquote>
      <SpecialtyChips member={member} limit={3} />
    </figure>
  );
}

/** Wide landscape card with photo + overlay. Fewer per row; hero-like. */
function BannerCard({ member, index, photo, brand }: CardProps) {
  return (
    <div className="relative overflow-hidden rounded-3xl shadow-xl">
      <div className="relative aspect-[16/9]">
        <InlineImage
          src={photo}
          alt={member.name ?? ""}
          path={`team.members.${index}`}
          fieldName="photoIndex"
          className="h-full w-full"
          placeholder={
            <div
              className="flex h-full w-full items-center justify-center text-5xl font-bold text-white"
              style={{ background: brandGradient(brand, 140) }}
              aria-hidden
            >
              <Initials name={member.name} />
            </div>
          }
        />
        {photo ? (
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.15) 65%, rgba(0,0,0,0.75) 100%)',
            }}
          />
        ) : null}
      </div>
      <div className="absolute inset-x-0 bottom-0 p-5 text-white">
        <h3 className="text-xl font-bold">
          <InlineEditable
            path={`team.members.${index}.name`}
            value={member.name ?? ""}
            as="span"
            placeholder="Name…"
          />
        </h3>
        <p className="text-sm font-medium text-white/85">
          <InlineEditable
            path={`team.members.${index}.role`}
            value={member.role ?? ""}
            as="span"
            placeholder="Role…"
          />
          {member.credentials ? (
            <>
              <span aria-hidden> · </span>
              <InlineEditable
                path={`team.members.${index}.credentials`}
                value={member.credentials}
                as="span"
                placeholder="Credentials…"
              />
            </>
          ) : null}
        </p>
      </div>
    </div>
  );
}
