'use client';

/**
 * Expandable services. A grid of compact cards — click any one and it
 * opens a modal with the full description. Great when services have
 * longer explanations, or for showing before/after of treatments.
 *
 * Uses Aceternity's animated-modal primitives. Each service gets its
 * own modal instance triggered by the card click.
 */

import type { WebsiteConfig } from '@boost/core';
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalTrigger,
} from '../../../aceternity/ui/animated-modal';
import { resolveIcon } from '../../icon-map';
import { InlineEditable } from '../../InlineEditable';

interface ServicesExpandableProps {
  config: WebsiteConfig;
}

export function ServicesExpandable({ config }: ServicesExpandableProps) {
  const services = config.services ?? [];
  if (services.length === 0) return null;

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 md:grid-cols-3">
      {services.map((s, i) => {
        const Icon = resolveIcon(s.icon);
        return (
          <Modal key={`${s.title}-${i}`}>
            <ModalTrigger className="group flex w-full flex-col items-start rounded-3xl border border-slate-200 bg-white p-6 text-left transition-all hover:-translate-y-1 hover:shadow-xl">
              <div
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-white"
                style={{ background: 'var(--bmb-site-primary)' }}
              >
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">
                {s.title}
              </h3>
              <p className="mt-2 line-clamp-2 text-sm text-slate-600">
                {s.description}
              </p>
              <span className="mt-4 text-xs font-medium text-[color:var(--bmb-site-primary)]">
                Read more &rarr;
              </span>
            </ModalTrigger>
            <ModalBody>
              <ModalContent>
                <div
                  className="inline-flex h-12 w-12 items-center justify-center rounded-2xl text-white"
                  style={{ background: 'var(--bmb-site-primary)' }}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <h4 className="mt-5 text-2xl font-bold text-slate-900">
                  <InlineEditable
                    path={`services.${i}.title`}
                    value={s.title}
                    as="span"
                    placeholder="Service title"
                  />
                </h4>
                <p className="mt-3 text-base leading-relaxed text-slate-700">
                  <InlineEditable
                    path={`services.${i}.description`}
                    value={s.description}
                    as="span"
                    multiline
                    placeholder="Full description…"
                  />
                </p>
              </ModalContent>
            </ModalBody>
          </Modal>
        );
      })}
    </div>
  );
}
