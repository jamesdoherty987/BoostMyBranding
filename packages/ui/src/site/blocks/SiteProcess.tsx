'use client';

import { motion } from 'framer-motion';
import type { WebsiteConfig } from '@boost/core';
import { SectionWrapper } from '../../section-wrapper';
import { useSiteContext } from '../context';
import { resolveIcon } from '../icon-map';
import { InlineEditable } from '../InlineEditable';
import { ProcessTimeline } from './process';

interface SiteProcessProps {
  config: WebsiteConfig;
}

/**
 * "How it works" section. Dispatches to one of two layouts:
 *   - numbered (default): 4-col numbered steps with connecting line
 *   - timeline: Aceternity vertical timeline that draws as you scroll
 *
 * Both layouts share the same eyebrow/heading header.
 */
export function SiteProcess({ config }: SiteProcessProps) {
  const { embedded } = useSiteContext();
  const p = config.process;
  if (!p || !p.steps || p.steps.length === 0) return null;

  const variant = p.variant ?? 'numbered';

  return (
    <SectionWrapper
      immediate={embedded}
      id="process"
      className="bg-slate-50 py-20 md:py-28"
    >
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <InlineEditable
            path="process.eyebrow"
            value={p.eyebrow ?? 'How it works'}
            as="p"
            className="text-xs font-semibold uppercase tracking-[0.25em]"
            style={{ color: 'var(--bmb-site-primary)' }}
            placeholder="Section eyebrow…"
          />
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-5xl">
            <InlineEditable
              path="process.heading"
              value={p.heading ?? 'Simple, every time.'}
              as="span"
              placeholder="Section heading…"
            />
          </h2>
        </div>

        {variant === 'timeline' ? (
          <div className="mt-12">
            <ProcessTimeline config={config} />
          </div>
        ) : (
          <ol className="relative mt-12 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
            {/* Connecting line — decorative, only on desktop */}
            <div
              aria-hidden
              className="pointer-events-none absolute left-6 top-6 hidden h-px w-[calc(100%-3rem)] lg:block"
              style={{
                background: `linear-gradient(90deg, transparent 0%, var(--bmb-site-primary) 30%, var(--bmb-site-primary) 70%, transparent 100%)`,
                opacity: 0.2,
              }}
            />

            {p.steps.map((step, i) => {
              const Icon = step.icon ? resolveIcon(step.icon) : null;
              return (
                <motion.li
                  key={i}
                  initial={embedded ? false : { opacity: 0, y: 16 }}
                  whileInView={embedded ? undefined : { opacity: 1, y: 0 }}
                  animate={embedded ? { opacity: 1, y: 0 } : undefined}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ delay: i * 0.08, duration: 0.5 }}
                  className="relative"
                >
                  <div
                    className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold text-white shadow-lg"
                    style={{ background: 'var(--bmb-site-primary)' }}
                  >
                    {Icon ? <Icon className="h-5 w-5" /> : <span>{i + 1}</span>}
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-slate-900">
                    <InlineEditable
                      path={`process.steps.${i}.title`}
                      value={step.title}
                      as="span"
                      placeholder="Step title…"
                    />
                  </h3>
                  {step.description ? (
                    <p className="mt-1 text-sm text-slate-600">
                      <InlineEditable
                        path={`process.steps.${i}.description`}
                        value={step.description}
                        as="span"
                        multiline
                        placeholder="One or two sentences…"
                      />
                    </p>
                  ) : null}
                </motion.li>
              );
            })}
          </ol>
        )}

        {p.footnote ? (
          <p className="mt-10 text-center text-xs italic text-slate-500">
            <InlineEditable
              path="process.footnote"
              value={p.footnote}
              as="span"
              placeholder="Optional note…"
            />
          </p>
        ) : null}
      </div>
    </SectionWrapper>
  );
}
