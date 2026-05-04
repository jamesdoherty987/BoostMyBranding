'use client';

/**
 * 3D tilt services. Uses Aceternity's CardContainer/CardBody/CardItem
 * primitives so each service card tilts on mouse move with depth —
 * icon, title, and description each translate at slightly different Z
 * so the effect feels real. Great for modern brands, agencies, tech.
 */

import type { WebsiteConfig } from '@boost/core';
import {
  CardContainer,
  CardBody,
  CardItem,
} from '../../../aceternity/ui/3d-card';
import { resolveIcon } from '../../icon-map';
import { InlineEditable } from '../../InlineEditable';

interface Services3dCardsProps {
  config: WebsiteConfig;
}

export function Services3dCards({ config }: Services3dCardsProps) {
  const services = config.services ?? [];
  if (services.length === 0) return null;

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 md:grid-cols-3">
      {services.map((s, i) => {
        const Icon = resolveIcon(s.icon);
        return (
          <CardContainer key={`${s.title}-${i}`} containerClassName="py-0">
            <CardBody className="group/card relative h-auto w-full rounded-3xl border border-slate-200 bg-white p-6">
              <CardItem translateZ={30}>
                <div
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-white"
                  style={{ background: 'var(--bmb-site-primary)' }}
                >
                  <Icon className="h-5 w-5" />
                </div>
              </CardItem>
              <CardItem translateZ={50} className="mt-4 text-lg font-semibold text-slate-900">
                <InlineEditable
                  path={`services.${i}.title`}
                  value={s.title}
                  as="span"
                  placeholder="Service title"
                />
              </CardItem>
              <CardItem
                as="p"
                translateZ={20}
                className="mt-2 text-sm text-slate-600"
              >
                <InlineEditable
                  path={`services.${i}.description`}
                  value={s.description}
                  as="span"
                  multiline
                  placeholder="One or two sentences…"
                />
              </CardItem>
            </CardBody>
          </CardContainer>
        );
      })}
    </div>
  );
}
