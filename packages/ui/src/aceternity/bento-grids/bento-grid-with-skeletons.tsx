"use client";
import React from "react";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import {
  IconMicrophoneOff,
  IconPointerFilled,
  IconVolume2,
} from "@tabler/icons-react";
import Marquee from "react-fast-marquee";

export function BentoGridWithSkeletons() {
  const features = [
    {
      title: "Accountability",
      description:
        "Stay committed to your DSA journey with regular check-ins and community support to keep you on track.",
      skeleton: <Accountability />,
      className: "",
    },
    {
      title: "Encouragement",
      description:
        "Get motivated by peers and mentors when things get tough. Stay on track and don't give up!",
      skeleton: <Encouragement />,
      className: "",
    },
    {
      title: "Peer Groups in Same Boat",
      description:
        "Learn alongside others facing the same challenges and goals. You're not alone in this journey!",
      skeleton: <PeerGroup />,
      className: "",
    },
    {
      title: "Mentorship",
      description:
        "Get guidance from experienced engineers who've been there and cleared top tech interviews.",
      skeleton: <Mentorship />,
      className: "",
    },
    {
      title: "Doubt Clearing Hangouts",
      description:
        "Ask questions and clear doubts in live interactive sessions. No question is too small!",
      skeleton: <DoubtClearing />,
      className: "",
    },
    {
      title: "Progress Tracking & Reminders",
      description:
        "Stay on track with automated progress tracking and helpful reminders to keep you consistent.",
      skeleton: <ProgressTracking />,
      className: "",
    },
  ];
  return (
    <section
      id="features"
      className="mx-auto max-w-7xl px-4 py-10 md:py-24 lg:py-32"
    >
      <div className="flex flex-col items-center justify-center font-sans">
        <h2 className="text-2xl font-bold tracking-tight text-neutral-700 md:text-4xl">
          Why choose us over others?
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-lg text-neutral-600">
          More than just coding practice - get mentorship, peer support, and
          everything you need to ace your tech interviews.
        </p>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-4 md:mt-20 md:grid-cols-3">
        {features.map((feature) => (
          <Card key={feature.title} className={feature.className as string}>
            <CardSkeleton>{feature.skeleton}</CardSkeleton>
            <CardTitle>{feature.title}</CardTitle>
            <CardDescription>{feature.description}</CardDescription>
          </Card>
        ))}
      </div>
    </section>
  );
}

export const Card = ({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) => {
  return (
    <div
      className={cn(
        "rounded-xl border border-transparent p-2 transition-all duration-200 md:p-4",
        className,
      )}
    >
      {children}
    </div>
  );
};

export const CardTitle = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <h2
      className={cn(
        "text-xl font-semibold tracking-tight text-neutral-900 text-shadow-black/2 text-shadow-sm dark:text-neutral-100",
        className,
      )}
    >
      {children}
    </h2>
  );
};

export const CardDescription = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <h2
      className={cn(
        "mt-4 text-sm text-neutral-500 dark:text-neutral-400",
        className,
      )}
    >
      {children}
    </h2>
  );
};

