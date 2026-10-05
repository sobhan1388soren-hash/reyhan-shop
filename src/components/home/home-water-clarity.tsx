"use client";

import { useId, useState } from "react";
import { HomeSectionHeading } from "@/components/home/section-heading";

// HomeWaterClarity — lightweight before/after water-clarity comparison.
//
// Performance: zero animation libraries, zero images, zero JS-driven
// animation. The reveal is a single `clip-path` inline style updated from a
// native `<input type="range">`; decorative layers are static CSS gradients.
// SEO: this is a client component but it IS server-rendered (no dynamic
// import, no `ssr: false`), so the h2 heading, description and disclaimer
// below are present in the initial HTML for crawlers.

const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

function toFaDigits(value: number): string {
  return String(value).replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]);
}

export function HomeWaterClarity() {
  // Divider position from the left (0–100). The left portion shows
  // unfiltered water; the right portion shows crystal-pure Reyhan water.
  const [position, setPosition] = useState(50);
  const sliderId = useId();
  const hintId = `${sliderId}-hint`;
  const pureShare = 100 - position;

  return (
    <section aria-labelledby="home-clarity-title" className="py-10 sm:py-14">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <HomeSectionHeading
          eyebrow="شفافیت کریستالی"
          id="home-clarity-title"
          title="مقایسه شفافیت آب"
          description="سمت چپ ظاهر آب بدون تصفیه و سمت راست ظاهر شفاف آب ریحان را نشان می‌دهد. نشانگر را بکشید تا تفاوت ظاهری را ببینید."
        />

        {/* Crystal frame */}
        <div className="mt-8 rounded-3xl border border-white/80 bg-white/60 p-4 shadow-card backdrop-blur-md">
          {/* Comparison viewport — dir="ltr" keeps slider math predictable
              inside the RTL page; all visible copy stays Persian. */}
          <div
            dir="ltr"
            className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-sky-100 focus-within:ring-2 focus-within:ring-cyan-500 focus-within:ring-offset-2 sm:aspect-[16/8]"
          >
            {/* Base layer: crystal-pure water (static CSS gradients only) */}
            <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-cyan-50 via-sky-200 to-cyan-400">
              <div className="absolute -top-10 left-[12%] size-40 rounded-full bg-white/50 blur-2xl" />
              <div className="absolute bottom-[8%] right-[16%] size-56 rounded-full bg-white/40 blur-3xl" />
              <div className="absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-cyan-500/30 to-transparent" />
            </div>

            {/* Top layer: unfiltered water, clipped to the left portion */}
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-b from-stone-200 via-[#d9c9a6] to-[#a98f63]"
              style={{ clipPath: `inset(0 ${pureShare}% 0 0)` }}
            >
              <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-amber-900/25 to-transparent" />
            </div>

            {/* Divider handle (visual only — the range input below owns interaction) */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-y-0" style={{ left: `${position}%` }}>
              <div className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_12px_rgba(255,255,255,0.9)]" />
              <div className="absolute top-1/2 flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/80 bg-white/85 shadow-lg backdrop-blur">
                <svg viewBox="0 0 16 16" className="size-4 text-cyan-700" fill="none" aria-hidden="true">
                  <path d="M5.5 3 3 8l2.5 5M10.5 3 13 8l-2.5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>

            {/* Corner labels (visual only) */}
            <span className="pointer-events-none absolute left-3 top-3 rounded-full border border-white/60 bg-black/35 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-md">
              بدون تصفیه
            </span>
            <span className="pointer-events-none absolute right-3 top-3 rounded-full border border-white/60 bg-cyan-700/70 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-md">
              کریستالی ریحان
            </span>

            {/* Transparent native range input covering the viewport:
                full pointer + keyboard + screen-reader support, no JS UI kit. */}
            <input
              id={sliderId}
              type="range"
              min={0}
              max={100}
              step={1}
              value={position}
              onChange={(e) => setPosition(Number(e.target.value))}
              aria-label="مقایسه شفافیت آب: بکشید تا آب بدون تصفیه و آب کریستالی ریحان را مقایسه کنید"
              aria-describedby={hintId}
              className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 px-1 pt-3">
            <p id={hintId} className="text-xs leading-6 text-muted-foreground">
              نشانگر را بکشید یا با کلیدهای جهت‌دار صفحه‌کلید تنظیم کنید.
            </p>
            <p aria-live="polite" className="text-xs font-semibold text-[var(--reyhan-blue-700)]">
              سهم آب کریستالی: {toFaDigits(pureShare)}٪
            </p>
          </div>

          <ul className="grid gap-1.5 px-1 pt-2 text-xs leading-6 text-muted-foreground sm:grid-cols-2">
            <li>سمت چپ: ظاهر کدر آب بدون تصفیه (نمایشی).</li>
            <li>سمت راست: ظاهر شفاف آب ریحان (نمایشی).</li>
          </ul>
          <p className="px-1 pt-1 text-[11px] leading-6 text-muted-foreground/80">
            تصویرسازی نمایشی برای مقایسه ظاهری است؛ کیفیت واقعی آب به منبع آب و دستگاه تصفیه بستگی دارد.
          </p>
        </div>
      </div>
    </section>
  );
}
