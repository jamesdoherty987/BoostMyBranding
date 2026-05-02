/**
 * Remotion Root — registers every template as a composition so you can
 * preview them in the Remotion Studio (`pnpm --filter @boost/video studio`).
 *
 * Each composition uses sample props; the real props come from the
 * render() function in render.ts when generating videos for clients.
 */

import React from 'react';
import { registerRoot, Composition } from 'remotion';
import { TEMPLATES } from './templates';
import { DEFAULT_BRAND, VIDEO_CONFIG } from './types';
import type { VideoProps } from './types';

const SAMPLE_PROPS: VideoProps = {
  businessName: 'Verde Cafe',
  headline: 'Coffee, slowly.',
  subheadline: 'Small-batch · single origin',
  cta: 'Book a tasting',
  domain: 'verdecafe.com',
  brand: DEFAULT_BRAND,
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {Object.values(TEMPLATES).map(({ meta, Component }) => (
        <Composition
          key={meta.id}
          id={meta.id}
          component={Component as unknown as React.ComponentType<Record<string, unknown>>}
          durationInFrames={meta.durationFrames}
          fps={VIDEO_CONFIG.fps}
          width={VIDEO_CONFIG.width}
          height={VIDEO_CONFIG.height}
          defaultProps={SAMPLE_PROPS as unknown as Record<string, unknown>}
        />
      ))}
    </>
  );
};

registerRoot(RemotionRoot);
