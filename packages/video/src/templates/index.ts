import type { FC } from 'react';
import type { VideoProps } from '../types';

import { LiquidBlob, LiquidBlobMeta } from './LiquidBlob';
import { ProductShowcase, ProductShowcaseMeta } from './ProductShowcase';
import { Aurora, AuroraMeta } from './Aurora';
import { GlitchArt, GlitchArtMeta } from './GlitchArt';
import { HoloFoil, HoloFoilMeta } from './HoloFoil';

export interface TemplateMeta {
  id: string;
  name: string;
  description: string;
  durationFrames: number;
  usesImage: boolean;
  bestFor: readonly string[];
}

export interface TemplateDef {
  meta: TemplateMeta;
  Component: FC<VideoProps>;
}

export const TEMPLATES: Record<string, TemplateDef> = {
  'liquid-blob': { meta: LiquidBlobMeta, Component: LiquidBlob },
  'product-showcase': { meta: ProductShowcaseMeta, Component: ProductShowcase },
  'aurora': { meta: AuroraMeta, Component: Aurora },
  'glitch-art': { meta: GlitchArtMeta, Component: GlitchArt },
  'holo-foil': { meta: HoloFoilMeta, Component: HoloFoil },
};

export function getTemplate(id: string): TemplateDef | undefined {
  return TEMPLATES[id];
}

export function listTemplates(): TemplateMeta[] {
  return Object.values(TEMPLATES).map((t) => t.meta);
}

export { LiquidBlob, ProductShowcase, Aurora, GlitchArt, HoloFoil };
