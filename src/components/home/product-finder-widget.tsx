"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MediaPlaceholder } from "@/components/common/media-placeholder";
import { HomeSectionHeading } from "@/components/home/section-heading";
import { formatPriceToman, toFaDigits } from "@/lib/catalog/format";
import type { CatalogProduct } from "@/lib/catalog/types";

// ProductFinderWidget — interactive "which purifier fits you?" guide.
//
// Client component with a 2-question flow:
//   Step 1 → household size / consumption (small / medium / large)
//   Step 2 → priority & budget (economy / alkaline 6-7 stage / luxury smart)
//   Result → top-ranked REAL products passed in via props (never invented).
//
// The widget receives the homepage's already-fetched product lists
// (featured + best-selling) as `products`. Ranking is a transparent,
// keyword + price heuristic over real titles/specs — no fake claims,
// no fabricated metrics. An empty list renders an honest empty state
// with a link to the catalog.

type Household = "small" | "medium" | "large";
type Priority = "economy" | "alkaline" | "luxury";
type Step = 1 | 2 | 3;

const HOUSEHOLD_OPTIONS: {
  value: Household;
  title: string;
  description: string;
}[] = [
  {
    value: "small",
    title: "۱ تا ۳ نفر",
    description: "مصرف کم — خانوار کوچک",
  },
  {
    value: "medium",
    title: "۴ تا ۶ نفر",
    description: "مصرف متوسط — خانواده معمولی",
  },
  {
    value: "large",
    title: "پرجمعیت و اداری",
    description: "مصرف بالا — خانواده پرجمعیت یا محیط کاری",
  },
];

const PRIORITY_OPTIONS: {
  value: Priority;
  title: string;
  description: string;
}[] = [
  {
    value: "economy",
    title: "اقتصادی و استاندارد",
    description: "قیمت مناسب با کیفیت استاندارد",
  },
  {
    value: "alkaline",
    title: "سیستم ۶ یا ۷ مرحله‌ای قلیایی‌کننده",
    description: "تصفیه عمیق‌تر با مراحل تکمیلی",
  },
  {
    value: "luxury",
    title: "مدل‌های لوکس و هوشمند",
    description: "امکانات پیشرفته و طراحی ممتاز",
  },
];

const HOUSEHOLD_LABEL: Record<Household, string> = {
  small: "۱ تا ۳ نفر",
  medium: "۴ تا ۶ نفر",
  large: "پرجمعیت و اداری",
};

const PRIORITY_LABEL: Record<Priority, string> = {
  economy: "اقتصادی و استاندارد",
  alkaline: "سیستم ۶ یا ۷ مرحله‌ای قلیایی‌کننده",
  luxury: "مدل‌های لوکس و هوشمند",
};

function productText(p: CatalogProduct): string {
  const specs = p.specifications.map((s) => `${s.key} ${s.value}`).join(" ");
  return `${p.title} ${p.shortDescription ?? ""} ${p.description ?? ""} ${specs}`;
}

function isPurifierDevice(p: CatalogProduct): boolean {
  const text = productText(p);
  if (/تصفیه/.test(text)) return true;
  return p.specifications.some((s) => s.key.includes("مراحل"));
}

function scoreProduct(
  p: CatalogProduct,
  household: Household,
  priority: Priority
): number {
  const text = productText(p);
  let score = 0;

  // Priority signals (real spec/title keywords only).
  if (priority === "economy") {
    if (/۴ مرحله|رومیزی|استاندارد|اقتصادی/.test(text)) score += 3;
    if (/۶ مرحله|۷ مرحله|هوشمند|لوکس|قلیایی|آلکالاین/.test(text)) score -= 1;
  } else if (priority === "alkaline") {
    if (/۷ مرحله/.test(text)) score += 5;
    if (/۶ مرحله/.test(text)) score += 4;
    if (/قلیایی|آلکالاین/.test(text)) score += 3;
    if (/اسمز|RO|ممبران/.test(text)) score += 2;
    if (/۴ مرحله/.test(text)) score -= 1;
  } else {
    if (/هوشمند|لوکس/.test(text)) score += 5;
    if (/۷ مرحله/.test(text)) score += 2;
    if (/۶ مرحله/.test(text)) score += 1;
  }

  // Household / consumption signals.
  if (household === "small") {
    if (/رومیزی|۴ مرحله|کم‌حجم|سبک|سفر/.test(text)) score += 3;
  } else if (household === "medium") {
    if (/زیرسینکی|۶ مرحله|۱۶ لیتر|۴ گالن/.test(text)) score += 3;
  } else {
    if (/۱۶ لیتر|۴ گالن|۷۵ گالن|مخزن|زیرسینکی|اداری/.test(text)) score += 3;
    if (/رومیزی|سفر|سبک/.test(text)) score -= 1;
  }

  // Featured flag is an admin-curated real signal — slight boost so the
  // store's own curation breaks ties without inventing claims.
  if (p.isFeatured) score += 0.5;

  return score;
}

