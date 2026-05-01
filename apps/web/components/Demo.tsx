'use client';

import { useRef, type RefObject } from 'react';
import { motion } from 'framer-motion';
import { SectionWrapper, Badge, AnimatedBeam } from '@boost/ui';
import { Upload, PenLine, Send, CalendarCheck, type LucideIcon } from 'lucide-react';

interface Step {
  icon: LucideIcon;
  title: string;
  body: string;
  accent: string;
}

const STEPS: Step[] = [
  {
    icon: Upload,
    title: 'We learn your brand.',
    body: "We study your business, your tone, and your customers. Then we get to work.",
    accent: '#48D886',
  },
  {
    icon: PenLine,
    title: 'We write the month.',
    body: 'Captions in your voice, best shots picked, calendar planned.',
    accent: '#1D9CA1',
  },
  {
    icon: Send,
    title: 'We handle the rest.',
    body: 'Every post is checked, polished, and scheduled. You never have to lift a finger.',
    accent: '#48D886',
  },
  {
    icon: CalendarCheck,
    title: 'We publish & report.',
    body: 'Posts go live on schedule. Friday summary of what shipped.',
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
          {/* Beams — desktop only to avoid scroll listeners on mobile */}
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
                  pathColor="rgba(29,156,161,0.15)"
                  gradientStart={STEPS[i]!.accent}
                  gradientStop={nextStep.accent}
                  pathWidth={2}
                />
              );
            })}
          </div>

          <ol className="relative flex flex-col gap-8 md:flex-row md:gap-0 md:justify-between">
            {STEPS.map((s, i) => (
              <TimelineNode
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

function TimelineNode({
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
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, delay: index * 0.12 }}
      className="relative flex items-start gap-4 md:flex-1 md:flex-col md:items-center md:text-center"
    >
      {!isLast && (
        <div
          aria-hidden
          className="absolute left-[18px] top-12 h-[calc(100%+2rem-48px)] w-px md:hidden"
          style={{
            background: `linear-gradient(180deg, ${step.accent}, rgba(29,156,161,0.1))`,
          }}
        />
      )}

      <div
        ref={nodeRef}
        className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg transition-transform duration-200 hover:scale-110 md:h-14 md:w-14"
        style={{
          background: `linear-gradient(135deg, ${step.accent}, #1D9CA1)`,
        }}
      >
        <Icon className="h-4 w-4 md:h-6 md:w-6" />
        <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[9px] font-bold text-slate-900 shadow-sm md:h-5 md:w-5 md:text-[10px]">
          {index + 1}
        </span>
      </div>

      <div className="min-w-0 flex-1 md:mt-4">
        <h3 className="mt-1 text-sm font-bold text-slate-900 md:mt-2 md:text-lg">
          {step.title}
        </h3>
        <p className="mt-0.5 text-xs text-slate-600 md:mt-1 md:text-sm">
          {step.body}
        </p>
      </div>
    </motion.li>
  );
}
