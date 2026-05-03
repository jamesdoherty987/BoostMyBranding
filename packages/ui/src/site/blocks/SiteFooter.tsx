'use client';

import type { WebsiteConfig } from '@boost/core';
import { InlineEditable } from '../InlineEditable';

interface SiteFooterProps {
  config: WebsiteConfig;
  businessName: string;
}

/**
 * Dark footer strip. The tagline under the business name is inline-editable
 * (defaulting to the brand tagline when a footer-specific one isn't set) and
 * the nav labels are individually editable when edit mode is on.
 */
export function SiteFooter({ config, businessName }: SiteFooterProps) {
  const year = new Date().getFullYear();
  const nav = config.navigation ?? ['Services', 'About', 'Contact'];
  const tagline = config.footer?.tagline ?? config.brand.tagline ?? '';
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
        <div className="text-xs text-white/50">
          © {year} {businessName}. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
