/**
 * Server-side video rendering. Bundles the React compositions with
 * Remotion's bundler, then renders the chosen template to an MP4 file.
 *
 * Called from the API when a post needs a video. The resulting MP4 path
 * should be uploaded to R2 and attached to the post record.
 *
 * Requires Chromium/Chrome on the host (bundled with @remotion/renderer
 * via @remotion/browser). On Render/Railway this works out of the box.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { getTemplate } from './templates';
import type { VideoProps } from './types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Cache the bundled Remotion project across calls — bundling takes ~5s. */
let bundleCache: string | null = null;

async function getBundle(): Promise<string> {
  if (bundleCache) return bundleCache;
  bundleCache = await bundle({
    entryPoint: path.join(__dirname, 'index.ts'),
    webpackOverride: (config) => config,
  });
  return bundleCache;
}

export interface RenderArgs {
  templateId: string;
  props: VideoProps;
  /** Local filesystem output path for the MP4. */
  outputPath: string;
  /** Override the default duration. Use with care — most templates are built for their natural duration. */
  durationFrames?: number;
}

export interface RenderResult {
  outputPath: string;
  durationFrames: number;
  templateId: string;
}

/**
 * Render a single video. Returns the local path to the MP4.
 *
 * Typical usage (from the API):
 *   const result = await renderVideo({
 *     templateId: 'liquid-blob',
 *     props: { businessName: 'Verde Cafe', headline: 'Opening soon.', ... brand },
 *     outputPath: '/tmp/video-123.mp4',
 *   });
 *   // then upload result.outputPath to R2
 */
export async function renderVideo(args: RenderArgs): Promise<RenderResult> {
  const template = getTemplate(args.templateId);
  if (!template) {
    throw new Error(`Unknown video template: ${args.templateId}`);
  }

  const serveUrl = await getBundle();

  const composition = await selectComposition({
    serveUrl,
    id: args.templateId,
    inputProps: args.props as unknown as Record<string, unknown>,
  });

  const durationFrames = args.durationFrames ?? template.meta.durationFrames;

  await renderMedia({
    composition: {
      ...composition,
      durationInFrames: durationFrames,
    },
    serveUrl,
    codec: 'h264',
    outputLocation: args.outputPath,
    inputProps: args.props as unknown as Record<string, unknown>,
  });

  return {
    outputPath: args.outputPath,
    durationFrames,
    templateId: args.templateId,
  };
}
