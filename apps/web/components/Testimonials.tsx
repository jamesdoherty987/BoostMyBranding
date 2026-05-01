'use client';

import { motion } from 'framer-motion';
import { SectionWrapper } from '@boost/ui';
import { Star } from 'lucide-react';

const quotes = [
  {
    text: 'We went from "I need to post something" stress to a fully booked calendar. Best money we spend.',
    name: 'Sean Murphy',
    role: 'Owner, Murphy\'s Plumbing',
  },
  {
    text: 'The approval workflow is genius. 5 minutes on Sunday and our whole week is live.',
    name: 'Nora Kelly',
    role: 'Founder, Atlas Fitness',
  },
  {
    text: 'Website + social for one price and it actually looks great. Our bookings doubled in 2 months.',
    name: 'Luca Romano',
    role: 'Owner, Verde Cafe',
  },
];

export function Testimonials() {
  return (
    <SectionWrapper className="bg-slate-50 py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-4xl font-bold tracking-tight md:text-5xl">
            Loved by <span className="text-gradient-brand">local businesses</span>
          </h2>
        </div>
        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
          {quotes.map((q, i) => (
            <motion.blockquote
              key={q.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, delay: i * 0.08 }}
              className="rounded-3xl border border-slate-200 bg-white p-6"
            >
              <div className="flex gap-1 text-[#FFEC3D]">
                {Array.from({ length: 5 }).map((_, idx) => (
                  <Star key={idx} className="h-4 w-4 fill-current" />
                ))}
              </div>
              <p className="mt-4 text-slate-800">&ldquo;{q.text}&rdquo;</p>
              <footer className="mt-6 text-sm">
                <div className="font-semibold text-slate-900">{q.name}</div>
                <div className="text-slate-500">{q.role}</div>
              </footer>
            </motion.blockquote>
          ))}
        </div>
      </div>
    </SectionWrapper>
  );
}
