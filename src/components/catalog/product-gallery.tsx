"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { CatalogImage } from "@/lib/catalog/types";

type ProductGalleryProps = {
  images: CatalogImage[];
  productTitle: string;
};

function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url);
}

type MediaItem =
  | { kind: "image"; url: string; alt: string }
  | { kind: "video"; url: string; alt: string };

function buildMedia(images: CatalogImage[], productTitle: string): MediaItem[] {
  return images.map((img) => {
    const alt = img.alt ?? productTitle;
    return isVideoUrl(img.url)
      ? { kind: "video", url: img.url, alt }
      : { kind: "image", url: img.url, alt };
  });
}

export function ProductGallery({ images, productTitle }: ProductGalleryProps) {
  const media = React.useMemo(() => buildMedia(images, productTitle), [images, productTitle]);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [lightboxOpen, setLightboxOpen] = React.useState(false);

  const safeIndex = media.length === 0 ? 0 : Math.min(activeIndex, media.length - 1);
  const active = media[safeIndex];

  // Keyboard nav inside lightbox
  React.useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxOpen(false);
      if (e.key === "ArrowRight")
        setActiveIndex((i) => (media.length ? (i + 1) % media.length : 0));
      if (e.key === "ArrowLeft")
        setActiveIndex((i) => (media.length ? (i - 1 + media.length) % media.length : 0));
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [lightboxOpen, media.length]);

  if (media.length === 0) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-lg border bg-muted px-4 text-center text-sm text-muted-foreground">
        تصویری برای «{productTitle}» ثبت نشده است
      </div>
    );
  }

  const goNext = () => setActiveIndex((i) => (media.length ? (i + 1) % media.length : 0));
  const goPrev = () =>
    setActiveIndex((i) => (media.length ? (i - 1 + media.length) % media.length : 0));

  return (
    <div className="space-y-3">
      {/* Main media */}
      <div className="group relative overflow-hidden rounded-lg border bg-muted">
        {active.kind === "image" ? (
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            aria-label="نمایش تصویر در اندازه بزرگ"
            className="block w-full cursor-zoom-in"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={active.url}
              alt={active.alt}
              className="h-64 w-full object-cover transition-transform duration-300 group-hover:scale-105 sm:h-80 lg:h-96"
              loading="eager"
              fetchPriority="high"
              decoding="async"
            />
          </button>
        ) : (
          <video
            src={active.url}
            controls
            playsInline
            preload="metadata"
            aria-label={active.alt}
            className="h-64 w-full bg-black object-contain sm:h-80 lg:h-96"
          />
        )}

        {/* Prev / Next arrows — images only navigation, hidden on single item */}
        {media.length > 1 && (
          <>
            <button
              type="button"
              onClick={goPrev}
              aria-label="رسانه قبلی"
              className="absolute end-3 top-1/2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm transition hover:bg-background"
            >
              <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 rtl:rotate-180" fill="none">
                <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label="رسانه بعدی"
              className="absolute start-3 top-1/2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm transition hover:bg-background"
            >
              <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 rtl:rotate-180" fill="none">
                <path d="M10 4L6 8L10 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </>
        )}

        {/* Counter */}
        {media.length > 1 && (
          <span className="absolute bottom-3 start-3 rounded-full bg-background/80 px-2.5 py-1 text-[11px] font-medium text-foreground">
            {safeIndex + 1} / {media.length}
          </span>
        )}
      </div>

      {/* Thumbnails — plain selector buttons (not tabs: there is no
          associated tabpanel, so tablist/tab roles would be incorrect).
          The thumbnail image itself is decorative: the button carries the
          accessible name and the current item is exposed via aria-current. */}
      {media.length > 1 && (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5" role="group" aria-label="تصاویر محصول">
          {media.map((item, i) => (
            <button
              key={`${item.url}-${i}`}
              type="button"
              aria-current={i === safeIndex || undefined}
              aria-label={item.kind === "video" ? `ویدیوی ${i + 1}` : `نمایش تصویر ${i + 1}`}
              onClick={() => setActiveIndex(i)}
              className={cn(
                "relative overflow-hidden rounded-lg border bg-muted",
                i === safeIndex ? "border-primary ring-1 ring-primary" : "border-border"
              )}
            >
              {item.kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.url}
                  alt=""
                  aria-hidden="true"
                  className="aspect-square w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <span className="flex aspect-square w-full items-center justify-center bg-foreground/5 text-foreground/70">
                  <svg aria-hidden="true" viewBox="0 0 16 16" className="size-5" fill="none">
                    <rect x="2" y="4" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
                    <path d="M7 6.5L9.5 8L7 9.5V6.5Z" fill="currentColor" />
                  </svg>
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxOpen && active.kind === "image" && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="نمایش بزرگ تصویر محصول"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        >
          <button
            type="button"
            aria-label="بستن نمایش بزرگ"
            onClick={() => setLightboxOpen(false)}
            className="absolute inset-0 cursor-zoom-out"
          />
          <button
            type="button"
            aria-label="بستن"
            onClick={() => setLightboxOpen(false)}
            className="absolute end-4 top-4 inline-flex size-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          >
            <svg aria-hidden="true" viewBox="0 0 16 16" className="size-5" fill="none">
              <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>

          {media.length > 1 && (
            <>
              <button
                type="button"
                onClick={goPrev}
                aria-label="تصویر قبلی"
                className="absolute end-4 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
              >
                <svg aria-hidden="true" viewBox="0 0 16 16" className="size-5 rtl:rotate-180" fill="none">
                  <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                type="button"
                onClick={goNext}
                aria-label="تصویر بعدی"
                className="absolute start-4 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
              >
                <svg aria-hidden="true" viewBox="0 0 16 16" className="size-5 rtl:rotate-180" fill="none">
                  <path d="M10 4L6 8L10 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </>
          )}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={active.url}
            alt={active.alt}
            className="max-h-[85vh] max-w-full rounded-lg object-contain shadow-2xl"
          />
        </div>
      )}
    </div>
  );
}
