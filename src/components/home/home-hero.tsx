import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";

export function HomeHero() {
  return (
    <section
      className="relative overflow-hidden bg-gradient-to-b from-[var(--reyhan-blue-50)]/40 via-white to-white"
      aria-labelledby="home-hero-title"
    >
      {/* Full-bleed background image — covers entire Hero section */}
      <div aria-hidden="true" className="absolute inset-0 z-0">
        <Image
          src="/softwater-purifier.png.jpg"
          alt=""
          fill
          priority
          className="
            object-cover
            object-[10%_center]
            sm:object-[12%_center]
            lg:object-[8%_center]
            xl:object-[6%_center]
          "
          sizes="100vw"
          quality={95}
        />
        {/* Subtle localized gradient on the right (RTL content side) for text readability —
             only activates where text sits, preserves image brightness elsewhere */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[var(--reyhan-blue-50)]/60 lg:to-[var(--reyhan-blue-50)]/70"
        />
      </div>

      {/* Content overlay — constrained, centered, RTL-aligned */}
      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-14 xl:py-16">
        <div className="max-w-xl lg:max-w-lg">
          {/* Green badge with leaf icon */}
          <Badge variant="success" className="mb-4 inline-flex items-center gap-1.5 text-xs sm:text-sm px-3 py-1.5">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M11 20a7 7 0 0 1-7-7c0-1.3.3-2.5.8-3.6A8.5 8.5 0 1 1 12 3.5a1 1 0 0 1 0 2c-3.3 0-6 2.7-6 6 0 2.3 1.3 4.3 3.2 5.3L11 20Z" />
              <path d="M11 4a9 9 0 0 1 9 9" strokeWidth={1.5} strokeLinecap="round" />
            </svg>
            تصفیه آب خانگی
          </Badge>

          {/* Small introductory text */}
          <p className="mb-4 text-sm leading-6 text-[var(--reyhan-green-600)] font-medium tracking-wide">
            آبِ سالم، زیستیِ سالم‌تر برای خانواده‌تان
          </p>

          {/* Large bold headline — deep teal */}
          <h1
            id="home-hero-title"
            className="text-balance text-3xl font-bold leading-[1.15] text-[var(--reyhan-blue-800)] sm:text-4xl lg:text-[3rem] xl:text-[3.25rem] lg:leading-[1.1]"
          >
            آب سالم، زندگی سالم
          </h1>

          {/* Supporting description */}
          <p className="mt-6 text-base leading-8 text-muted-foreground sm:text-lg sm:leading-9 lg:text-lg lg:leading-10 max-w-[36ch]">
            با سیستم تصفیه آب خانگی ریحان، آبی پاک و گوارا در خانه داشته باشید.
          </p>

          {/* Prominent dark teal CTA button */}
          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-start">
            <Link
              href="/products"
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--reyhan-blue-800)] px-8 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:bg-[var(--reyhan-blue-900)] hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-6px_rgb(4_46_58/0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--reyhan-blue-600)] focus-visible:ring-offset-2 sm:w-auto"
            >
              مشاهده محصولات
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                className="size-4 rtl:rotate-180"
                fill="none"
              >
                <path
                  d="M6 4L10 8L6 12"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}