'use client';

import { useRef, type RefObject } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { SectionWrapper, Badge, AnimatedBeam } from '@boost/ui';
import { Upload, PenLine, Send, CalendarCheck, type LucideIcon } from 'lucide-react';

/**
 * How it works — vertical timeline with animated beams connecting each
 * step. Visually distinct from the feature card grid above.
 *
 * Desktop: horizontal timeline with beams flowing left-to-right.
 * Mobile: vertical timeline with a glowing line and staggered nodes.
 */
interface Step {
  icon: LucideIcon;
  title: string;
  body: string;
  who: 'You' | 'Us';
  accent: string;
}

const STEPS: Step[] = [
  {
    icon: Upload,
    title: 'Send us photos.',
    body: "10\u201315 from your phone every fortnight. That's all we need.",
    who: 'You',
    accent: '#48D886',
  },
  {
    icon: PenLine,
    title: 'We write the month.',
    body: 'Captions in your voice, best shots picked, calendar planned.',
    who: 'Us',
    accent: '#1D9CA1',
  },
  {
    icon: Send,
    title: 'You review & tweak.',
    body: 'Preview everything in the portal. Message us any changes.',
    who: 'You',
    accent: '#48D886',
  },
  {
    icon: CalendarCheck,
    title: 'We publish & report.',
    body: 'Posts go live on schedule. Friday summary of what shipped.',
    who: 'Us',
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
            You send the raw material.{' '}
            <span className="text-gradient-brand">We make it look great.</span>
          </h2>
          <p className="mt-3 text-sm text-slate-600 md:mt-4 md:text-lg">
            No calls to schedule, no briefs to write. Just drop photos and get back to work.
          </p>
        </div>

        {/* Timeline */}
        <div ref={containerRef} className="relative mt-10 md:mt-16">
          {/* Animated beams connecting nodes */}
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

          {/* Steps — vertical on mobile, horizontal on desktop */}
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

  /* 3D tilt on hover — follows cursor position within the card */
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [6, -6]), { stiffness: 200, damping: 20 });
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-6, 6]), { stiffness: 200, damping: 20 });

  const handleMouse = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - rect.left) / rect.width - 0.5);
    y.set((e.clientY - rect.top) / rect.height - 0.5);
  };
  const handleLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.li
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, delay: index * 0.12 }}
      className="relative flex items-start gap-4 md:flex-1 md:flex-col md:items-center md:text-center"
    >
      {/* Mobile: vertical connecting line */}
      {!isLast && (
        <div
          aria-hidden
          className="absolute left-[18px] top-12 h-[calc(100%+2rem-48px)] w-px md:hidden"
          style={{
            background: `linear-gradient(180deg, ${step.accent}, rgba(29,156,161,0.1))`,
          }}
        />
      )}

      {/* Node circle — the ref that AnimatedBeam connects to */}
      <div
        ref={nodeRef}
        className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg md:h-14 md:w-14"
        style={{
          background: `linear-gradient(135deg, ${step.accent}, #1D9CA1)`,
        }}
      >
        <Icon className="h-4 w-4 md:h-6 md:w-6" />
        {/* Step number badge */}
        <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[9px] font-bold text-slate-900 shadow-sm md:h-5 md:w-5 md:text-[10px]">
          {index + 1}
        </span>
      </div>

      {/* Content card with 3D tilt */}
      <motion.div
        onMouseMove={handleMouse}
        onMouseLeave={handleLeave}
        style={{ rotateX, rotateY, transformPerspective: 600 }}
        className="min-w-0 flex-1 md:mt-4"
      >
        <div className="flex items-center gap-1.5 md:justify-center">
          <span
            className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider md:px-2 md:text-[10px] ${
              step.who === 'You'
                ? 'bg-[#48D886]/15 text-emerald-700'
                : 'bg-[#1D9CA1]/15 text-teal-700'
            }`}
          >
            {step.who}
          </span>
        </div>
        <h3 className="mt-1 text-sm font-bold text-slate-900 md:mt-2 md:text-lg">
          {step.title}
        </h3>
        <p className="mt-0.5 text-xs text-slate-600 md:mt-1 md:text-sm">
          {step.body}
        </p>
      </motion.div>
    </motion.li>
  );
}
