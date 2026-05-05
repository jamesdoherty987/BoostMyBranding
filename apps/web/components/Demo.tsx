'use client';

import { useRef, type RefObject } from 'react';
import { motion } from 'framer-motion';
import { SectionWrapper, Badge, AnimatedBeam, NumberTicker } from '@boost/ui';
import { Lightbulb, PenLine, Wand2, BarChart3, type LucideIcon } from 'lucide-react';

interface Step {
  icon: LucideIcon;
  num: number;
  title: string;
  body: string;
  accent: string;
}

const STEPS: Step[] = [
  {
    icon: Lightbulb,
    num: 1,
    title: 'Learn your brand',
    body: 'We study your business, tone, and customers, then build your brand brief.',
    accent: '#48D886',
  },
  {
    icon: PenLine,
    num: 2,
    title: 'Write the month',
    body: 'Captions in your voice, best shots picked, full calendar planned.',
    accent: '#1D9CA1',
  },
  {
    icon: Wand2,
    num: 3,
    title: 'Polish and schedule',
    body: 'Every post is checked, edited, and queued for Instagram and TikTok.',
    accent: '#48D886',
  },
  {
    icon: BarChart3,
    num: 4,
    title: 'Publish and report',
    body: 'Posts go live on schedule. Friday summary of what shipped and how it performed.',
    accent: '#FFEC3D',
  },
];

export function Demo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = [
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
  ];

  return (
    <SectionWrapper id="how-it-works" className="py-14 md:py-28">
      <div className="mx-auto max-w-4xl px-4">
        <div className="text-center">
          <Badge tone="brand" className="mb-3 md:mb-4">
            How we work
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight md:text-5xl">
            You focus on your business.{' '}
            <span className="text-gradient-brand">We handle the rest.</span>
          </h2>
          <p className="mt-3 text-sm text-slate-600 md:mt-4 md:text-lg">
            No calls to schedule, no briefs to write, no posts to approve. We run the whole show.
          </p>
        </div>

        <div ref={containerRef} className="relative mt-10 md:mt-16">
          {/* Animated beams, desktop only */}
          <div className="hidden md:block">
            {nodeRefs.slice(0, -1).map((fromRef, i) => {
              const nextStep = STEPS[i + 1];
              if (!nextStep) return null;
              return (
                <AnimatedBeam
                  key={i}
                  containerRef={containerRef as RefObject<HTMLElement>}
                  fromRef={fromRef as RefObject<HTMLElement>}
                  toRef={nodeRefs[i + 1] as RefObject<HTMLElement>}
                  duration={3}
                  delay={i * 0.8}
                  pathColor="rgba(29,156,161,0.12)"
                  gradientStart={STEPS[i]!.accent}
                  gradientStop={nextStep.accent}
                  pathWidth={2}
                />
              );
            })}
          </div>

          <ol className="relative flex flex-col gap-0 md:flex-row md:gap-0 md:justify-between">
            {STEPS.map((s, i) => (
              <StepNode
                key={s.title}
                step={s}
                index={i}
                nodeRef={nodeRefs[i]!}
                isLast={i === STEPS.length - 1}
              />
            ))}
          </ol>
        </div>
      </div>
    </SectionWrapper>
  );
}

function StepNode({
  step,
  index,
  nodeRef,
  isLast,
}: {
  step: Step;
  index: number;
  nodeRef: RefObject<HTMLDivElement | null>;
  isLast: boolean;
}) {
  const Icon = step.icon;

  return (
    <motion.li
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="relative flex items-stretch md:flex-1 md:flex-col md:items-center md:text-center"
    >
      {/* Mobile: vertical line + node on the left, content on the right */}
      <div className="relative flex flex-col items-center">
        {/* Node */}
        <div
          ref={nodeRef}
          className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg transition-transform duration-200 hover:scale-110 md:h-16 md:w-16"
          style={{ background: `linear-gradient(135deg, ${step.accent}, #1D9CA1)` }}
        >
          <Icon className="h-5 w-5 md:h-7 md:w-7" />
        </div>

        {/* Mobile: vertical connector line */}
        {!isLast && (
          <div
            aria-hidden
            className="w-px flex-1 min-h-[2rem] md:hidden"
            style={{
              background: `linear-gradient(180deg, ${step.accent}80, ${step.accent}10)`,
            }}
          />
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 pb-6 pl-4 pt-1 md:mt-5 md:pb-0 md:pl-0 md:pt-0">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 + index * 0.1 }}
          className="mb-1 text-3xl font-black md:text-4xl"
          style={{ color: step.accent }}
        >
          <NumberTicker value={step.num} />
        </motion.div>
        <h3 className="text-sm font-bold text-slate-900 md:text-lg">{step.title}</h3>
        <p className="mt-0.5 text-xs text-slate-600 md:mt-1 md:text-sm">{step.body}</p>
      </div>
    </motion.li>
  );
}
