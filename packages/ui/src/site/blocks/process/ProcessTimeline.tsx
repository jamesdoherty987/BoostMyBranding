'use client';

/**
 * Vertical timeline "how we work". Uses Aceternity's Timeline primitive
 * — as visitors scroll, a drawn line progresses past each step. Good
 * for project-based service businesses (agencies, builders,
 * consultants) that want to convey a considered workflow.
 */

import type { WebsiteConfig } from '@boost/core';
import { Timeline } from '../../../aceternity/ui/timeline';

interface ProcessTimelineProps {
  config: WebsiteConfig;
}

export function ProcessTimeline({ config }: ProcessTimelineProps) {
  const steps = config.process?.steps ?? [];
  if (steps.length === 0) return null;

  const data = steps.map((s) => ({
    title: s.title,
    content: (
      <div>
        {s.description ? (
          <p className="text-sm text-slate-700 md:text-base">{s.description}</p>
        ) : null}
      </div>
    ),
  }));

  return (
    <div className="w-full">
      <Timeline data={data} />
    </div>
  );
}
