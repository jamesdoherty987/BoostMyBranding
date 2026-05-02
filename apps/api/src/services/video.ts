/**
 * Video generation service. Wraps the Remotion render call with R2 upload
 * so the API just returns a public URL.
 *
 * Runs in-process. Rendering a 12-15s 1080x1920 video takes 10-30 seconds
 * of CPU time. For production you might want to move this to a queue
 * (BullMQ) but for now we render synchronously.
 */

import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { renderVideo, listTemplates, getTemplate, DEFAULT_BRAND } from '@boost/video';
import type { VideoProps, BrandPalette } from '@boost/video';
import { uploadFile } from './r2.js';
import { features } from '../env.js';

export interface GenerateVideoArgs {
  templateId: string;
  businessName: string;
  headline: string;
  subheadline?: string;
  cta?: string;
  domain?: string;
  brand?: Partial<BrandPalette>;
  imageUrl?: string;
  /** Client id — used to scope the R2 upload path. */
  clientId: string;
}

export interface GenerateVideoResult {
  videoUrl: string;
  templateId: string;
  templateName: string;
  durationSeconds: number;
  fromMock?: boolean;
}

export async function generateVideo(args: GenerateVideoArgs): Promise<GenerateVideoResult> {
  const template = getTemplate(args.templateId);
  if (!template) {
    throw new Error(`Unknown template: ${args.templateId}. Available: ${listTemplates().map((t) => t.id).join(', ')}`);
  }

  const props: VideoProps = {
    businessName: args.businessName,
    headline: args.headline,
    subheadline: args.subheadline,
    cta: args.cta,
    domain: args.domain,
    brand: { ...DEFAULT_BRAND, ...args.brand },
    imageUrl: args.imageUrl,
  };

  // Render to a temp file
  const tmpPath = path.join(tmpdir(), `${randomUUID()}.mp4`);

  try {
    await renderVideo({
      templateId: args.templateId,
      props,
      outputPath: tmpPath,
    });

    // Upload to R2 (or local disk in dev) via the existing uploadFile helper
    const buffer = await readFile(tmpPath);
    const { url } = await uploadFile(
      args.clientId,
      buffer,
      `${args.templateId}-${Date.now()}.mp4`,
      'video/mp4',
    );

    return {
      videoUrl: url,
      templateId: args.templateId,
      templateName: template.meta.name,
      durationSeconds: template.meta.durationFrames / 30,
      fromMock: !features.r2,
    };
  } finally {
    // Clean up temp file
    await unlink(tmpPath).catch(() => {});
  }
}

export function listVideoTemplates() {
  return listTemplates();
}
