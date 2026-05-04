'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { WebsiteConfig } from '@boost/core';
import { SectionWrapper } from '../../section-wrapper';
import { useSiteContext } from '../context';
import { InlineEditable } from '../InlineEditable';

interface SiteFAQProps {
  config: WebsiteConfig;
}

/**
 * Accessible single-open accordion. Uses controlled state instead of <details>
 * so the chevron animation stays in sync. Every question and answer is
 * inline-editable when the preview is in edit mode.
 */
export function SiteFAQ({ config }: SiteFAQProps) {
  const { embedded, editMode } = useSiteContext();
  const items = config.faq;
  const [open, setOpen] = useState<number | null>(0);
  if (!items || items.length === 0) return null;

  const variant = config.faqSection?.variant ?? 'accordion';

  return (
    <SectionWrapper immediate={embedded} id="faq" className="bg-slate-50 py-20 md:py-28">
      <div className={`mx-auto px-4 ${variant === 'grid' ? 'max-w-6xl' : 'max-w-3xl'}`}>
        <div className="text-center">
          <InlineEditable
            path="faqSection.eyebrow"
            value={config.faqSection?.eyebrow ?? 'FAQ'}
            as="p"
            className="text-xs font-semibold uppercase tracking-[0.25em]"
            style={{ color: 'var(--bmb-site-primary)' }}
            placeholder="Section eyebrow…"
          />
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-5xl">
            <InlineEditable
              path="faqSection.heading"
              value={config.faqSection?.heading ?? 'Questions, answered.'}
              as="span"
              placeholder="Section heading…"
            />
          </h2>
        </div>

        {variant === 'grid' ? (
          // 2-column grid: every answer visible. Great for quick skim on
          // service pages where visitors want to see all answers at once.
          <ul className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
            {items.map((item, i) => (
              <li
                key={i}
                className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6"
              >
                <InlineEditable
                  path={`faq.${i}.question`}
                  value={item.question}
                  as="h3"
                  className="text-sm font-semibold text-slate-900 md:text-base"
                  placeholder="Question…"
                />
                <InlineEditable
                  path={`faq.${i}.answer`}
                  value={item.answer}
                  as="p"
                  multiline
                  className="mt-2 text-sm text-slate-600 md:text-base"
                  placeholder="Answer…"
                />
              </li>
            ))}
          </ul>
        ) : (
          // Default accordion: space-efficient, single-open.
          <ul className="mt-10 space-y-3">
            {items.map((item, i) => {
              const isOpen = open === i || editMode;
              const panelId = `faq-panel-${i}`;
              const buttonId = `faq-button-${i}`;
              return (
                <li
                  key={i}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
                >
                  <button
                    id={buttonId}
                    type="button"
                    onClick={() => {
                      if (editMode) return;
                      setOpen(isOpen ? null : i);
                    }}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                  >
                    <InlineEditable
                      path={`faq.${i}.question`}
                      value={item.question}
                      as="span"
                      className="text-sm font-semibold text-slate-900 md:text-base"
                      placeholder="Question…"
                    />
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={buttonId}
                    aria-hidden={!isOpen}
                    className={`grid transition-[grid-template-rows] duration-300 ${
                      isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <InlineEditable
                        path={`faq.${i}.answer`}
                        value={item.answer}
                        as="p"
                        multiline
                        className="px-5 pb-5 text-sm text-slate-600 md:text-base"
                        placeholder="Answer…"
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </SectionWrapper>
  );
}
