"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

export function TestimonialsWithCarousel() {
  const itemsPerPage = 3;
  const totalPages = Math.ceil(testimonials.length / itemsPerPage);
  const [currentPage, setCurrentPage] = useState(0);

  const visibleTestimonials = useMemo(() => {
    const start = currentPage * itemsPerPage;
    return testimonials.slice(start, start + itemsPerPage);
  }, [currentPage]);

  const handleNext = () => {
    setCurrentPage((prev) => (prev + 1) % totalPages);
  };

  const handlePrevious = () => {
    setCurrentPage((prev) => (prev - 1 + totalPages) % totalPages);
  };

  return (
    <section>
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-8 md:py-20">
        <p className="neutral-500 font-mono text-lg dark:text-neutral-400">
          Testimonials
        </p>
        <div className="mt-4 flex items-center justify-between gap-4">
          <h2 className="text-2xl font-medium tracking-tight text-black md:text-4xl lg:text-5xl dark:text-white">
            People love us, you know.
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Previous testimonials"
              onClick={handlePrevious}
              className="flex size-10 items-center justify-center rounded-full border border-black/15 text-black transition duration-200 hover:bg-black/5 active:scale-98 dark:border-white/20 dark:text-white dark:hover:bg-white/10"
            >
              <svg
                aria-hidden
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                className="size-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
            <button
              type="button"
              aria-label="Next testimonials"
              onClick={handleNext}
              className="flex size-10 items-center justify-center rounded-full border border-black/15 text-black transition duration-200 hover:bg-black/5 active:scale-98 dark:border-white/20 dark:text-white dark:hover:bg-white/10"
            >
              <svg
                aria-hidden
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                className="size-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
          </div>
        </div>
        <div className="mt-8 grid gap-4 md:mt-12 md:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {visibleTestimonials.map((testimonial, index) => (
              <motion.div
                initial={{
                  opacity: 0,
                  y: 10,
                  filter: "blur(10px)",
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                  filter: "blur(0px)",
                }}
                exit={{
                  opacity: 0,
                  y: 10,
                  filter: "blur(10px)",
                }}
                transition={{
                  duration: 0.5,
                  delay: index * 0.1,
                }}
                key={testimonial.name}
                className="flex h-full flex-col justify-between rounded-lg bg-white p-4 shadow-sm ring-1 shadow-black/10 ring-black/10 md:p-6 dark:bg-neutral-900 dark:shadow-white/10 dark:ring-white/5"
              >
                <p className="text-base text-neutral-700 sm:text-2xl dark:text-neutral-300">
                  {testimonial.quote}
                </p>
                <div className="mt-14 flex items-center gap-3">
                  <img
                    src={testimonial.src}
                    alt={testimonial.name}
                    width={40}
                    height={40}
                    className="size-8 shrink-0 rounded-full object-cover"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-black dark:text-white">
                      {testimonial.name}
                    </span>
                    {testimonial.designation && (
                      <span className="text-xs text-neutral-500 dark:text-neutral-400">
                        {testimonial.designation}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

interface Testimonial {
  src: string;
  quote: string;
  name: string;
  designation?: string;
}

export const testimonials: Testimonial[] = [
  {
    name: "Manu Arora",
    quote:
      "What a fantastic AI Proactiv AI is, I just love it. It has completely transformed how I approach problems.",
    src: "https://assets.aceternity.com/avatars/1.webp",
    designation: "Tech Innovator & Entrepreneur",
  },
  {
    name: "Tyler Durden",
    quote:
      "I made a soap with the help of AI, it was so easy to use. Highly recommend it to anyone looking to create.",
    src: "https://assets.aceternity.com/avatars/2.webp",
    designation: "Creative Director & Business Owner",
  },
  {
    name: "Alice Johnson",
    quote:
      "This AI has transformed the way I work! It's like having a brilliant assistant who knows what I need.",
    src: "https://assets.aceternity.com/avatars/3.webp",
    designation: "Senior Software Engineer",
  },
  {
    name: "Bob Smith",
    quote:
      "Absolutely revolutionary, a game-changer for our industry. It has exceeded all of our expectations so far.",
    src: "https://assets.aceternity.com/avatars/4.webp",
    designation: "Industry Analyst",
  },
  {
    name: "Cathy Lee",
    quote:
      "I can't imagine going back to how things were before this AI. It's become essential to our daily workflow.",
    src: "https://assets.aceternity.com/avatars/5.webp",
    designation: "Product Manager",
  },
  {
    name: "David Wright",
    quote:
      "It's like having a superpower! This AI tool has given us abilities we never thought were possible before.",
    src: "https://assets.aceternity.com/avatars/6.webp",
    designation: "Research Scientist",
  },
  {
    name: "Eva Green",
    quote:
      "The efficiency it brings is unmatched. It's a vital tool that has helped us cut costs significantly.",
    src: "https://assets.aceternity.com/avatars/7.webp",
    designation: "Operations Director",
  },
  {
    name: "Frank Moore",
    quote:
      "A robust solution that fits perfectly into our workflow. It has enhanced our team's capabilities greatly.",
    src: "https://assets.aceternity.com/avatars/8.webp",
    designation: "Project Manager",
  },
  {
    name: "Grace Hall",
    quote:
      "It's incredibly intuitive and easy to use. Even non-technical users can leverage its power effectively.",
    src: "https://assets.aceternity.com/avatars/9.webp",
    designation: "Marketing Specialist",
  },
  {
    name: "Henry Ford",
    quote:
      "It has saved us countless hours. Highly recommended for anyone looking to enhance their productivity.",
    src: "https://assets.aceternity.com/avatars/10.webp",
    designation: "Operations Analyst",
  },
  {
    name: "Ivy Wilson",
    quote:
      "A must-have tool for any professional. It's revolutionized how we approach problem-solving every day.",
    src: "https://assets.aceternity.com/avatars/11.webp",
    designation: "Business Consultant",
  },
  {
    name: "Jack Brown",
    quote:
      "The results are always impressive. This AI has helped us not only meet but exceed our targets.",
    src: "https://assets.aceternity.com/avatars/12.webp",
    designation: "Performance Manager",
  },
];
