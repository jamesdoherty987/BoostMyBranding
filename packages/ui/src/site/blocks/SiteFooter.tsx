'use client';

import type { WebsiteConfig } from '@boost/core';
import { Facebook, Instagram, Linkedin, Youtube, Globe } from 'lucide-react';
import { InlineEditable } from '../InlineEditable';

interface SiteFooterProps {
  config: WebsiteConfig;
  businessName: string;
}

/**
 * Dark footer strip with social links. The tagline is inline-editable and
 * social icons render automatically when the config has URLs. Uses Lucide
 * icons for consistency with the rest of the site — they're simple strokes
 * at 24px which is fine for a footer chip.
 *
 * TikTok and X don't have Lucide equivalents, so we render a custom SVG
 * for each. Google Business Profile uses the generic globe icon since a
 * proper "G" logo requires trademark-safe usage rules we don't want to
 * embed in user-configurable sites.
 */
export function SiteFooter({ config, businessName }: SiteFooterProps) {
  const year = new Date().getFullYear();
  const nav = config.navigation ?? ['Services', 'About', 'Contact'];
  const tagline = config.footer?.tagline ?? config.brand.tagline ?? '';
  const socials = config.socials;
  const hasSocials = socials && Object.values(socials).some(Boolean);

  return (
    <footer
      className="border-t py-10"
      style={{
        background: 'var(--bmb-site-dark)',
        color: 'rgba(255,255,255,0.75)',
        borderColor: 'rgba(255,255,255,0.1)',
      }}
    >
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <span
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold"
            style={{
              background: 'var(--bmb-site-primary)',
              color: 'var(--bmb-site-on-primary)',
            }}
            aria-hidden
          >
            {businessName.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <div className="text-sm font-semibold text-white">{businessName}</div>
            <div className="text-xs text-white/60">
              <InlineEditable
                path="footer.tagline"
                value={tagline}
                as="span"
                placeholder="Footer tagline…"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-5 text-xs">
          {nav.map((label, i) => (
            <a
              key={i}
              href={`#${label.toLowerCase().replace(/\s+/g, '-')}`}
              className="transition-colors hover:text-white"
            >
              <InlineEditable
                path={`navigation.${i}`}
                value={label}
                as="span"
                placeholder="Nav label…"
              />
            </a>
          ))}
        </div>

        <div className="flex flex-col items-start gap-3 md:items-end">
          {hasSocials ? (
            <div className="flex items-center gap-2">
              {socials.facebook ? (
                <SocialChip href={socials.facebook} label="Facebook">
                  <Facebook className="h-4 w-4" />
                </SocialChip>
              ) : null}
              {socials.instagram ? (
                <SocialChip href={socials.instagram} label="Instagram">
                  <Instagram className="h-4 w-4" />
                </SocialChip>
              ) : null}
              {socials.tiktok ? (
                <SocialChip href={socials.tiktok} label="TikTok">
                  <TikTokIcon />
                </SocialChip>
              ) : null}
              {socials.x ? (
                <SocialChip href={socials.x} label="X (Twitter)">
                  <XIcon />
                </SocialChip>
              ) : null}
              {socials.linkedin ? (
                <SocialChip href={socials.linkedin} label="LinkedIn">
                  <Linkedin className="h-4 w-4" />
                </SocialChip>
              ) : null}
              {socials.youtube ? (
                <SocialChip href={socials.youtube} label="YouTube">
                  <Youtube className="h-4 w-4" />
                </SocialChip>
              ) : null}
              {socials.google ? (
                <SocialChip href={socials.google} label="Google Business Profile">
                  <Globe className="h-4 w-4" />
                </SocialChip>
              ) : null}
            </div>
          ) : null}
          <div className="text-xs text-white/50">
            © {year} {businessName}. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
}

/** Circular social icon button. Neutral styling; works on any dark background. */
function SocialChip({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white/75 transition-colors hover:bg-white/20 hover:text-white"
      aria-label={label}
    >
      {children}
    </a>
  );
}

/** Filled TikTok glyph. Simple enough to avoid trademark concerns. */
function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.76 20.1a6.34 6.34 0 0 0 10.86-4.43V8.29a8.16 8.16 0 0 0 4.77 1.52V6.36a4.85 4.85 0 0 1-1.8-.34z" />
    </svg>
  );
}

/** Classic X (formerly Twitter) cross glyph. */
function XIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644z" />
    </svg>
  );
}
