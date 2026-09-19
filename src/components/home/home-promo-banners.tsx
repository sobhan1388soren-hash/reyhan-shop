import Link from "next/link";
import type { PromoBannerView } from "@/lib/marketing/banner-rules";

// HomePromoBanners — the active promotional banner strip. Renders as a
// stack of full-width cards (deliberately NOT a carousel: no autoplay, no
// slider dependency, no motion dependence). Ordering comes from the stored
// sortOrder; each banner keeps a fixed aspect container so images never
// cause layout shifts. Banners without an image degrade to a branded
// gradient surface with the text intact. An empty/absent set renders
// nothing.

export function HomePromoBanners({ banners }: { banners: PromoBannerView[] }) {
  if (banners.length === 0) return null;

  return (
    <section aria-label="بنرهای ویژه" className="py-6 sm:py-8">
      <div className="mx-auto w-full max-w-7xl space-y-4 px-4 sm:px-6 lg:px-8">
        {banners.map((banner) => {
          const content = (
            <div className="relative overflow-hidden rounded-2xl border bg-card shadow-card">
              {/* Fixed aspect on mobile; relaxed height on larger screens. */}
              <div className="flex aspect-[16/9] flex-col justify-center gap-3 p-6 sm:aspect-[21/9] sm:p-10">
                {banner.imageUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={banner.imageUrl}
                      alt={banner.title}
                      className="absolute inset-0 h-full w-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-l from-white/92 via-white/70 to-white/30" />
                  </>
                ) : (
                  <div
                    className="absolute inset-0 bg-gradient-to-l from-[var(--reyhan-blue-50)] via-white to-[var(--reyhan-green-50)]"
                    aria-hidden="true"
                  />
                )}

                <div className="relative max-w-lg">
                  <h3 className="text-balance text-lg font-bold text-foreground sm:text-2xl">
                    {banner.title}
                  </h3>
                  {banner.description && (
                    <p className="mt-2 text-sm leading-7 text-muted-foreground">
                      {banner.description}
                    </p>
                  )}
                  {banner.linkLabel && (
                    <span className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-5 text-xs font-semibold text-primary-foreground shadow-sm">
                      {banner.linkLabel}
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 16 16"
                        className="size-3.5 rtl:rotate-180"
                        fill="none"
                      >
                        <path
                          d="M6 4L10 8L6 12"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  )}
                </div>
              </div>
            </div>
          );

          if (banner.linkHref) {
            return (
              <Link key={banner.id} href={banner.linkHref} className="block group">
                {content}
              </Link>
            );
          }

          return <div key={banner.id}>{content}</div>;
        })}
      </div>
    </section>
  );
}