function rankProducts(
  products: CatalogProduct[],
  household: Household,
  priority: Priority,
  take = 2
): CatalogProduct[] {
  if (products.length === 0) return [];
  const devices = products.filter(isPurifierDevice);
  const pool = devices.length > 0 ? devices : products;

  const scored = pool.map((p) => ({ p, score: scoreProduct(p, household, priority) }));
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const pa = a.p.priceRange.min ?? Number.MAX_SAFE_INTEGER;
    const pb = b.p.priceRange.min ?? Number.MAX_SAFE_INTEGER;
    // Economy → cheaper first; luxury → pricier first; alkaline → score only.
    if (priority === "economy") return pa - pb;
    if (priority === "luxury") return pb - pa;
    return pa - pb;
  });
  return scored.slice(0, Math.max(1, take)).map((s) => s.p);
}

function RecommendationCard({ product }: { product: CatalogProduct }) {
  const image = product.images[0];
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-white/70 bg-white/80 shadow-sm backdrop-blur-md">
      <Link
        href={`/products/${product.slug}`}
        className="block"
        aria-label={`مشاهده ${product.title}`}
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image.url}
              alt={image.alt ?? product.title}
              className="h-full w-full object-cover"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <MediaPlaceholder
              tone="blue"
              glyph="drop"
              label={product.categories[0]?.name ?? "ریحان"}
            />
          )}
        </div>
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <Link href={`/products/${product.slug}`} className="group">
          <h3 className="line-clamp-2 text-sm font-bold leading-6 text-foreground group-hover:text-[var(--reyhan-blue-700)]">
            {product.title}
          </h3>
        </Link>
        {product.specifications.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {product.specifications.slice(0, 3).map((spec) => (
              <Badge
                key={`${spec.key}-${spec.value}`}
                variant="outline"
                className="border bg-muted/40 px-2 py-0 text-[11px] font-normal text-muted-foreground"
              >
                {spec.key}: {spec.value}
              </Badge>
            ))}
          </div>
        )}
        <div className="mt-3 flex items-end justify-between gap-3 border-t pt-3">
          <div>
            <div className="text-[11px] font-medium text-muted-foreground">
              شروع قیمت از
            </div>
            <div className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
              {formatPriceToman(product.priceRange.min)}
            </div>
          </div>
          <Link
            href={`/products/${product.slug}`}
            className="inline-flex h-9 shrink-0 items-center justify-center rounded-md bg-[#042e3a] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#083f52]"
          >
            مشاهده محصول
          </Link>
        </div>
      </div>
    </article>
  );
}

