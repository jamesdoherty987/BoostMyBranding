'use client';

import { useRef } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { AnimatedBeam, SectionWrapper, LogoPng } from '@boost/ui';
import { Instagram, Facebook, Linkedin, Music2, Twitter, Cloud, Pin } from 'lucide-react';

/**
 * "How we connect" section. Seven animated beams converge from platform
 * icons into our rocket hub, then fan out to the approved / published cards.
 */
export function Integrations() {
  const container = useRef<HTMLDivElement>(null);
  const hub = useRef<HTMLDivElement>(null);
  const ig = useRef<HTMLDivElement>(null);
  const fb = useRef<HTMLDivElement>(null);
  const li = useRef<HTMLDivElement>(null);
  const tt = useRef<HTMLDivElement>(null);
  const x = useRef<HTMLDivElement>(null);
  const bs = useRef<HTMLDivElement>(null);
  const pn = useRef<HTMLDivElement>(null);

  return (
    <SectionWrapper className="py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-4xl font-bold tracking-tight md:text-5xl">
            Plug in once. <span className="text-gradient-brand">Publish everywhere.</span>
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            Connect your accounts through ContentStudio. We handle the rest.
          </p>
        </div>

        <div
          ref={container}
          className="relative mx-auto mt-16 flex w-full max-w-3xl items-center justify-between px-2 md:h-[380px] md:px-8"
          aria-hidden
        >
          {/* Left column — platforms in */}
          <div className="flex flex-col gap-5 md:gap-7">
            <IconDot refEl={ig} bg="from-[#E1306C] to-[#F77737]">
              <Instagram className="h-5 w-5 text-white" />
            </IconDot>
            <IconDot refEl={fb} bg="from-[#1877F2] to-[#0A66C2]">
              <Facebook className="h-5 w-5 text-white" />
            </IconDot>
            <IconDot refEl={li} bg="from-[#0A66C2] to-[#004182]">
              <Linkedin className="h-5 w-5 text-white" />
            </IconDot>
            <IconDot refEl={tt} bg="from-black to-[#69C9D0]">
              <Music2 className="h-5 w-5 text-white" />
            </IconDot>
          </div>

          {/* Center hub — our rocket */}
          <div
            ref={hub}
            className="relative z-10 flex h-20 w-20 items-center justify-center rounded-3xl border border-slate-200 bg-white shadow-xl md:h-28 md:w-28"
          >
            <LogoPng size={40} />
          </div>

          {/* Right column — platforms out */}
          <div className="flex flex-col gap-5 md:gap-7">
            <IconDot refEl={x} bg="from-slate-900 to-slate-700">
              <Twitter className="h-5 w-5 text-white" />
            </IconDot>
            <IconDot refEl={bs} bg="from-[#0085FF] to-[#00A8E8]">
              <Cloud className="h-5 w-5 text-white" />
            </IconDot>
            <IconDot refEl={pn} bg="from-[#E60023] to-[#BD081C]">
              <Pin className="h-5 w-5 text-white" />
            </IconDot>
          </div>

          {/* Beams */}
          <AnimatedBeam containerRef={container} fromRef={ig} toRef={hub} delay={0.1} />
          <AnimatedBeam containerRef={container} fromRef={fb} toRef={hub} delay={0.3} />
          <AnimatedBeam containerRef={container} fromRef={li} toRef={hub} delay={0.5} />
          <AnimatedBeam containerRef={container} fromRef={tt} toRef={hub} delay={0.7} />
          <AnimatedBeam containerRef={container} fromRef={hub} toRef={x} delay={0.2} reverse />
          <AnimatedBeam containerRef={container} fromRef={hub} toRef={bs} delay={0.4} reverse />
          <AnimatedBeam containerRef={container} fromRef={hub} toRef={pn} delay={0.6} reverse />
        </div>

        {/* Sample posts arriving */}
        <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { seed: 'int-1', label: 'Instagram' },
            { seed: 'int-2', label: 'LinkedIn' },
            { seed: 'int-3', label: 'TikTok' },
            { seed: 'int-4', label: 'Pinterest' },
          ].map((p, i) => (
            <motion.div
              key={p.seed}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="relative aspect-square">
                <Image
                  src={`https://picsum.photos/seed/${p.seed}/400/400`}
                  alt=""
                  fill
                  className="object-cover"
                  unoptimized
                />
                <div className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">
                  {p.label}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </SectionWrapper>
  );
}

function IconDot({
  refEl,
  bg,
  children,
}: {
  refEl: React.RefObject<HTMLDivElement | null>;
  bg: string;
  children: React.ReactNode;
}) {
  return (
    <div
      ref={refEl}
      className={`flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br shadow-md md:h-14 md:w-14 ${bg}`}
    >
      {children}
    </div>
  );
}
