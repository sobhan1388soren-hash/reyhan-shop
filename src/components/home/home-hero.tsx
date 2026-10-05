import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { MediaPlaceholder } from "@/components/common/media-placeholder";
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
      className="relative overflow-hidden border-b bg-gradient-to-b from-[var(--reyhan-blue-50)]/60 via-white to-white py-10 sm:py-14 lg:py-20"
      aria-labelledby="home-hero-title"
    >
      {/* Phase 3 — ambient light-field blobs (decorative, non-interactive) */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 start-[8%] size-72 rounded-full bg-cyan-300/30 blur-3xl" />
        <div className="absolute top-1/3 end-[4%] size-80 rounded-full bg-[#0ea5c8]/20 blur-3xl" />
      </div>
      <div className="relative mx-auto grid w-full max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:gap-12 lg:px-8 xl:gap-16">
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

        {/* Visual side — admin image URL, or the placeholder surface */}
        <div className="relative order-first mx-auto w-full max-w-md px-2 sm:max-w-lg lg:order-none lg:max-w-none lg:px-0">
          {hero.imageUrl ? (
            <div className="overflow-hidden rounded-3xl border border-white/60 bg-white/50 shadow-[0_24px_60px_-16px_rgb(4_46_58/0.35)] ring-1 ring-white/50 backdrop-blur-xl">
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
            <div className="overflow-hidden rounded-3xl border border-white/60 bg-white/50 shadow-[0_24px_60px_-16px_rgb(4_46_58/0.35)] ring-1 ring-white/50 backdrop-blur-xl">
              {/* Same fixed aspect + card chrome as the image branch. */}
              <div className="aspect-[4/3] w-full">
                <MediaPlaceholder tone="mixed" glyph="drop" />
              </div>
            </div>
          )}
          {/* Subtle bottom cyan water-glow reflection pool */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-8 left-1/2 h-16 w-3/4 -translate-x-1/2 rounded-full bg-cyan-400/30 blur-2xl"
          />
        </div>
      </div>
    </section>
  );
}