export function ProductFinderWidget({
  products,
}: {
  products: CatalogProduct[];
}) {
  const [step, setStep] = useState<Step>(1);
  const [household, setHousehold] = useState<Household | null>(null);
  const [priority, setPriority] = useState<Priority | null>(null);

  const recommendations = useMemo(() => {
    if (household == null || priority == null) return [];
    return rankProducts(products, household, priority, 2);
  }, [products, household, priority]);

  function reset() {
    setStep(1);
    setHousehold(null);
    setPriority(null);
  }

  return (
    <section
      aria-labelledby="home-finder-title"
      className="py-10 sm:py-14"
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <HomeSectionHeading
          eyebrow="راهنمای انتخاب هوشمند"
          id="home-finder-title"
          title="کدام دستگاه تصفیه آب مناسب شماست؟"
          description="با پاسخ به ۲ سوال کوتاه، مناسب‌ترین دستگاه را برای خانه خود پیدا کنید"
        />

        <div className="mt-8 rounded-3xl border border-white/80 bg-white/60 p-5 shadow-card backdrop-blur-md sm:p-8">
          {/* Progress */}
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold text-[var(--reyhan-blue-700)]">
              {step < 3 ? (
                <>
                  مرحله {toFaDigits(step)} از {toFaDigits(2)}
                </>
              ) : (
                <>پیشنهاد ریحان برای شما</>
              )}
            </p>
            <div
              className="flex items-center gap-1.5"
              aria-hidden="true"
              dir="ltr"
            >
              {[1, 2].map((i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-colors ${
                    (step === 3 ? 2 : step) >= i
                      ? "w-8 bg-cyan-500"
                      : "w-4 bg-slate-200"
                  }`}
                />
              ))}
            </div>
          </div>

          {products.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed bg-white/70 px-5 py-10 text-center">
              <p className="text-sm font-semibold text-foreground">
                در حال حاضر محصولی برای پیشنهاد هوشمند در دسترس نیست.
              </p>
              <p className="mx-auto mt-2 max-w-md text-xs leading-6 text-muted-foreground">
                لطفاً مستقیماً کاتالوگ محصولات را بررسی کنید.
              </p>
              <Link
                href="/products"
                className="mt-5 inline-flex h-10 items-center justify-center rounded-md bg-[#042e3a] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#083f52]"
              >
                مشاهده همه محصولات
              </Link>
            </div>
          ) : (
            <>
              {/* Step 1 — household */}
              {step === 1 && (
                <div role="radiogroup" aria-label="تعداد اعضای خانواده و میزان مصرف">
                  <p className="mt-5 text-sm font-bold text-foreground">
                    در خانه شما معمولاً چند نفر آب مصرف می‌کنند؟
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {HOUSEHOLD_OPTIONS.map((opt) => {
                      const selected = household === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => setHousehold(opt.value)}
                          className={`rounded-2xl border px-4 py-5 text-start transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 ${
                            selected
                              ? "border-cyan-500 bg-cyan-50/80 shadow-[0_0_20px_-6px_rgba(34,211,238,0.5)]"
                              : "border-input bg-white/80 hover:border-cyan-200 hover:bg-white"
                          }`}
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span className="text-sm font-bold text-foreground">
                              {opt.title}
                            </span>
                            <span
                              aria-hidden="true"
                              className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                                selected
                                  ? "border-cyan-500 bg-cyan-500 text-white"
                                  : "border-slate-300 text-transparent"
                              }`}
                            >
                              <svg
                                viewBox="0 0 12 12"
                                className="size-3"
                                fill="none"
                              >
                                <path
                                  d="M2.5 6.2 5 8.5 9.5 3.5"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </span>
                          </span>
                          <span className="mt-1.5 block text-xs leading-6 text-muted-foreground">
                            {opt.description}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-6 flex justify-end">
                    <Button
                      type="button"
                      disabled={household == null}
                      onClick={() => setStep(2)}
                    >
                      مرحله بعد
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 16 16"
                        className="size-4 rtl:rotate-180"
                        fill="none"
                      >
                        <path
                          d="M10 4 6 8l4 4"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 2 — priority & budget */}
              {step === 2 && (
                <div role="radiogroup" aria-label="اولویت و بودجه">
                  <p className="mt-5 text-sm font-bold text-foreground">
                    اولویت شما در انتخاب دستگاه چیست؟
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {PRIORITY_OPTIONS.map((opt) => {
                      const selected = priority === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => setPriority(opt.value)}
                          className={`rounded-2xl border px-4 py-5 text-start transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 ${
                            selected
                              ? "border-cyan-500 bg-cyan-50/80 shadow-[0_0_20px_-6px_rgba(34,211,238,0.5)]"
                              : "border-input bg-white/80 hover:border-cyan-200 hover:bg-white"
                          }`}
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span className="text-sm font-bold leading-6 text-foreground">
                              {opt.title}
                            </span>
                            <span
                              aria-hidden="true"
                              className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                                selected
                                  ? "border-cyan-500 bg-cyan-500 text-white"
                                  : "border-slate-300 text-transparent"
                              }`}
                            >
                              <svg
                                viewBox="0 0 12 12"
                                className="size-3"
                                fill="none"
                              >
                                <path
                                  d="M2.5 6.2 5 8.5 9.5 3.5"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </span>
                          </span>
                          <span className="mt-1.5 block text-xs leading-6 text-muted-foreground">
                            {opt.description}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-6 flex items-center justify-between gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setStep(1)}
                    >
                      بازگشت
                    </Button>
                    <Button
                      type="button"
                      disabled={priority == null}
                      onClick={() => setStep(3)}
                    >
                      نمایش پیشنهاد
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 3 — result */}
              {step === 3 && household != null && priority != null && (
                <div aria-live="polite">
                  <p className="mt-5 rounded-xl bg-cyan-50/80 px-4 py-3 text-xs leading-7 text-[var(--reyhan-blue-700)]">
                    بر اساس مصرف «{HOUSEHOLD_LABEL[household]}» و اولویت
                    «{PRIORITY_LABEL[priority]}»، این مدل‌ها از میان محصولات
                    فعال فروشگاه برای شما پیشنهاد می‌شود.
                  </p>
                  {recommendations.length > 0 ? (
                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      {recommendations.map((product) => (
                        <RecommendationCard
                          key={product.id}
                          product={product}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="mt-5 text-sm leading-7 text-muted-foreground">
                      محصولی متناسب با این ترکیب یافت نشد؛ کاتالوگ کامل را
                      ببینید.
                    </p>
                  )}
                  <div className="mt-6 flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={reset}
                    >
                      شروع دوباره
                    </Button>
                    <Link
                      href="/products"
                      className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md px-4 text-sm font-medium text-[var(--reyhan-blue-700)] transition-colors hover:bg-cyan-50"
                    >
                      مشاهده همه محصولات
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 16 16"
                        className="size-3.5 rtl:rotate-180"
                        fill="none"
                      >
                        <path
                          d="M6 4l4 4-4 4"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </Link>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
