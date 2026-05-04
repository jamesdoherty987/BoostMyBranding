import { cn } from "@/lib/utils";
import Link from "next/link";

export function MasonryBentoGridWithImages() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 md:px-8">
      <Header />
      <div className="my-10 grid grid-cols-1 gap-2 rounded-3xl [mask-image:linear-gradient(to_top,transparent,black_50%)] p-1 md:grid-cols-2 lg:grid-cols-4">
        <Column>
          <Card
            href="https://posthog.com"
            src="https://assets.aceternity.com/brands/1.webp"
            alt="Posthog"
            className="lg:rounded-tl-[calc(24px-4px)]"
          />
          <Card
            href="https://vercel.com"
            src="https://assets.aceternity.com/brands/2.webp"
            alt="Something"
            className=""
          />
          <Card
            href="https://ui.aceternity.com"
            src="https://assets.aceternity.com/brands/3.webp"
            alt="Something"
            className=""
          />
        </Column>
        <Column>
          <Card
            href="https://ui.aceternity.com"
            src="https://assets.aceternity.com/brands/4.webp"
            alt="Posthog"
            className=""
          />
          <Card
            href="https://tailwindcss.com"
            src="https://assets.aceternity.com/brands/5.webp"
            alt="Something"
            className=""
          />
          <Card
            href="https://linear.app"
            src="https://assets.aceternity.com/brands/6.webp"
            alt="Something"
            className=""
          />
          <Card
            href="https://v0.dev"
            src="https://assets.aceternity.com/brands/10.webp"
            alt="Something"
            className=""
          />
        </Column>
        <Column>
          <Card
            href="https://resend.com"
            src="https://assets.aceternity.com/brands/11.webp"
            alt="Posthog"
            className=""
          />
          <Card
            href="https://resend.com"
            src="https://assets.aceternity.com/brands/8.webp"
            alt="Something"
            className=""
          />
          <Card
            href="https://nike.com"
            src="https://assets.aceternity.com/brands/9.webp"
            alt="Something"
            className=""
          />
        </Column>
        <Column>
          <Card
            href="https://adidas.com"
            src="https://assets.aceternity.com/brands/7.webp"
            alt="Posthog"
            className="lg:rounded-tr-[calc(24px-4px)]"
          />
          <Card
            href="https://myntra.com"
            src="https://assets.aceternity.com/brands/12.webp"
            alt="Something"
            className=""
          />
          <Card
            href="https://shure.com"
            src="https://assets.aceternity.com/brands/13.webp"
            alt="Something"
            className=""
          />
          <Card
            href="https://posthog.com"
            src="https://assets.aceternity.com/brands/1.webp"
            alt="Something"
            className=""
          />
        </Column>
      </div>
    </div>
  );
}

const Card = ({
  src,
  alt,
  className,
  href,
}: {
  src: string;
  alt: string;
  className: string;
  href: string;
}) => {
  return (
    <Link
      href={href}
      target="_blank"
      className={cn(
        "overlay group/bento relative mx-auto mb-2 block max-w-xl overflow-hidden rounded-md shadow-sm transition-all duration-200",
        "after:absolute after:inset-0 after:h-full after:w-full after:bg-black after:opacity-0 after:transition-all after:duration-200 after:content-[''] hover:after:opacity-90",
        className,
      )}
    >
      <img src={src} alt={alt} height={500} width={500} className="w-full" />
      <p className="absolute inset-0 z-20 m-auto flex items-center justify-center text-sm font-medium text-white opacity-0 transition-all duration-200 group-hover/bento:opacity-100">
        {href.split("https://")[1]}
      </p>
    </Link>
  );
};

const Column = ({ children }: { children: React.ReactNode }) => {
  return <div>{children}</div>;
};

const Header = () => {
  return (
    <>
      <h1 className="text-4xl font-bold tracking-tighter text-neutral-700 dark:text-neutral-100">
        Bento grids can be useful.
      </h1>
      <p className="mt-4 max-w-xl text-base text-neutral-500">
        Discover innovative solutions that transform the way you work and
        create. Our cutting-edge tools are designed to empower.
      </p>
    </>
  );
};
