import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { HeroVisual } from "@/components/home/hero-visual";
import type { HeroContentView } from "@/lib/marketing/banner-rules";

// HomeHero — STATIC single hero (no carousel, no autoplay, no slider
// dependency). Server-rendered from the admin-manageable hero banner merged
// with the factual structural defaults (see resolveHeroContent); the visual
// area is either the admin-set image URL or the branded illustration.
// Accessible: one h1, real link semantics, meaningful alt text, and CTAs
// that remain fully visible/usable on mobile.

export function HomeHero({ hero }: { hero: HeroContentView }) {
  return (
    <section
      className="border-b bg-gradient-to-b from-[var(--reyhan-blue-50)]/60 via-white to-white py-10 sm:py-14 lg:py-20"
      aria-labelledby="home-hero-title"
    >
      <div className="mx-auto grid w-full max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:gap-12 lg:px-8 xl:gap-16">
        {/* Content side */}
        <div className="max-w-xl">
          <Badge variant="success" className="mb-4">
            تخصص · دانش · مشاوره
          </Badge>
          <h1
            id="home-hero-title"
            className="text-balance text-3xl font-bold leading-[1.35] text-foreground sm:text-4xl sm:leading-[1.35] lg:text-[2.75rem] lg:leading-[1.35]"
          >
            {hero.title}
          </h1>
          <p className="mt-5 text-pretty text-base leading-8 text-muted-foreground sm:text-lg sm:leading-9">
            {hero.description}
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {hero.primaryLinkHref && (
              <Link
                href={hero.primaryLinkHref}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-primary px-8 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-[var(--reyhan-blue-700)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:w-auto"
              >
                {hero.primaryLinkLabel}
                <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 rtl:rotate-180" fill="none">
                  <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            )}
            {hero.secondaryLinkHref && hero.secondaryLinkLabel && (
              <Link
                href={hero.secondaryLinkHref}
                className="inline-flex h-12 w-full items-center justify-center rounded-md border border-input bg-background px-8 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:w-auto"
              >
                {hero.secondaryLinkLabel}
              </Link>
            )}
          </div>
        </div>

        {/* Visual side — admin image URL, or the branded illustration */}
        <div className="relative order-first mx-auto w-full max-w-md px-2 sm:max-w-lg lg:order-none lg:max-w-none lg:px-0">
          {hero.imageUrl ? (
            <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
              {/* Fixed aspect container avoids layout shifts while loading. */}
              <div className="aspect-[4/3] w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={hero.imageUrl}
                  alt={hero.title}
                  className="h-full w-full object-cover"
                  loading="eager"
                  fetchPriority="high"
                />
              </div>
            </div>
          ) : (
            <HeroVisual className="mx-auto h-auto w-full drop-shadow-sm" />
          )}
        </div>
      </div>
    </section>
  );
}