export const CardSkeleton = ({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) => {
  return (
    <div
      className={cn(
        "relative h-72 overflow-hidden mask-t-from-80% mask-b-from-80% md:h-64",
        className,
      )}
    >
      {children}
    </div>
  );
};

export const Accountability = () => {
  const messages = [
    { type: "mentor", content: "did you build the navbar feature?" },
    { type: "user", content: "yes i did, raised a PR for the same" },
    { type: "mentor", content: "can you point me to that PR?" },
    { type: "user", content: "sure thing, here's the link." },
  ];

  return (
    <div className="flex h-full w-full flex-col rounded-lg p-4">
      <div className="flex flex-1 flex-col gap-6 overflow-hidden">
        {messages.map((message, index) =>
          message.type === "mentor" ? (
            <MentorMessage key={index} delay={index * 1.5}>
              {message.content}
            </MentorMessage>
          ) : (
            <UserMessage key={index} delay={index * 1.5}>
              {message.content}
            </UserMessage>
          ),
        )}
      </div>
    </div>
  );
};

export const DoubtClearing = () => {
  const avatars = [
    {
      title: "First",
      src: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=2670",
      icon: <IconVolume2 className="size-3 text-neutral-100" />,
    },
    {
      title: "Second",
      src: "https://images.unsplash.com/photo-1640951613773-54706e06851d?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=1760",
      icon: <IconMicrophoneOff className="size-3 text-white" />,
    },
    {
      title: "Third",
      src: "https://images.unsplash.com/photo-1560250097-0b93528c311a?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=1287",
      icon: <IconMicrophoneOff className="size-3 text-white" />,
    },
    {
      title: "Fourth",
      src: "https://images.unsplash.com/photo-1546961329-78bef0414d7c?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=1287",
      icon: <IconMicrophoneOff className="size-3 text-white" />,
    },
  ];
  return (
    <div className="relative m-auto h-[92%] w-[95%] rounded-sm border border-transparent bg-white p-1 dark:bg-neutral-950">
      <div
        className={cn(
          "absolute inset-0",
          "[background-size:15px_15px]",
          "[background-image:radial-gradient(var(--color-neutral-200)_1px,transparent_1px)]",
          "dark:[background-image:radial-gradient(var(--color-neutral-700)_1px,transparent_1px)]",
        )}
      />
      <div className="flex items-center gap-1.5 p-2">
        <div className="size-2.5 rounded-full bg-red-500"></div>
        <div className="size-2.5 rounded-full bg-yellow-500"></div>
        <div className="size-2.5 rounded-full bg-green-500"></div>
      </div>
      <div className="relative z-20 mt-4 flex justify-center">
        <div className="size-24 rounded-sm border border-neutral-200 bg-neutral-100 p-1">
          <img
            src="https://images.unsplash.com/photo-1599566150163-29194dcaad36?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=1287"
            alt="Brandon"
            width={80}
            height={80}
            className="size-full rounded-sm object-cover"
          />
        </div>
      </div>
      <div className="relative z-20 mt-4 flex items-center justify-center gap-4">
        {avatars.map((avatar) => (
          <div
            key={avatar.src}
            className="relative flex flex-col items-center justify-center"
          >
            <img
              src={avatar.src}
              alt={avatar.title}
              width={80}
              height={80}
              className="size-12 rounded-sm object-cover"
            />
            <div className="absolute bottom-1 left-1 z-50">{avatar.icon}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

const MentorMessage = ({
  children,
  delay = 0,
  avatarSrc = "https://images.unsplash.com/photo-1599566150163-29194dcaad36?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=1287",
}: {
  children: React.ReactNode;
  delay?: number;
  avatarSrc?: string;
}) => {
  return (
    <motion.div
      className="flex items-start gap-2"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay }}
      viewport={{ once: false }}
    >
      <img
        src={avatarSrc}
        width={24}
        height={24}
        alt="Mentor"
        className="size-6 flex-shrink-0 rounded-full object-cover"
      />
      <div className="max-w-[80%] rounded-lg bg-neutral-100 px-3 py-2 text-neutral-800 dark:bg-neutral-800">
        <div className="text-xs text-gray-800 dark:text-gray-200">
          {children}
        </div>
      </div>
    </motion.div>
  );
};

const UserMessage = ({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) => {
  return (
    <motion.div
      className="flex items-start justify-end gap-2"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay }}
      viewport={{ once: false }}
    >
      <div className="max-w-[80%] rounded-lg bg-blue-500 px-3 py-2 text-white">
        <div className="text-xs">{children}</div>
      </div>
      <img
        src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=1287"
        width={24}
        height={24}
        alt="User"
        className="size-6 flex-shrink-0 rounded-full object-cover"
      />
    </motion.div>
  );
};

export const Encouragement = () => {
  const messages = [
    { type: "user", content: "Not able to solve this problem, please help" },
    { type: "mentor", content: "How did you approach the problem?" },
    {
      type: "mentor",
      content: "Let's jump on a call to discuss this.",
      avatarSrc:
        "https://images.unsplash.com/photo-1654110455429-cf322b40a906?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=1760",
    },
    {
      type: "mentor",
      content: "Did you try reproducing the problem?",
      avatarSrc:
        "https://images.unsplash.com/photo-1580489944761-15a19d654956?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=1361",
    },
  ];

  return (
    <div className="flex h-full w-full flex-col rounded-lg p-4">
      <div className="flex flex-1 flex-col gap-6 overflow-hidden">
        {messages.map((message, index) =>
          message.type === "mentor" ? (
            <MentorMessage
              key={index}
              delay={index * 0.2}
              avatarSrc={message.avatarSrc}
            >
              {message.content}
            </MentorMessage>
          ) : (
            <UserMessage key={index} delay={index * 1.5}>
              {message.content}
            </UserMessage>
          ),
        )}
      </div>
    </div>
  );
};

export const Mentorship = () => {
  const mentors = [
    {
      src: "https://images.unsplash.com/photo-1599566150163-29194dcaad36?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=1287",
      alt: "Brandon",
      name: "Brandon",
      designation: "Senior Software Engineer",
    },
    {
      src: "https://images.unsplash.com/photo-1654110455429-cf322b40a906?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=1760",
      alt: "Manu",
      name: "Manu",
      designation: "Tech Lead",
    },
    {
      src: "https://images.unsplash.com/photo-1580489944761-15a19d654956?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=1361",
      alt: "Dwayne",
      name: "Dwayne",
      designation: "Principal Engineer",
    },
    {
      src: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=1760",
      alt: "Emily",
      name: "Emily",
      designation: "Staff Engineer",
    },
    {
      src: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=1287",
      alt: "James",
      name: "James",
      designation: "Engineering Manager",
    },
    {
      src: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=2670",
      alt: "Healey",
      name: "Healey",
      designation: "Senior Developer",
    },
  ];
  return (
    <div className="flex h-full w-full flex-col items-center justify-center mask-r-from-90% mask-l-from-90%">
      <Marquee className="py-2" speed={20} pauseOnHover>
        {mentors.map((mentor) => (
          <div
            key={mentor.alt}
            className="mx-2 flex items-center gap-2 rounded-sm border border-transparent bg-white p-2 shadow-sm ring-1 shadow-black/15 ring-black/5 dark:bg-neutral-900"
          >
            <img
              src={mentor.src}
              alt={mentor.alt}
              width={24}
              height={24}
              className="size-8 rounded-full object-cover"
            />
            <div className="flex flex-col">
              <span className="text-xs font-medium">{mentor.name}</span>
              <span className="text-[10px] text-gray-500">
                {mentor.designation}
              </span>
            </div>
          </div>
        ))}
      </Marquee>
      <Marquee direction="right" className="py-2" speed={10} pauseOnHover>
        {mentors.map((mentor) => (
          <div
            key={mentor.alt}
            className="mx-2 flex items-center gap-2 rounded-sm border border-transparent bg-white p-2 shadow-sm ring-1 shadow-black/15 ring-black/5 dark:bg-neutral-900"
          >
            <img
              src={mentor.src}
              alt={mentor.alt}
              width={24}
              height={24}
              className="size-8 rounded-full object-cover"
            />
            <div className="flex flex-col">
              <span className="text-xs font-medium">{mentor.name}</span>
              <span className="text-[10px] text-gray-500">
                {mentor.designation}
              </span>
            </div>
          </div>
        ))}
      </Marquee>
    </div>
  );
};

export const PeerGroup = () => {
  const avatars = [
    {
      src: "https://images.unsplash.com/photo-1599566150163-29194dcaad36?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=1287",
      alt: "Brandon",
      x: 10,
      y: 10,
      duration: 5,
    },
    {
      src: "https://images.unsplash.com/photo-1654110455429-cf322b40a906?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=1760",
      alt: "Manu",
      x: 150,
      y: 10,
      duration: 5.5,
    },
    {
      src: "https://images.unsplash.com/photo-1580489944761-15a19d654956?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=1361",
      alt: "Dwayne",
      x: 10,
      y: 140,
      duration: 3,
    },
    {
      src: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=1760",
      alt: "Emily",
      x: 300,
      y: 30,
      duration: 5.5,
    },
    {
      src: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=1287",
      alt: "Manu 2",
      x: 300,
      y: 140,
      duration: 5.8,
    },
    {
      src: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=2670",
      alt: "Healey",
      x: 150,
      y: 160,
      duration: 5.8,
    },
  ];

  const [currentAvatar, setCurrentAvatar] = React.useState(avatars[0]);

  const pickRandomAvatar = () => {
    const randomIndex = Math.floor(Math.random() * avatars.length);
    setCurrentAvatar(avatars[randomIndex]);
  };

  React.useEffect(() => {
    const interval = setInterval(pickRandomAvatar, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative flex h-full w-full flex-col rounded-lg p-4">
      <div className="relative z-50">
        {avatars.map((avatar, index) => (
          <motion.div
            key={avatar.alt}
            initial={{
              x: avatar.x,
              y: avatar.y,
            }}
            animate={{
              x: [avatar.x, avatar.x + 10, avatar.x],
              y: [avatar.y, avatar.y + 10, avatar.y],
            }}
            transition={{
              duration: avatar.duration,
              repeat: Infinity,
              ease: "linear",
            }}
            className="absolute inset-0"
          >
            <img
              src={avatar.src}
              alt={avatar.alt}
              className={cn("size-10 rounded-full object-cover")}
              height={40}
              width={40}
            />
          </motion.div>
        ))}
      </div>
      <div className="absolute inset-0 z-40 m-auto flex size-20 items-center justify-center rounded-sm border border-transparent bg-white p-0.5 text-2xl font-black text-neutral-300 shadow-sm ring-1 shadow-black/15 ring-black/5 dark:bg-neutral-900">
        <motion.img
          key={currentAvatar.alt}
          initial={{
            opacity: 0,
            filter: "blur(10px)",
          }}
          animate={{
            opacity: 1,
            filter: "blur(0px)",
          }}
          exit={{
            opacity: 0,
            filter: "blur(10px)",
          }}
          transition={{
            duration: 0.5,
            ease: "easeInOut",
          }}
          src={currentAvatar.src}
          alt={currentAvatar.alt}
          className="h-full w-full rounded-sm object-cover"
        />
      </div>
    </div>
  );
};

export const ProgressTracking = () => {
  return (
    <div className="relative grid h-full w-full grid-cols-6 gap-4 mask-r-from-90%">
      <Task text="Complete DB integration" className="top-8 left-6" />
      <Task text="Review code" className="top-24 left-40" />
      <Task text="Sync up with team" className="top-32 -right-4" />
      <Line text="28" />
      <Line text="29" />
      <Line text="30" />
      <Line text="31" />
      <Line text="1" />
      <Line text="2" />
    </div>
  );
};

const Task = ({ text, className }: { text: string; className?: string }) => {
  return (
    <div
      className={cn(
        "absolute w-fit rounded-md border border-neutral-200 bg-neutral-100 p-1 text-xs dark:border-neutral-700 dark:bg-neutral-800",
        className,
      )}
    >
      {text}
    </div>
  );
};

const Line = ({ text }: { text: string }) => {
  return (
    <div className="flex h-full flex-col items-center justify-center">
      <span className="text-xs text-neutral-500 dark:text-neutral-100">
        {text}
      </span>
      <div className="flex w-px flex-1 bg-neutral-100 dark:bg-neutral-800"></div>
    </div>
  );
};
