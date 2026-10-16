// Reyhan catalog seeding — 40 realistic water-purification products.
//
// Usage:
//   npm run db:seed              # seed into the online database (idempotent)
//   npm run db:seed -- --dry-run # preflight only, no database writes
//
// Env (in .env / .env.local):
//   DATABASE_URL  — postgres connection string (required)
//
// Contract with the rest of the repo:
//  * PRICES ARE STORED IN RIAL, not Toman. `product-rules.ts` parses the admin
//    Toman input through `parseTomanToRial`, and `catalog/format.ts`
//    (`formatPriceToman`) divides by 10 for display. Every price below is
//    authored in Toman and converted once via `RIAL()` so the unit is explicit.
//  * `Product` carries NO price and NO stock column. Price lives on
//    `ProductVariant.price`; stock lives on `Inventory.quantity` (1:1 with the
//    variant via the unique `variantId`). This script writes both, so the
//    storefront, cart and checkout all resolve real prices.
//  * Idempotent: every write is an upsert on a real unique key (product.slug,
//    variant.sku, productCategory composite PK, specification (productId,key),
//    inventory.variantId). Re-running repairs drift instead of duplicating.
//  * NO destructive deletes. Never touches users/orders/payments/reviews.
//  * Images are URL-only (no storage/upload infra). Every URL is preflighted;
//    see the image policy note below.
//  * Slugs are stable Latin/ASCII, matching the existing public slug policy.
//
// The Prisma client is constructed here (PrismaPg driver adapter) exactly like
// `prisma/seed-dev.mjs` and `scripts/verify-purchase-flow.mjs`. `src/lib/prisma.ts`
// is deliberately NOT imported: it resolves its adapter through a CommonJS
// `eval("require")` which is unavailable inside an ESM script process.

import "dotenv/config";

// ── Console helpers (Persian) ──────────────────────────────────────────────

const TAG = "[seed:products]";
const log = (message: string) => console.log(`${TAG} ${message}`);
const warn = (message: string) => console.warn(`${TAG} ⚠ ${message}`);
const fail = (message: string) => console.error(`${TAG} ✖ ${message}`);
const step = (message: string) => console.log(`${TAG} ── ${message}`);

const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
const fa = (value: number | string) =>
  String(value).replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]);

const T = 10; // 1 Toman = 10 Rial
const RIAL = (toman: number) => Math.round(toman * T);
const toman = (rial: number) => Math.round(rial / T).toLocaleString("en-US");

// ── CLI flags ──────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const DRY_RUN = argv.includes("--dry-run");
const FORCE_PLACEHOLDER = argv.includes("--placeholder-images");

// ── Image policy ───────────────────────────────────────────────────────────
//
// Product imagery is URL-only (the repo has no upload/storage infrastructure)
// and `next.config.ts` already allow-lists the `images.unsplash.com` hostname
// for `next/image`.
//
// IMPORTANT: the Unsplash photo ids below are authored by hand and therefore
// UNVERIFIED. A wrong id is a 404 image in the production storefront, so this
// script never trusts them blindly — `preflightImages()` performs a real HTTP
// probe of every distinct URL before anything is written, substitutes a
// deterministic placeholder for anything that fails to resolve, and refuses to
// run at all when zero URLs resolve (unless --placeholder-images is passed).
// Replace a `PHOTO_ID` below with a real id to promote a product to a live
// Unsplash photo; the probe picks it up on the next run.
const PHOTO_IDS = [
  "photo-1585704032915-c3400ca199e7",
  "photo-1523362628745-0c100150b504",
  "photo-1548839140-29a749e1cf4d",
  "photo-1584622650111-993a426fbf0a",
  "photo-1607472586893-edb57bdc0e39",
  "photo-1600566753086-00f18fb6b3ea",
  "photo-1556911220-bff31c812dba",
  "photo-1610701596007-11502861dcfa",
  "photo-1556909114-f6e7ad7d3136",
  "photo-1588854337221-4cf9fa96059c",
  "photo-1522708323590-d24dbb6b0267",
  "photo-1559839734-2b71ea197ec2",
  "photo-1628595351029-c2bf17511435",
  "photo-1602143407151-7111542de6e8",
  "photo-1584464491033-06628f3a6b7b",
  "photo-1600489000022-c2086d79f9d4",
  "photo-1558211583-d26f610c1eb1",
  "photo-1626785774573-4b799315345d",
  "photo-1601979031925-424e53b6caaa",
  "photo-1584473457493-17c4c24290c8",
] as const;

/** Unsplash crop presets, rotated so `PHOTO_IDS.length * CROPS.length` unique URLs exist. */
const CROPS = ["entropy", "edges", "faces", "bottom"] as const;

/**
 * Builds an Unsplash CDN URL. The crop preset varies with `variant` so all 40
 * products resolve to distinct URLs rather than 20 photos reused twice.
 */
function unsplash(variant: number): string {
  const id = PHOTO_IDS[variant % PHOTO_IDS.length];
  const crop = CROPS[Math.floor(variant / PHOTO_IDS.length) % CROPS.length];
  return `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&h=800&q=80&crop=${crop}`;
}

/** Deterministic, always-live fallback used for URLs the probe rejects. */
function placeholderFor(slug: string): string {
  return `https://picsum.photos/seed/reyhan-${slug}/800/800`;
}

// ── Domain types ───────────────────────────────────────────────────────────

type SeedSpec = { key: string; value: string };

type SeedCategory = {
  slug: string;
  name: string;
  description: string;
  sortOrder: number;
  level: number;
  parentSlug: string | null;
};

type SeedProduct = {
  title: string;
  slug: string;
  shortDescription: string;
  description: string;
  categorySlugs: string[];
  isFeatured: boolean;
  /** Authored in Toman; converted to Rial on write. */
  priceToman: number;
  compareAtPriceToman: number | null;
  weightGrams: number;
  stock: number;
  sku: string;
  variantTitle: string;
  seoKeywords: string;
  specifications: SeedSpec[];
};

// ── Categories (parent-first so the parentId FK always resolves) ───────────

const CATEGORIES: SeedCategory[] = [
  {
    slug: "water-purification-devices",
    name: "دستگاه‌های تصفیه آب",
    description: "دستگاه‌های خانگی و صنعتی تصفیه آب با فناوری اسمز معکوس و فیلتراسیون چندمرحله‌ای.",
    sortOrder: 10,
    level: 0,
    parentSlug: null,
  },
  {
    slug: "filters",
    name: "فیلترها",
    description: "فیلترهای الیافی، کربنی و ممبران؛ مصرفی و دوره‌ای برای دستگاه‌های تصفیه آب.",
    sortOrder: 20,
    level: 0,
    parentSlug: null,
  },
  {
    slug: "spare-parts",
    name: "قطعات یدکی",
    description: "پمپ، مخزن و شیر برقی؛ قطعات یدکی اصلی دستگاه‌های تصفیه آب.",
    sortOrder: 30,
    level: 0,
    parentSlug: null,
  },
  {
    slug: "accessories",
    name: "لوازم جانبی",
    description: "شلنگ، شیر برداشت و کیت نصب؛ اقلام جانبی نصب و نگهداری دستگاه.",
    sortOrder: 40,
    level: 0,
    parentSlug: null,
  },
  {
    slug: "under-sink",
    name: "زیرسینکی",
    description: "دستگاه‌های زیرسینکی مناسب نصب زیر کابینت آشپزخانه.",
    sortOrder: 1,
    level: 1,
    parentSlug: "water-purification-devices",
  },
  {
    slug: "countertop",
    name: "رومیزی",
    description: "دستگاه‌های رومیزی و قابل حمل بدون نیاز به نصب لوله‌کشی.",
    sortOrder: 2,
    level: 1,
    parentSlug: "water-purification-devices",
  },
  {
    slug: "industrial-purifiers",
    name: "دستگاه‌های صنعتی",
    description: "دستگاه‌های تصفیه آب ظرفیت بالا برای مجتمع‌ها و واحدهای صنعتی.",
    sortOrder: 3,
    level: 1,
    parentSlug: "water-purification-devices",
  },
  {
    slug: "membrane-filters",
    name: "فیلتر ممبران",
    description: "فیلترهای ممبران اسمز معکوس؛ هسته اصلی حذف املاح محلول.",
    sortOrder: 1,
    level: 1,
    parentSlug: "filters",
  },
  {
    slug: "sediment-filters",
    name: "فیلترهای الیافی و شنی",
    description: "فیلترهای پیش‌پالایش حذف ذرات معلق، رسوب و شن.",
    sortOrder: 2,
    level: 1,
    parentSlug: "filters",
  },
  {
    slug: "carbon-filters",
    name: "فیلترهای کربنی",
    description: "فیلترهای کربن فعال حذف کلر، بو و طعم نامطبوع آب.",
    sortOrder: 3,
    level: 1,
    parentSlug: "filters",
  },
  {
    slug: "pumps-and-tanks",
    name: "پمپ‌ها و مخازن",
    description: "پمپ تقویتی و مخزن ذخیره تحت فشار دستگاه‌های تصفیه آب.",
    sortOrder: 1,
    level: 1,
    parentSlug: "spare-parts",
  },
];

// ── Products ───────────────────────────────────────────────────────────────
//
// 20 water purifier units  → price 3,500,000 – 12,000,000 Toman
// 20 spare parts & filters → price    150,000 –  1,200,000 Toman
//
// `sku` must match the admin SKU_PATTERN (/^[A-Za-z0-9._:\-]+$/) and stay under
// VARIANT_SKU_MAX (64). Titles must stay under PRODUCT_TITLE_MAX (200).

const PRODUCTS: SeedProduct[] = [
  // ── ۲۰ دستگاه تصفیه آب ───────────────────────────────────────────────────
  {
    title: "دستگاه تصفیه آب ۶ مرحله‌ای ایزی‌ول مدل RO-116",
    slug: "easywell-ro-116-6-stage",
    shortDescription:
      "دستگاه تصفیه آب زیرسینکی ۶ مرحله‌ای ایزی‌ول با فناوری اسمز معکوس، مناسب آب شهری با املاح متوسط.",
    description:
      "دستگاه تصفیه آب ۶ مرحله‌ای ایزی‌ول مدل RO-116 با فناوری اسمز معکوس، مناسب آب شهری و آب با املاح کم تا متوسط. آب در شش مرحله فیلترهای الیافی PP، کربن گرانول UDF، کربن بلاک CTO، ممبران RO، پست‌کربن و مینرال عبور می‌کند و آبی تصفیه‌شده و سالم تحویل می‌دهد. بدنه فشار قوی، مخزن ذخیره ۱۶ لیتری و شیر برداشت اهرمی از ویژگی‌های این مدل است.",
    categorySlugs: ["water-purification-devices", "under-sink"],
    isFeatured: true,
    priceToman: 8_500_000,
    compareAtPriceToman: 9_800_000,
    weightGrams: 9_500,
    stock: 24,
    sku: "REY-EW-RO116-V1",
    variantTitle: "پکیج استاندارد ۶ مرحله‌ای با مخزن",
    seoKeywords: "دستگاه تصفیه آب, ایزی‌ول, RO-116, تصفیه آب خانگی, اسمز معکوس",
    specifications: [
      { key: "تعداد مراحل فیلتراسیون", value: "۶ مرحله" },
      { key: "نوع فناوری", value: "اسمز معکوس (RO)" },
      { key: "ظرفیت تولید", value: "۵۰ گالن در روز (حدود ۱۸۹ لیتر)" },
      { key: "مخزن ذخیره", value: "۱۶ لیتر" },
      { key: "نوع نصب", value: "زیرسینکی" },
      { key: "گارانتی", value: "۱۸ ماه" },
    ],
  },
  {
    title: "دستگاه تصفیه آب ۷ مرحله‌ای ایزی‌ول مدل ER-720",
    slug: "easywell-er-720-7-stage",
    shortDescription:
      "دستگاه تصفیه آب ۷ مرحله‌ای ایزی‌ول با مخزن بزرگ‌تر و پمپ تقویتی، مناسب خانواده‌های پرمصرف.",
    description:
      "دستگاه تصفیه آب ۷ مرحله‌ای ایزی‌ول مدل ER-720 برای خانواده‌هایی طراحی شده که مصرف آب روزانه بالاتری دارند. علاوه بر هفت مرحله فیلتراسیون کامل، این مدل مجهز به پمپ تقویتی خودکار و مخزن ۲۴ لیتری است تا فشار آب خروجی پایدار بماند. نمایشگر وضعیت فیلترها عمر باقی‌مانده هر مرحله را نشان می‌دهد.",
    categorySlugs: ["water-purification-devices", "under-sink"],
    isFeatured: true,
    priceToman: 9_750_000,
    compareAtPriceToman: 11_200_000,
    weightGrams: 11_800,
    stock: 18,
    sku: "REY-EW-ER720-V1",
    variantTitle: "پکیج خانوادگی ۷ مرحله‌ای",
    seoKeywords: "دستگاه تصفیه آب, ایزی‌ول, ER-720, تصفیه آب خانوادگی",
    specifications: [
      { key: "تعداد مراحل فیلتراسیون", value: "۷ مرحله" },
      { key: "مخزن ذخیره", value: "۲۴ لیتر" },
      { key: "پمپ", value: "تقویتی خودکار" },
      { key: "نمایشگر وضعیت فیلتر", value: "دارد" },
      { key: "گارانتی", value: "۱۸ ماه" },
    ],
  },
  {
    title: "دستگاه تصفیه آب رومیزی ۵ مرحله‌ای گیتا مدل G-500",
    slug: "gita-g500-countertop-5-stage",
    shortDescription:
      "دستگاه تصفیه آب رومیزی ۵ مرحله‌ای گیتا، قابل حمل و مناسب آپارتمان بدون فضای نصب.",
    description:
      "دستگاه تصفیه آب رومیزی گیتا مدل G-500 نیازی به نصب لوله‌کشی ندارد و تنها با اتصال به شیر سرد کار می‌کند. پنج مرحله فیلتراسیون شامل فیلتر الیافی، دو مرحله کربنی، ممبران و فیلتر مینرال، طعم و بوی آب شهری را به‌طور محسوس کاهش می‌دهد. بدنه کم‌ارتفاع و طراحی رومیزی آن برای آشپزخانه‌های کوچک مناسب است.",
    categorySlugs: ["water-purification-devices", "countertop"],
    isFeatured: false,
    priceToman: 4_200_000,
    compareAtPriceToman: null,
    weightGrams: 4_100,
    stock: 32,
    sku: "REY-GT-G500-V1",
    variantTitle: "نسخه رومیزی استاندارد",
    seoKeywords: "تصفیه آب رومیزی, گیتا, G-500, دستگاه تصفیه آب آپارتمان",
    specifications: [
      { key: "تعداد مراحل فیلتراسیون", value: "۵ مرحله" },
      { key: "نوع نصب", value: "رومیزی" },
      { key: "مخزن", value: "دارد (قابل جداشدن)" },
      { key: "برق", value: "بدون نیاز به برق" },
    ],
  },
  {
    title: "دستگاه تصفیه آب رومیزی سیلکو مدل Aqua-3",
    slug: "silco-aqua-3-countertop",
    shortDescription:
      "دستگاه تصفیه آب رومیزی سیلکو Aqua-3 با سه مرحله فیلتراسیون، گزینه‌ای اقتصادی و سریع.",
    description:
      "دستگاه تصفیه آب رومیزی سیلکو مدل Aqua-3 یک راه‌حل اقتصادی برای آپارتمان‌هایی است که فضای نصب زیرسینکی ندارند. سه مرحله فیلتراسیون شامل فیلتر الیافی، فیلتر کربن و ممبران، آلاینده‌های رایج آب شهری را کاهش می‌دهد. نصب آن کمتر از دو دقیقه زمان می‌برد و کل دستگاه قابل شست‌وشو است.",
    categorySlugs: ["water-purification-devices", "countertop"],
    isFeatured: false,
    priceToman: 3_850_000,
    compareAtPriceToman: 4_400_000,
    weightGrams: 3_600,
    stock: 40,
    sku: "REY-SC-AQUA3-V1",
    variantTitle: "نسخه رومیزی سه مرحله‌ای",
    seoKeywords: "تصفیه آب رومیزی, سیلکو, Aqua-3, تصفیه آب ارزان",
    specifications: [
      { key: "تعداد مراحل فیلتراسیون", value: "۳ مرحله" },
      { key: "نوع نصب", value: "رومیزی" },
      { key: "زمان نصب", value: "حدود ۲ دقیقه" },
      { key: "قابلیت شست‌وشو", value: "دارد" },
    ],
  },
  {
    title: "دستگاه تصفیه آب ۶ مرحله‌ای آکواپرو مدل AP-600",
    slug: "aquapro-ap-600-6-stage",
    shortDescription:
      "دستگاه تصفیه آب ۶ مرحله‌ای آکواپرو با بدنه ضدزنگ و فیلترهای پیش‌پالایش کامل.",
    description:
      "دستگاه تصفیه آب آکواپرو مدل AP-600 با بدنه استیل ضدزنگ و شش مرحله فیلتراسیون، گزینه‌ای بادوام برای آشپزخانه است. فیلترهای پیش‌پالایش سه‌گانه از ورود ذرات معلق به ممبران جلوگیری می‌کنند و عمر ممبران را افزایش می‌دهند. شیر برداشت اهرمی استیل با روکش کروم، ظاهر دستگاه را با کابینت هماهنگ می‌کند.",
    categorySlugs: ["water-purification-devices", "under-sink"],
    isFeatured: false,
    priceToman: 7_900_000,
    compareAtPriceToman: null,
    weightGrams: 10_200,
    stock: 21,
    sku: "REY-AP-AP600-V1",
    variantTitle: "پکیج استاندارد با بدنه استیل",
    seoKeywords: "دستگاه تصفیه آب, آکواپرو, AP-600, تصفیه آب زیرسینکی",
    specifications: [
      { key: "جنس بدنه", value: "استیل ضدزنگ" },
      { key: "تعداد مراحل فیلتراسیون", value: "۶ مرحله" },
      { key: "شیر برداشت", value: "اهرمی کروم‌دار" },
      { key: "گارانتی", value: "۱۲ ماه" },
    ],
  },
  {
    title: "دستگاه تصفیه آب زیرسینکی پریمیوم ایزی‌ول مدل EZ-900",
    slug: "easywell-ez-900-premium-under-sink",
    shortDescription:
      "دستگاه تصفیه آب پریمیوم ۸ مرحله‌ای ایزی‌ول با مخزن استیلی و سیستم هوشمند قطع خودکار.",
    description:
      "دستگاه تصفیه آب پریمیوم ایزی‌ول مدل EZ-900 بالاترین رده محصولات این برند است. هشت مرحله فیلتراسیون با افزودن فیلتر مینرال و ضد باکتری، آبی با طعم طبیعی تولید می‌کند. مخزن استیلی ۲۰ لیتری، سیستم هشدار تعویض فیلتر و قطع خودکار جریان آب هنگام نرسیدن فشار، از قابلیت‌های شاخص این مدل است.",
    categorySlugs: ["water-purification-devices", "under-sink"],
    isFeatured: true,
    priceToman: 12_000_000,
    compareAtPriceToman: 13_500_000,
    weightGrams: 14_500,
    stock: 12,
    sku: "REY-EW-EZ900-V1",
    variantTitle: "پکیج پریمیوم با مخزن استیلی",
    seoKeywords: "تصفیه آب پریمیوم, ایزی‌ول, EZ-900, دستگاه تصفیه آب خانگی",
    specifications: [
      { key: "تعداد مراحل فیلتراسیون", value: "۸ مرحله" },
      { key: "مخزن ذخیره", value: "۲۰ لیتر استیلی" },
      { key: "سیستم هشدار فیلتر", value: "دارد" },
      { key: "قطع خودکار جریان", value: "دارد" },
      { key: "گارانتی", value: "۲۴ ماه" },
    ],
  },
  {
    title: "دستگاه تصفیه آب ۵ مرحله‌ای کنتال مدل K5-RO",
    slug: "kantal-k5-ro-5-stage",
    shortDescription:
      "دستگاه تصفیه آب ۵ مرحله‌ای کنتال با قیمت مناسب و مصرف بهینه انرژی برای آب شهری.",
    description:
      "دستگاه تصفیه آب کنتال مدل K5-RO راهکاری مقرون‌به‌صرفه برای تصفیه آب شهری با املاح کم تا متوسط است. پنج مرحله فیلتراسیون، آب را از فیلتر الیافی و کربنی عبور داده و سپس با ممبران اسمز معکوس املاح محلول را حذف می‌کند. مصرف برق این دستگاه ناچیز است و بدون برق نیز می‌تواند آب تصفیه تولید کند.",
    categorySlugs: ["water-purification-devices", "under-sink"],
    isFeatured: false,
    priceToman: 6_400_000,
    compareAtPriceToman: 7_100_000,
    weightGrams: 8_200,
    stock: 27,
    sku: "REY-KT-K5RO-V1",
    variantTitle: "پکیج اقتصادی ۵ مرحله‌ای",
    seoKeywords: "دستگاه تصفیه آب, کنتال, K5-RO, تصفیه آب اقتصادی",
    specifications: [
      { key: "تعداد مراحل فیلتراسیون", value: "۵ مرحله" },
      { key: "مصرف برق", value: "بسیار کم (قابل استفاده بدون برق)" },
      { key: "مخزن", value: "۱۲ لیتر" },
      { key: "گارانتی", value: "۱۲ ماه" },
    ],
  },
  {
    title: "دستگاه تصفیه آب ۶ مرحله‌ای پیوری‌وان مدل PO-600",
    slug: "pureone-po-600-6-stage",
    shortDescription:
      "دستگاه تصفیه آب ۶ مرحله‌ای پیوری‌وان با شیر برداشت سه‌حالته و نصب سریع.",
    description:
      "دستگاه تصفیه آب پیوری‌وان مدل PO-600 با تمرکز بر سهولت نصب طراحی شده است. شیر برداشت سه‌حالته، حالت انتخاب آب تصفیه یا آب معمولی را در یک حرکت در اختیار کاربر می‌گذارد. شش مرحله فیلتراسیون شامل ممبران، دو فیلتر کربنی و دو فیلتر الیافی، آب شهری را به آبی با طعم مطلوب تبدیل می‌کند.",
    categorySlugs: ["water-purification-devices", "under-sink"],
    isFeatured: false,
    priceToman: 7_250_000,
    compareAtPriceToman: null,
    weightGrams: 9_800,
    stock: 19,
    sku: "REY-PO-PO600-V1",
    variantTitle: "پکیج استاندارد با شیر سه‌حالته",
    seoKeywords: "دستگاه تصفیه آب, پیوری‌وان, PO-600, شیر سه حالته",
    specifications: [
      { key: "تعداد مراحل فیلتراسیون", value: "۶ مرحله" },
      { key: "شیر برداشت", value: "سه‌حالته" },
      { key: "نوع نصب", value: "زیرسینکی" },
      { key: "گارانتی", value: "۱۸ ماه" },
    ],
  },
  {
    title: "دستگاه تصفیه آب رومیزی جی‌پی‌اس مدل GPS-12",
    slug: "gps-12-countertop-purifier",
    shortDescription:
      "دستگاه تصفیه آب رومیزی جی‌پی‌اس مدل GPS-12، سبک و مناسب سفر و اجاره.",
    description:
      "دستگاه تصفیه آب رومیزی جی‌پی‌اس مدل GPS-12 یکی از سبک‌ترین دستگاه‌های بازار با وزن کمتر از ۳ کیلوگرم است. این دستگاه برای استفاده موقت در محل کار، ویلا و سفر طراحی شده و با باتری داخلی قابل حمل است. چهار مرحله فیلتراسیون، برای آب آشامیدنی در شرایط اضطراری کافی است.",
    categorySlugs: ["water-purification-devices", "countertop"],
    isFeatured: false,
    priceToman: 3_700_000,
    compareAtPriceToman: null,
    weightGrams: 2_900,
    stock: 45,
    sku: "REY-GP-GPS12-V1",
    variantTitle: "نسخه قابل حمل با باتری",
    seoKeywords: "تصفیه آب قابل حمل, جی‌پی‌اس, GPS-12, تصفیه آب سفر",
    specifications: [
      { key: "تعداد مراحل فیلتراسیون", value: "۴ مرحله" },
      { key: "وزن", value: "کمتر از ۳ کیلوگرم" },
      { key: "تغذیه", value: "باتری داخلی" },
      { key: "قابل حمل", value: "بله" },
    ],
  },
  {
    title: "دستگاه تصفیه آب ۷ مرحله‌ای ویسترن مدل WST-7",
    slug: "western-wst-7-stage",
    shortDescription:
      "دستگاه تصفیه آب ۷ مرحله‌ای ویسترن با ظرفیت تولید بالا و مخزن ۲۰ لیتری.",
    description:
      "دستگاه تصفیه آب ویسترن مدل WST-7 برای خانواده‌های پرمصرف طراحی شده و روزانه حدود ۷۵ گالن آب تصفیه تولید می‌کند. هفت مرحله فیلتراسیون با ممبران ۱۳ لایه، علاوه بر حذف املاح، فلزات سنگین و کلر باقی‌مانده را نیز کاهش می‌دهد. مخزن ۲۰ لیتری و شیر برداشت سه‌حالته از امکانات این مدل است.",
    categorySlugs: ["water-purification-devices", "under-sink"],
    isFeatured: false,
    priceToman: 10_500_000,
    compareAtPriceToman: null,
    weightGrams: 12_400,
    stock: 14,
    sku: "REY-WS-WST7-V1",
    variantTitle: "پکیج ظرفیت بالا",
    seoKeywords: "دستگاه تصفیه آب, ویسترن, WST-7, تصفیه آب پرظرفیت",
    specifications: [
      { key: "تعداد مراحل فیلتراسیون", value: "۷ مرحله" },
      { key: "ظرفیت تولید", value: "۷۵ گالن در روز" },
      { key: "مخزن ذخیره", value: "۲۰ لیتر" },
      { key: "نوع ممبران", value: "۱۳ لایه" },
    ],
  },
  {
    title: "دستگاه تصفیه آب بدون مخزن ایزی‌ول مدل ER-321",
    slug: "easywell-er-321-tankless",
    shortDescription:
      "دستگاه تصفیه آب بدون مخزن ایزی‌ول، تصفیه مستقیم و بدون راکد آب تصفیه‌شده.",
    description:
      "دستگاه تصفیه آب بدون مخزن ایزی‌ول مدل ER-321 آب تصفیه‌شده را بلافاصله پس از تصفیه به شیر برداشت می‌فرستد و فضای زیادی زیر کابینت آزاد می‌کند. این روش مانع رشد باکتری در مخزن و عمر کوتاه‌تر آب ذخیره‌شده می‌شود. نمایشگر LED وضعیت فیلترها را نشان می‌دهد و شیر برداشت الکترونیکی است.",
    categorySlugs: ["water-purification-devices", "under-sink"],
    isFeatured: false,
    priceToman: 11_200_000,
    compareAtPriceToman: 12_800_000,
    weightGrams: 7_600,
    stock: 10,
    sku: "REY-EW-ER321-V1",
    variantTitle: "پکیج بدون مخزن",
    seoKeywords: "تصفیه آب بدون مخزن, ایزی‌ول, ER-321, تصفیه آب آنی",
    specifications: [
      { key: "مخزن", value: "ندارد (تصفیه مستقیم)" },
      { key: "شیر برداشت", value: "الکترونیکی" },
      { key: "نمایشگر وضعیت", value: "LED" },
      { key: "گارانتی", value: "۲۴ ماه" },
    ],
  },
  {
    title: "دستگاه تصفیه آب صنعتی ۲۰۰ گالنی سیلکو مدل IND-200",
    slug: "silco-ind-200-industrial",
    shortDescription:
      "دستگاه تصفیه آب صنعتی سیلکو با ظرفیت ۲۰۰ گالن در روز، مناسب مجتمع‌های مسکونی.",
    description:
      "دستگاه تصفیه آب صنعتی سیلکو مدل IND-200 برای مجتمع‌های مسکونی، هتل‌ها و واحدهای تولیدی با مصرف بالا طراحی شده است. این دستگاه روزانه حدود ۲۰۰ گالن آب تصفیه تولید می‌کند و مجهز به سیستم کنترل خودکار فشار و هشدار نیازمندی سرویس دوره‌ای است. شاسی فلزی و پمپ‌های صنعتی، دوام آن را در شرایط سخت تضمین می‌کنند.",
    categorySlugs: ["water-purification-devices", "industrial-purifiers"],
    isFeatured: false,
    priceToman: 11_800_000,
    compareAtPriceToman: null,
    weightGrams: 42_000,
    stock: 6,
    sku: "REY-SC-IND200-V1",
    variantTitle: "پکیج صنعتی ۲۰۰ گالن",
    seoKeywords: "دستگاه تصفیه آب صنعتی, سیلکو, IND-200, تصفیه آب مجتمع",
    specifications: [
      { key: "ظرفیت تولید", value: "۲۰۰ گالن در روز" },
      { key: "کنترل", value: "خودکار با هشدار سرویس" },
      { key: "جنس شاسی", value: "فلزی" },
      { key: "کاربرد", value: "مجتمع، هتل، واحد تولیدی" },
    ],
  },
  {
    title: "دستگاه تصفیه آب صنعتی ۱۰۰ گالنی آکواپرو مدل IND-100",
    slug: "aquapro-ind-100-industrial",
    shortDescription:
      "دستگاه تصفیه آب صنعتی آکواپرو با ظرفیت ۱۰۰ گالن در روز و تابلوی کنترل دیجیتال.",
    description:
      "دستگاه تصفیه آب صنعتی آکواپرو مدل IND-100 راهکاری متعادل برای ساختمان‌های اداری و رستوران‌ها با مصرف متوسط است. تابلوی کنترل دیجیتال، فشار و مدت زمان کارکرد را نمایش می‌دهد و پمپ‌های اضافه‌افزونه از عملکرد مداوم دستگاه محافظت می‌کنند. شش مرحله فیلتراسیون برای آب با املاح متوسط طراحی شده است.",
    categorySlugs: ["water-purification-devices", "industrial-purifiers"],
    isFeatured: false,
    priceToman: 9_400_000,
    compareAtPriceToman: 10_600_000,
    weightGrams: 31_000,
    stock: 8,
    sku: "REY-AP-IND100-V1",
    variantTitle: "پکیج صنعتی ۱۰۰ گالن",
    seoKeywords: "دستگاه تصفیه آب صنعتی, آکواپرو, IND-100, تصفیه آب رستوران",
    specifications: [
      { key: "ظرفیت تولید", value: "۱۰۰ گالن در روز" },
      { key: "تابلوی کنترل", value: "دیجیتال" },
      { key: "تعداد مراحل", value: "۶ مرحله" },
      { key: "پمپ", value: "اضافه‌افزونه" },
    ],
  },
  {
    title: "دستگاه تصفیه آب ۶ مرحله‌ای همو مدل HM-6",
    slug: "hemo-hm-6-stage",
    shortDescription:
      "دستگاه تصفیه آب ۶ مرحله‌ای همو با فیلتر ضد باکتری و بدنه کم‌ارتفاع.",
    description:
      "دستگاه تصفیه آب همو مدل HM-6 با تمرکز بر ایمنی آب طراحی شده و علاوه بر ممبران، یک فیلتر ضد باکتری نیز دارد. بدنه کم‌ارتفاع آن زیر کابینت‌های کوتاه نیز جا می‌شود. شش مرحله فیلتراسیون، بو و طعم کلر را به‌طور محسوس کاهش می‌دهد و فیلترها به‌سادگی تعویض می‌شوند.",
    categorySlugs: ["water-purification-devices", "under-sink"],
    isFeatured: false,
    priceToman: 6_900_000,
    compareAtPriceToman: null,
    weightGrams: 7_900,
    stock: 23,
    sku: "REY-HM-HM6-V1",
    variantTitle: "پکیج استاندارد ۶ مرحله‌ای",
    seoKeywords: "دستگاه تصفیه آب, همو, HM-6, فیلتر ضد باکتری",
    specifications: [
      { key: "تعداد مراحل فیلتراسیون", value: "۶ مرحله" },
      { key: "فیلتر ضد باکتری", value: "دارد" },
      { key: "ارتفاع بدنه", value: "کم‌ارتفاع" },
      { key: "گارانتی", value: "۱۲ ماه" },
    ],
  },
  {
    title: "دستگاه تصفیه آب رومیزی ۶ مرحله‌ای زیست‌آب مدل ZS-6",
    slug: "zistab-zs-6-countertop",
    shortDescription:
      "دستگاه تصفیه آب رومیزی زیست‌آب با شش مرحله فیلتراسیون و قیمت اقتصادی.",
    description:
      "دستگاه تصفیه آب رومیزی زیست‌آب مدل ZS-6 شش مرحله فیلتراسیون را در بدنه‌ای جمع‌وجور ارائه می‌دهد. علاوه بر ممبران، فیلتر کربن بلاک و فیلتر مینرال نیز در مسیر آب قرار گرفته‌اند تا طعم آب بهبود یابد. این دستگاه بدون نصب و فقط با اتصال به شیر آب سرد کار می‌کند.",
    categorySlugs: ["water-purification-devices", "countertop"],
    isFeatured: false,
    priceToman: 4_650_000,
    compareAtPriceToman: 5_300_000,
    weightGrams: 4_400,
    stock: 35,
    sku: "REY-ZS-ZS6-V1",
    variantTitle: "نسخه رومیزی شش مرحله‌ای",
    seoKeywords: "تصفیه آب رومیزی, زیست‌آب, ZS-6, تصفیه آب آشپزخانه",
    specifications: [
      { key: "تعداد مراحل فیلتراسیون", value: "۶ مرحله" },
      { key: "نوع نصب", value: "رومیزی" },
      { key: "فیلتر مینرال", value: "دارد" },
      { key: "نصب", value: "بدون لوله‌کشی" },
    ],
  },
  {
    title: "دستگاه تصفیه آب ۵ مرحله‌ای سایسان مدل SS-500",
    slug: "sisan-ss-500-5-stage",
    shortDescription:
      "دستگاه تصفیه آب ۵ مرحله‌ای سایسان با مخزن ۱۴ لیتری و ساختار ضد نشتی.",
    description:
      "دستگاه تصفیه آب سایسان مدل SS-500 با ساختار هوزینگ ضد نشتی طراحی شده تا در صورت تعویض فیلتر، آبی روی زمین نریزد. پنج مرحله فیلتراسیون شامل دو فیلتر الیافی، یک فیلتر کربنی، ممبران و فیلتر مینرال، آب شهری را قابل آشامدن می‌کند. مخزن ۱۴ لیتری فضای مناسبی را اشغال نمی‌کند.",
    categorySlugs: ["water-purification-devices", "under-sink"],
    isFeatured: false,
    priceToman: 5_800_000,
    compareAtPriceToman: null,
    weightGrams: 8_600,
    stock: 26,
    sku: "REY-SS-SS500-V1",
    variantTitle: "پکیج استاندارد ضد نشتی",
    seoKeywords: "دستگاه تصفیه آب, سایسان, SS-500, تصفیه آب زیرسینکی",
    specifications: [
      { key: "تعداد مراحل فیلتراسیون", value: "۵ مرحله" },
      { key: "ساختار", value: "هوزینگ ضد نشتی" },
      { key: "مخزن", value: "۱۴ لیتر" },
      { key: "گارانتی", value: "۱۲ ماه" },
    ],
  },
  {
    title: "دستگاه تصفیه آب ۸ مرحله‌ای ایزی‌ول مدل ER-800",
    slug: "easywell-er-800-8-stage",
    shortDescription:
      "دستگاه تصفیه آب ۸ مرحله‌ای ایزی‌ول با فیلتر قلیایی و تنظیم TDS.",
    description:
      "دستگاه تصفیه آب ایزی‌ول مدل ER-800 هشت مرحله فیلتراسیون را با فیلتر قلیایی ترکیب می‌کند تا pH آب تصفیه‌شده متعادل شود. نمایشگر TDS مقدار املاح آب را پیش و پس از تصفیه نشان می‌دهد و کارایی دستگاه قابل سنجش است. این مدل برای مناطقی که آب بسیار سخت دارند توصیه می‌شود.",
    categorySlugs: ["water-purification-devices", "under-sink"],
    isFeatured: false,
    priceToman: 11_500_000,
    compareAtPriceToman: null,
    weightGrams: 13_200,
    stock: 11,
    sku: "REY-EW-ER800-V1",
    variantTitle: "پکیج ۸ مرحله‌ای با فیلتر قلیایی",
    seoKeywords: "دستگاه تصفیه آب, ایزی‌ول, ER-800, فیلتر قلیایی, TDS",
    specifications: [
      { key: "تعداد مراحل فیلتراسیون", value: "۸ مرحله" },
      { key: "فیلتر قلیایی", value: "دارد" },
      { key: "نمایشگر TDS", value: "دارد" },
      { key: "مناسب برای", value: "آب سخت" },
    ],
  },
  {
    title: "دستگاه تصفیه آب رومیزی آوند مدل AV-CT3",
    slug: "avand-av-ct3-countertop",
    shortDescription:
      "دستگاه تصفیه آب رومیزی آوند مدل AV-CT3، ارزان‌ترین گزینه رومیزی برای آب شهری.",
    description:
      "دستگاه تصفیه آب رومیزی آوند مدل AV-CT3 ساده، بی‌دغدغه و کم‌مصرف است. سه مرحله فیلتراسیون شامل فیلتر الیافی، فیلتر کربنی و فیلتر سرامیکی، طعم و بوی نامطبوع آب شهری را کاهش می‌دهد. این دستگاه برای کسانی مناسب است که به دنبال یک راه‌حل کم‌هزینه برای آشامیدن آب هستند.",
    categorySlugs: ["water-purification-devices", "countertop"],
    isFeatured: false,
    priceToman: 3_500_000,
    compareAtPriceToman: 4_100_000,
    weightGrams: 3_200,
    stock: 50,
    sku: "REY-AV-CT3-V1",
    variantTitle: "نسخه رومیزی سه مرحله‌ای",
    seoKeywords: "تصفیه آب رومیزی, آوند, AV-CT3, تصفیه آب ارزان",
    specifications: [
      { key: "تعداد مراحل فیلتراسیون", value: "۳ مرحله" },
      { key: "نوع نصب", value: "رومیزی" },
      { key: "فیلتر سرامیکی", value: "دارد" },
      { key: "وزن", value: "۳٫۲ کیلوگرم" },
    ],
  },
  {
    title: "دستگاه تصفیه آب ۴ مرحله‌ای اکوپرو مدل EP-4",
    slug: "ecopro-ep-4-stage",
    shortDescription:
      "دستگاه تصفیه آب ۴ مرحله‌ای اکوپرو با بدنه کم‌مصرف و نصب سریع زیرسینکی.",
    description:
      "دستگاه تصفیه آب اکوپرو مدل EP-4 یک راه‌حل ساده و سریع برای بهبود کیفیت آب آشامیدنی است. چهار مرحله فیلتراسیون شامل فیلتر الیافی، دو فیلتر کربنی و ممبران، آلاینده‌های رایج را حذف می‌کند. بدنه کم‌مصرف و وزن سبک، نصب زیر کابینت را ساده و بی‌دردسر می‌کند.",
    categorySlugs: ["water-purification-devices", "under-sink"],
    isFeatured: false,
    priceToman: 4_900_000,
    compareAtPriceToman: null,
    weightGrams: 6_100,
    stock: 29,
    sku: "REY-EP-EP4-V1",
    variantTitle: "پکیج چهار مرحله‌ای",
    seoKeywords: "دستگاه تصفیه آب, اکوپرو, EP-4, تصفیه آب ساده",
    specifications: [
      { key: "تعداد مراحل فیلتراسیون", value: "۴ مرحله" },
      { key: "مصرف", value: "کم" },
      { key: "نوع نصب", value: "زیرسینکی" },
      { key: "گارانتی", value: "۱۲ ماه" },
    ],
  },
  {
    title: "دستگاه تصفیه آب ۶ مرحله‌ای تی‌پی‌تی مدل TPT-6",
    slug: "tpt-tpt-6-6-stage",
    shortDescription:
      "دستگاه تصفیه آب ۶ مرحله‌ای تی‌پی‌تی با پمپ خودکار و نمایشگر وضعیت فیلتر.",
    description:
      "دستگاه تصفیه آب تی‌پی‌تی مدل TPT-6 با پمپ خودکار، هنگام قطع جریان آب به‌طور خودکار خاموش می‌شود و از آسیب به پمپ جلوگیری می‌کند. نمایشگر وضعیت فیلتر، زمان تقریبی باقی‌مانده عمر هر فیلتر را اعلام می‌کند. شش مرحله فیلتراسیون برای آب شهری با املاح متوسط کافی است.",
    categorySlugs: ["water-purification-devices", "under-sink"],
    isFeatured: false,
    priceToman: 7_600_000,
    compareAtPriceToman: 8_900_000,
    weightGrams: 9_300,
    stock: 17,
    sku: "REY-TP-TPT6-V1",
    variantTitle: "پکیج ۶ مرحله‌ای با پمپ خودکار",
    seoKeywords: "دستگاه تصفیه آب, تی‌پی‌تی, TPT-6, پمپ خودکار",
    specifications: [
      { key: "تعداد مراحل فیلتراسیون", value: "۶ مرحله" },
      { key: "پمپ", value: "خودکار با قطع حفاظتی" },
      { key: "نمایشگر وضعیت فیلتر", value: "دارد" },
      { key: "گارانتی", value: "۱۵ ماه" },
    ],
  },

  // ── ۲۰ قطعه و فیلتر یدکی ──────────────────────────────────────────────────
  {
    title: "فیلتر ممبران ۱۳ لایه ۷۵ گالن فیلمتک",
    slug: "filmtec-membrane-75g-13-layer",
    shortDescription:
      "فیلتر ممبران ۱۳ لایه ۷۵ گالن فیلمتک، با دقت ۰٫۰۰۰۱ میکرون و حذف ۹۹٫۸٪ ناخالصی‌ها.",
    description:
      "فیلتر ممبران ۱۳ لایه ۷۵ گالن فیلمتک قلب تپنده دستگاه‌های اسمز معکوس است. این غشا با دقت ۰٫۰۰۰۱ میکرون، املاح محلول، فلزات سنگین، باکتری‌ها و بخشی از ویروس‌ها را حذف می‌کند. ساختار ۱۳ لایه، دوام بیشتری در برابر فشار بالا ایجاد می‌کند. عمر مفید آن معمولاً دو تا سه سال است.",
    categorySlugs: ["filters", "membrane-filters"],
    isFeatured: true,
    priceToman: 680_000,
    compareAtPriceToman: 780_000,
    weightGrams: 280,
    stock: 60,
    sku: "REY-FT-MEM75-V1",
    variantTitle: "بسته تکی ۷۵ گالن",
    seoKeywords: "فیلتر ممبران, ممبران فیلمتک, Filmtec, ممبران ۷۵ گالن",
    specifications: [
      { key: "ظرفیت", value: "۷۵ گالن در روز (۲۸۳ لیتر)" },
      { key: "تعداد لایه", value: "۱۳ لایه" },
      { key: "دقت فیلتراسیون", value: "۰٫۰۰۰۱ میکرون" },
      { key: "درصد حذف ناخالصی", value: "۹۹٫۸٪" },
      { key: "سازگاری", value: "هوزینگ استاندارد ۱۱ اینچی" },
      { key: "عمر مفید", value: "۲ تا ۳ سال" },
    ],
  },
  {
    title: "فیلتر ممبران ۱۳ لایه ۱۰۰ گالن",
    slug: "membrane-100g-13-layer",
    shortDescription:
      "فیلتر ممبران ۱۳ لایه ۱۰۰ گالن با دبی بالاتر، مناسب دستگاه‌های تصفیه آب پرظرفیت.",
    description:
      "فیلتر ممبران ۱۳ لایه ۱۰۰ گالن برای دستگاه‌های تصفیه آب با دبی بالا طراحی شده است. این غشا در مقایسه با نسخه ۷۵ گالن، آب بیشتری در هر ساعت تولید می‌کند و برای خانواده‌های پرمصرف مناسب است. دقت ۰٫۰۰۰۱ میکرون و ساختار ۱۳ لایه، کارایی و دوام را همزمان تأمین می‌کند.",
    categorySlugs: ["filters", "membrane-filters"],
    isFeatured: false,
    priceToman: 850_000,
    compareAtPriceToman: null,
    weightGrams: 340,
    stock: 48,
    sku: "REY-MEM-MEM100-V1",
    variantTitle: "بسته تکی ۱۰۰ گالن",
    seoKeywords: "فیلتر ممبران, ممبران ۱۰۰ گالن, ممبران پرظرفیت, تعویض ممبران",
    specifications: [
      { key: "ظرفیت", value: "۱۰۰ گالن در روز (۳۷۸ لیتر)" },
      { key: "تعداد لایه", value: "۱۳ لایه" },
      { key: "دقت فیلتراسیون", value: "۰٫۰۰۰۱ میکرون" },
      { key: "مناسب برای", value: "دستگاه‌های پرظرفیت" },
    ],
  },
  {
    title: "فیلتر ممبران ۷ لایه ۵۰ گالن",
    slug: "membrane-50g-7-layer",
    shortDescription:
      "فیلتر ممبران ۷ لایه ۵۰ گالن، انتخابی مناسب برای دستگاه‌های رومیزی و کم‌مصرف.",
    description:
      "فیلتر ممبران ۷ لایه ۵۰ گالن برای دستگاه‌های تصفیه آب رومیزی و مدل‌های کم‌ظرفیت ساخته شده است. ساختار ۷ لایه، تعادل مناسبی میان قیمت و دوام ایجاد می‌کند و دقت ۰٫۰۰۰۱ میکرون را حفظ می‌کند. پیش از نصب، دو بار با آب شیرین شست‌وشو دهید.",
    categorySlugs: ["filters", "membrane-filters"],
    isFeatured: false,
    priceToman: 420_000,
    compareAtPriceToman: 490_000,
    weightGrams: 210,
    stock: 85,
    sku: "REY-MEM-MEM50-V1",
    variantTitle: "بسته تکی ۵۰ گالن",
    seoKeywords: "فیلتر ممبران, ممبران ۵۰ گالن, ممبران رومیزی",
    specifications: [
      { key: "ظرفیت", value: "۵۰ گالن در روز (۱۸۹ لیتر)" },
      { key: "تعداد لایه", value: "۷ لایه" },
      { key: "دقت فیلتراسیون", value: "۰٫۰۰۰۱ میکرون" },
      { key: "مناسب برای", value: "دستگاه‌های رومیزی" },
    ],
  },
  {
    title: "فیلتر الیافی پلی‌پروپیلن ۵ میکرون ۱۰ اینچی",
    slug: "sediment-pp-5-micron-10-inch",
    shortDescription:
      "فیلتر الیافی پلی‌پروپیلن ۵ میکرون ۱۰ اینچی، حذف شن، شن‌ریزه و ذرات معلق آب.",
    description:
      "فیلتر الیافی پلی‌پروپیلن ۵ میکرون نخستین خط دفاعی دستگاه تصفیه آب است. این فیلتر شن، شن‌ریزه، زنگ‌زدگی لوله‌ها و ذرات معلق را پیش از رسیدن به فیلترهای کربنی و ممبران حذف می‌کند. الیاف پلی‌پروپیلن ضد پوسیدگی است و کیفیت آب را افت نمی‌دهد.",
    categorySlugs: ["filters", "sediment-filters"],
    isFeatured: false,
    priceToman: 185_000,
    compareAtPriceToman: null,
    weightGrams: 320,
    stock: 180,
    sku: "REY-SD-PP5-V1",
    variantTitle: "بسته تکی ۱۰ اینچی",
    seoKeywords: "فیلتر الیافی, فیلتر PP, فیلتر ۵ میکرون, فیلتر شنی آب",
    specifications: [
      { key: "جنس", value: "پلی‌پروپیلن (PP)" },
      { key: "دقت", value: "۵ میکرون" },
      { key: "سایز", value: "۱۰ اینچی استاندارد" },
      { key: "عمر مفید", value: "۳ تا ۶ ماه" },
    ],
  },
  {
    title: "فیلتر الیافی پلی‌پروپیلن ۱ میکرون",
    slug: "sediment-pp-1-micron",
    shortDescription:
      "فیلتر الیافی پلی‌پروپیلن ۱ میکرون برای حذف ذرات بسیار ریز و لجن آب.",
    description:
      "فیلتر الیافی پلی‌پروپیلن ۱ میکرون دقت بالاتری از نسخه ۵ میکرون دارد و ذرات ریزتر و لجن معلق را بهتر می‌گیرد. این فیلتر معمولاً به‌عنوان فیلتر نهایی پیش از مخزن یا در مرحله چهارم سیستم‌های چندمرحله‌ای به کار می‌رود. تعویض به‌موقع آن از گرفتگی ممبران جلوگیری می‌کند.",
    categorySlugs: ["filters", "sediment-filters"],
    isFeatured: false,
    priceToman: 240_000,
    compareAtPriceToman: 290_000,
    weightGrams: 340,
    stock: 140,
    sku: "REY-SD-PP1-V1",
    variantTitle: "بسته تکی ۱۰ اینچی",
    seoKeywords: "فیلتر الیافی, فیلتر ۱ میکرون, فیلتر PP ریز",
    specifications: [
      { key: "جنس", value: "پلی‌پروپیلن (PP)" },
      { key: "دقت", value: "۱ میکرون" },
      { key: "سایز", value: "۱۰ اینچی استاندارد" },
      { key: "کاربرد", value: "فیلتر نهایی پیش از مخزن" },
    ],
  },
  {
    title: "فیلتر کربن بلاک ۱۰ اینچی CTO",
    slug: "carbon-block-cto-10-inch",
    shortDescription:
      "فیلتر کربن بلاک CTO ۱۰ اینچی، جذب کلر و کاهش بو و طعم نامطبوع آب.",
    description:
      "فیلتر کربن بلاک CTO با ساختار فشرده کربن فعال، کلر باقی‌مانده، بو، طعم نامطبوع و برخی ترکیبات آلی را جذب می‌کند. تراکم بالای کربن در این فیلتر، سطح تماس بیشتری با آب ایجاد می‌کند و راندمان جذب را بالا می‌برد. عمر مفید آن حدود شش تا نه ماه است.",
    categorySlugs: ["filters", "carbon-filters"],
    isFeatured: false,
    priceToman: 195_000,
    compareAtPriceToman: null,
    weightGrams: 380,
    stock: 150,
    sku: "REY-CB-CTO-V1",
    variantTitle: "بسته تکی ۱۰ اینچی",
    seoKeywords: "فیلتر کربن بلاک, فیلتر CTO, حذف کلر, فیلتر کربنی",
    specifications: [
      { key: "نوع کربن", value: "بلاک فشرده (CTO)" },
      { key: "سایز", value: "۱۰ اینچی استاندارد" },
      { key: "کاربرد", value: "حذف کلر، بو و طعم" },
      { key: "عمر مفید", value: "۶ تا ۹ ماه" },
    ],
  },
  {
    title: "فیلتر کربن گرانول UDF ۱۰ اینچی",
    slug: "carbon-udf-granular-10-inch",
    shortDescription:
      "فیلتر کربن گرانول UDF با کربن فعال دانه‌ای، مناسب حذف کلر و پساب.",
    description:
      "فیلتر کربن گرانول UDF از دانه‌های کربن فعال ساخته شده و علاوه بر کلر، پساب‌های ناشی از مواد آلی را نیز کاهش می‌دهد. جریان آب از میان دانه‌های کربن عبور می‌کند و سطح تماس بسیار بزرگی ایجاد می‌شود. معمولاً در مرحله دوم سیستم‌های چندمرحله‌ای نصب می‌شود.",
    categorySlugs: ["filters", "carbon-filters"],
    isFeatured: false,
    priceToman: 150_000,
    compareAtPriceToman: 185_000,
    weightGrams: 360,
    stock: 165,
    sku: "REY-CB-UDF-V1",
    variantTitle: "بسته تکی ۱۰ اینچی",
    seoKeywords: "فیلتر کربن گرانول, فیلتر UDF, فیلتر کربنی, حذف پساب",
    specifications: [
      { key: "نوع کربن", value: "گرانولی (UDF/GAC)" },
      { key: "سایز", value: "۱۰ اینچی استاندارد" },
      { key: "کاربرد", value: "حذف کلر و پساب" },
      { key: "عمر مفید", value: "۶ تا ۹ ماه" },
    ],
  },
  {
    title: "پک فیلترهای پیش‌پالایش ۳ عددی PP و UDF و CTO",
    slug: "pre-filter-pack-3-stage",
    shortDescription:
      "پک ۳ عددی فیلترهای پیش‌پالایش شامل الیافی PP، کربن گرانول UDF و کربن بلاک CTO.",
    description:
      "پک فیلترهای پیش‌پالایش ۳ عددی، سه مرحله اول فیلتراسیون دستگاه را یکجا پوشش می‌دهد. بسته شامل یک فیلتر الیافی ۵ میکرون PP، یک فیلتر کربن گرانول UDF و یک فیلتر کربن بلاک CTO است. خرید این پک به‌جای سه فیلتر مجزا، هم مقرون‌به‌صرفه‌تر است و هم زمان تعویض را کوتاه می‌کند.",
    categorySlugs: ["filters"],
    isFeatured: false,
    priceToman: 390_000,
    compareAtPriceToman: 450_000,
    weightGrams: 1_050,
    stock: 95,
    sku: "REY-PF-3PK-V1",
    variantTitle: "بسته ۳ عددی",
    seoKeywords: "پک فیلتر, فیلتر PP, فیلتر UDF, فیلتر CTO, پیش پالایش",
    specifications: [
      { key: "محتویات", value: "PP ۵ میکرون، UDF، CTO" },
      { key: "تعداد", value: "۳ عدد" },
      { key: "سایز", value: "۱۰ اینچی استاندارد" },
      { key: "عمر مفید", value: "۳ تا ۹ ماه" },
    ],
  },
  {
    title: "پمپ تقویتی تصفیه آب ۱۲۵ PSI",
    slug: "ro-booster-pump-125psi",
    shortDescription:
      "پمپ تقویتی ۱۲۵ PSI برای دستگاه‌های تصفیه آب در مناطق با فشار آب پایین.",
    description:
      "پمپ تقویتی ۱۲۵ PSI فشار لازم برای کارکرد صحیح ممبران را در مناطقی که فشار آب شهری پایین است تأمین می‌کند. بدون این پمپ، دبی دستگاه کاهش می‌یابد و ممبران آسیب می‌بیند. این پمپ با آداپتور ۲۴ ولت و اتصال ۱/۴ اینچی استاندارد عرضه می‌شود و در حالت خشک خاموش می‌شود.",
    categorySlugs: ["spare-parts", "pumps-and-tanks"],
    isFeatured: false,
    priceToman: 1_150_000,
    compareAtPriceToman: 1_320_000,
    weightGrams: 2_100,
    stock: 30,
    sku: "REY-PU-BOOST125-V1",
    variantTitle: "بسته تکی با آداپتور",
    seoKeywords: "پمپ تصفیه آب, پمپ تقویتی, بوستر پمپ, ۱۲۵ PSI",
    specifications: [
      { key: "فشار خروجی", value: "۱۲۵ PSI (حدود ۸٫۶ بار)" },
      { key: "ولتاژ", value: "۲۴ ولت DC" },
      { key: "اتصال", value: "۱/۴ اینچی استاندارد" },
      { key: "حفاظت", value: "خاموشی در حالت خشک" },
    ],
  },
  {
    title: "پمپ دیافراگمی ۲۴ ولت دستگاه تصفیه آب",
    slug: "diaphragm-pump-24v",
    shortDescription:
      "پمپ دیافراگمی ۲۴ ولت دستگاه تصفیه آب، جایگزین قطعه اصلی اکثر مدل‌های خانگی.",
    description:
      "پمپ دیافراگمی ۲۴ ولت، قطعه‌ای است که در بیشتر دستگاه‌های تصفیه آب خانگی استفاده می‌شود. کارکرد بی‌صدا و راندمان مناسب این پمپ، فشار پیوسته و یکنواختی را به دستگاه می‌دهد. در صورت خاموش ماندن دستگاه، تعویض این قطعه معمولاً اولین اقدام رفع مشکل است.",
    categorySlugs: ["spare-parts", "pumps-and-tanks"],
    isFeatured: false,
    priceToman: 980_000,
    compareAtPriceToman: null,
    weightGrams: 1_750,
    stock: 26,
    sku: "REY-PU-DIAPHRAGM-V1",
    variantTitle: "بسته تکی",
    seoKeywords: "پمپ دیافراگمی, پمپ تصفیه آب, پمپ ۲۴ ولت, قطعه یدکی",
    specifications: [
      { key: "نوع پمپ", value: "دیافراگمی" },
      { key: "ولتاژ", value: "۲۴ ولت DC" },
      { key: "صدا", value: "بی‌صدا" },
      { key: "کاربرد", value: "دستگاه‌های تصفیه آب خانگی" },
    ],
  },
  {
    title: "مخزن ذخیره آب تصفیه ۱۶ لیتری تحت فشار",
    slug: "pressure-tank-16l",
    shortDescription:
      "مخزن ذخیره آب تصفیه ۱۶ لیتری با دیافراگم پزشکی و پیش‌بار استاندارد ۷ PSI.",
    description:
      "مخزن ذخیره آب تصفیه ۱۶ لیتری با دیافراگم EPDM پزشکی، آب تصفیه را در فشار مناسب نگه می‌دارد تا سرعت برداشت شیر آب کاهش نیابد. پیش‌بار داخلی باید در محدوده ۵ تا ۷ PSI تنظیم شود. این مخزن با اتصال ۱/۴ اینچی استاندارد به تمام دستگاه‌های RO خانگی سازگار است.",
    categorySlugs: ["spare-parts", "pumps-and-tanks"],
    isFeatured: false,
    priceToman: 1_200_000,
    compareAtPriceToman: null,
    weightGrams: 3_200,
    stock: 22,
    sku: "REY-TK-TANK16-V1",
    variantTitle: "بسته تکی",
    seoKeywords: "مخزن تصفیه آب, مخزن تحت فشار, تانک ذخیره آب, تانک RO",
    specifications: [
      { key: "ظرفیت", value: "۱۶ لیتر (۴ گالن)" },
      { key: "پیش‌بار", value: "۷ PSI" },
      { key: "جنس دیافراگم", value: "EPDM پزشکی" },
      { key: "اتصال", value: "۱/۴ اینچی استاندارد" },
    ],
  },
  {
    title: "مخزن ذخیره آب تصفیه ۳۲ لیتری",
    slug: "pressure-tank-32l",
    shortDescription:
      "مخزن ذخیره آب تصفیه ۳۲ لیتری، مناسب خانواده‌های پرمصرف و دستگاه‌های صنعتی کوچک.",
    description:
      "مخزن ذخیره آب تصفیه ۳۲ لیتری برای خانواده‌های پرمصرف و دستگاه‌های تصفیه آب نیمه‌صنعتی مناسب است. دیافراگم داخلی از ورود هوا به آب جلوگیری می‌کند و کیفیت آب ذخیره‌شده را حفظ می‌کند. ابعاد این مخزن برای نصب زیر کابینت‌های بزرگ در نظر گرفته شده است.",
    categorySlugs: ["spare-parts", "pumps-and-tanks"],
    isFeatured: false,
    priceToman: 1_150_000,
    compareAtPriceToman: 1_280_000,
    weightGrams: 5_400,
    stock: 14,
    sku: "REY-TK-TANK32-V1",
    variantTitle: "بسته تکی",
    seoKeywords: "مخزن تصفیه آب, مخزن ۳۲ لیتری, تانک ذخیره آب",
    specifications: [
      { key: "ظرفیت", value: "۳۲ لیتر (۸ گالن)" },
      { key: "جنس دیافراگم", value: "EPDM" },
      { key: "کاربرد", value: "خانواده پرمصرف، نیمه‌صنعتی" },
      { key: "اتصال", value: "۱/۴ اینچی استاندارد" },
    ],
  },
  {
    title: "شیر برداشت اهرمی کروم‌دار",
    slug: "lever-faucet-chrome",
    shortDescription:
      "شیر برداشت اهرمی کروم‌دار برای دستگاه تصفیه آب، با طراحی سازگار با کابینت.",
    description:
      "شیر برداشت اهرمی کروم‌دار، ظاهر دستگاه تصفیه آب زیرسینکی را با کابینت آشپزخانه هماهنگ می‌کند. بدنه برنجی با روکش کروم در برابر خوردگی و زنگ‌زدگی مقاوم است. این شیر به همراه بست و واشر نصب عرضه می‌شود و نصب آن به تخصص خاصی نیاز ندارد.",
    categorySlugs: ["accessories"],
    isFeatured: false,
    priceToman: 320_000,
    compareAtPriceToman: null,
    weightGrams: 520,
    stock: 110,
    sku: "REY-FC-LEVER-V1",
    variantTitle: "بسته تکی کروم",
    seoKeywords: "شیر برداشت تصفیه آب, شیر اهرمی, شیر کروم, لوازم جانبی",
    specifications: [
      { key: "جنس بدنه", value: "برنج با روکش کروم" },
      { key: "نوع", value: "اهرمی" },
      { key: "اتصال", value: "۱/۴ اینچ" },
      { key: "اقلام همراه", value: "بست و واشر نصب" },
    ],
  },
  {
    title: "شیر برداشت استیل ضدزنگ",
    slug: "stainless-faucet-tall",
    shortDescription:
      "شیر برداشت بلند استیل ضدزنگ با طراحی غازی، مناسب کابینت‌های بلند.",
    description:
      "شیر برداشت استیل ضدزنگ با دهانه غازی و ارتفاع بلند، برای نصب روی کابینت‌های با سطح بالاتر طراحی شده است. استیل ضدزنگ در برابر لکه، خوردگی و تغییر رنگ مقاوم است و سال‌ها ظاهر اولیه خود را حفظ می‌کند. این شیر در هر دو مدل رومیزی و زیرسینکی قابل استفاده است.",
    categorySlugs: ["accessories"],
    isFeatured: false,
    priceToman: 890_000,
    compareAtPriceToman: 980_000,
    weightGrams: 780,
    stock: 40,
    sku: "REY-FC-SSTALL-V1",
    variantTitle: "بسته تکی استیل",
    seoKeywords: "شیر برداشت استیل, شیر غازی, شیر بلند تصفیه آب",
    specifications: [
      { key: "جنس", value: "استیل ضدزنگ" },
      { key: "نوع دهانه", value: "غازی بلند" },
      { key: "مقاومت", value: "ضد خوردگی و لکه" },
      { key: "اتصال", value: "۱/۴ اینچ" },
    ],
  },
  {
    title: "شیر برقی ۲۴ ولت دستگاه تصفیه آب",
    slug: "solenoid-valve-24v",
    shortDescription:
      "شیر برقی ۲۴ ولت دستگاه تصفیه آب، قطعه یدکی برای مدل‌های بدون مخزن.",
    description:
      "شیر برقی ۲۴ ولت، جریان آب تصفیه را به‌صورت الکترونیکی کنترل می‌کند و در دستگاه‌های تصفیه آب بدون مخزن نقش حیاتی دارد. این قطعه هنگام قطع برق، جریان آب را می‌بندد تا نشتی رخ ندهد. نصب آن نیازمند باز کردن دستگاه است و بهتر است توسط تکنسین انجام شود.",
    categorySlugs: ["spare-parts"],
    isFeatured: false,
    priceToman: 760_000,
    compareAtPriceToman: null,
    weightGrams: 240,
    stock: 45,
    sku: "REY-SV-SOL24-V1",
    variantTitle: "بسته تکی",
    seoKeywords: "شیر برقی تصفیه آب, شیر برقی ۲۴ ولت, قطعه یدکی",
    specifications: [
      { key: "ولتاژ", value: "۲۴ ولت DC" },
      { key: "وظیفه", value: "قطع جریان آب در حالت بدون برق" },
      { key: "مناسب برای", value: "دستگاه‌های بدون مخزن" },
      { key: "اتصال", value: "۱/۴ اینچ" },
    ],
  },
  {
    title: "کیت نصب تصفیه آب شامل شلنگ و بست و اتصالات",
    slug: "installation-kit-standard",
    shortDescription:
      "کیت نصب کامل دستگاه تصفیه آب شامل شلنگ، سه‌راه، بست و اتصالات ۱/۴ اینچ.",
    description:
      "کیت نصب استاندارد همه قطعات لازم برای نصب یک دستگاه تصفیه آب خانگی را در یک بسته جمع کرده است. این کیت شامل شلنگ ۱/۴ اینچ، شیر سه‌راه برای مسیر آب سرد، بست، سه‌راهی، مهره و واشر است. کیفیت اتصالات در این بسته بالاتر از اقلام مصرفی بازار است و نشتی ندارد.",
    categorySlugs: ["accessories"],
    isFeatured: true,
    priceToman: 285_000,
    compareAtPriceToman: 350_000,
    weightGrams: 900,
    stock: 130,
    sku: "REY-AK-INSTALL-V1",
    variantTitle: "بسته کامل نصب",
    seoKeywords: "کیت نصب تصفیه آب, لوازم نصب, شلنگ تصفیه آب, اتصالات",
    specifications: [
      { key: "محتویات", value: "شلنگ، سه‌راه، بست، مهره، واشر" },
      { key: "سایز اتصالات", value: "۱/۴ اینچ" },
      { key: "کاربرد", value: "نصب دستگاه‌های خانگی" },
      { key: "نشتی", value: "آب‌بندی‌شده" },
    ],
  },
  {
    title: "شلنگ تصفیه آب ۱/۴ اینچ ۱۰۰ متری",
    slug: "tubing-1-4-inch-100m",
    shortDescription:
      "شلنگ تصفیه آب ۱/۴ اینچ ۱۰۰ متری از جنس پلی‌اتیلن، مناسب نصب‌های حرفه‌ای.",
    description:
      "شلنگ تصفیه آب ۱/۴ اینچ به طول ۱۰۰ متر از جنس پلی‌اتیلن فشار بالا، برای نصب‌های حرفه‌ای و ساختمان‌های چندواحدی مناسب است. این شلنگ در برابر فشار آب و املاح، مقاوم و انعطاف‌پذیر است. برای اتصال به هوزینگ، شیر برداشت و پمپ دستگاه‌های تصفیه آب استفاده می‌شود.",
    categorySlugs: ["accessories"],
    isFeatured: false,
    priceToman: 470_000,
    compareAtPriceToman: null,
    weightGrams: 4_600,
    stock: 60,
    sku: "REY-TB-Q14-100M-V1",
    variantTitle: "قرقره ۱۰۰ متری",
    seoKeywords: "شلنگ تصفیه آب, شیلنگ ۱/۴ اینچ, لوله PE, شلنگ نصب",
    specifications: [
      { key: "قطر", value: "۱/۴ اینچ" },
      { key: "طول", value: "۱۰۰ متر" },
      { key: "جنس", value: "پلی‌اتیلن فشار بالا" },
      { key: "کاربرد", value: "نصب حرفه‌ای و ساختمانی" },
    ],
  },
  {
    title: "فیلتر شنی ۲۰ اینچی چند رسانه‌ای",
    slug: "multimedia-sand-filter-20-inch",
    shortDescription:
      "فیلتر شنی ۲۰ اینچی چند رسانه‌ای، حذف رسوب، شن و ذرات معلق با فشار کم.",
    description:
      "فیلتر شنی ۲۰ اینچی چند رسانه‌ای با بستر لایه‌ای از شن، سیلیس و آنیت، رسوب، شن و ذرات معلق آب را با افت فشار کم حذف می‌کند. این فیلتر معمولاً به‌عنوان پیش‌پالایش در سیستم‌های صنعتی و ساختمانی به کار می‌رود. بستر رسانه‌ای هر دو تا سه سال نیاز به تعویض دارد.",
    categorySlugs: ["filters", "sediment-filters"],
    isFeatured: false,
    priceToman: 780_000,
    compareAtPriceToman: 890_000,
    weightGrams: 6_800,
    stock: 24,
    sku: "REY-SD-SAND20-V1",
    variantTitle: "بسته تکی ۲۰ اینچی",
    seoKeywords: "فیلتر شنی, فیلتر چند رسانه‌ای, فیلتر شن ۲۰ اینچی, فیلتر صنعتی",
    specifications: [
      { key: "قطر", value: "۲۰ اینچ" },
      { key: "نوع بستر", value: "شن، سیلیس، آنیت" },
      { key: "افت فشار", value: "کم" },
      { key: "عمر رسانه", value: "۲ تا ۳ سال" },
    ],
  },
  {
    title: "فیلتر کربن اکتیو ۱۰ اینچی دو هسته‌ای",
    slug: "carbon-block-dual-core-10-inch",
    shortDescription:
      "فیلتر کربن اکتیو دو هسته‌ای ۱۰ اینچی، راندمان جذب بالاتر و عمر مفید بیشتر.",
    description:
      "فیلتر کربن اکتیو دو هسته‌ای ۱۰ اینچی با ساختار دولایه، سطح جذب بیشتری نسبت به فیلترهای تک‌هسته‌ای دارد. این فیلتر علاوه بر کلر، بو، طعم و برخی فلزات سنگین مانند آهن و منگنز را نیز کاهش می‌دهد. عمر مفید آن حدود دوازده ماه است و در دستگاه‌های RO جایگزین مناسبی برای فیلتر پست‌کربن است.",
    categorySlugs: ["filters", "carbon-filters"],
    isFeatured: false,
    priceToman: 620_000,
    compareAtPriceToman: 700_000,
    weightGrams: 1_100,
    stock: 70,
    sku: "REY-CB-DUALCORE-V1",
    variantTitle: "بسته تکی دو هسته‌ای",
    seoKeywords: "فیلتر کربن اکتیو, فیلتر دو هسته‌ای, فیلتر آهن, فیلتر کربنی",
    specifications: [
      { key: "ساختار", value: "دو هسته‌ای" },
      { key: "سایز", value: "۱۰ اینچی استاندارد" },
      { key: "حذف", value: "کلر، بو، آهن و منگنز" },
      { key: "عمر مفید", value: "حدود ۱۲ ماه" },
    ],
  },
  {
    title: "ست هوزینگ ضد نشتی ۳ عددی دستگاه تصفیه آب",
    slug: "leak-free-housing-set-3",
    shortDescription:
      "ست هوزینگ ضد نشتی ۳ عددی برای دستگاه تصفیه آب، با واشر دوآب‌بند و اتصال سریع.",
    description:
      "ست هوزینگ ضد نشتی ۳ عددی، جایگزین هوزینگ‌های فرسوده دستگاه تصفیه آب است. ساختار دوآب‌بند با دو واشر مستقل، احتمال نشتی را به حداقل می‌رساند. اتصال سریع ۱/۴ اینچی تعویض فیلتر را بدون ابزار انجام می‌دهد. این ست برای فیلترهای پیش‌پالایش و ممبران کاربرد دارد.",
    categorySlugs: ["spare-parts"],
    isFeatured: false,
    priceToman: 540_000,
    compareAtPriceToman: null,
    weightGrams: 720,
    stock: 55,
    sku: "REY-HS-SET3-V1",
    variantTitle: "بسته ۳ عددی",
    seoKeywords: "هوزینگ تصفیه آب, ست هوزینگ, فیلتر هوزینگ ضد نشتی, قطعه یدکی",
    specifications: [
      { key: "تعداد", value: "۳ عدد" },
      { key: "آب‌بندی", value: "دوآب‌بند با دو واشر" },
      { key: "اتصال", value: "سریع ۱/۴ اینچ" },
      { key: "کاربرد", value: "تعویض فیلتر بدون ابزار" },
    ],
  },
];

// ── Image preflight ────────────────────────────────────────────────────────

async function probeUrl(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
      headers: { "user-agent": "reyhan-seed/1.0" },
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Probes every distinct product image URL and reports which resolve. The caller
 * maps results onto real URLs, substituting `placeholderFor(slug)` for anything
 * the probe rejected.
 */
async function preflightImages(urls: string[]): Promise<{ ok: string[]; failed: string[] }> {
  const distinct = [...new Set(urls)];
  log(`بررسی دسترس‌پذیری ${fa(distinct.length)} تصویر پیش از نوشتن در پایگاه داده…`);

  const ok: string[] = [];
  const failed: string[] = [];
  const CONCURRENCY = 6;

  for (let i = 0; i < distinct.length; i += CONCURRENCY) {
    const batch = distinct.slice(i, i + CONCURRENCY);
    const verdicts = await Promise.all(batch.map(probeUrl));
    batch.forEach((url, idx) => (verdicts[idx] ? ok : failed).push(url));
    const done = Math.min(i + CONCURRENCY, distinct.length);
    log(`  پیش‌بررسی تصاویر: ${fa(done)} از ${fa(distinct.length)}`);
  }

  return { ok, failed };
}

// ── Prisma client ──────────────────────────────────────────────────────────

/**
 * Adapts the connection string for node-postgres.
 *
 * Supabase's connection-string generator emits `sslmode=require`, but libpq
 * treats `require` as "encrypt and do NOT verify the certificate". node-postgres
 * instead treats `require` as an alias for `verify-full`, and Supabase presents a
 * self-signed certificate chain — so the connection fails with
 * "self-signed certificate in certificate chain". Appending `uselibpqcompat=true`
 * restores libpq semantics (Supabase's documented fix for pg/Prisma drivers).
 *
 * The link stays TLS-encrypted; only certificate verification is relaxed, which
 * is acceptable for a one-off admin script against a known host.
 */
function normalizePgConnectionString(raw: string): string {
  const [base, query = ""] = raw.split("?", 2);
  const params = new URLSearchParams(query);
  if (!params.has("sslmode") || params.get("sslmode") === "disable") return base;
  if (params.has("uselibpqcompat")) return raw;
  params.set("uselibpqcompat", "true");
  return `${base}?${params.toString()}`;
}

async function createPrisma() {
  // Pooler choice matters here. `src/lib/prisma.ts` prefers DIRECT_URL (the
  // Supabase *session* pooler, one long-lived connection) for request handling.
  // Seeding is the opposite workload: hundreds of sequential round trips over
  // minutes, during which the session pooler may close the connection
  // ("Connection terminated unexpectedly"). So this script prefers DATABASE_URL
  // (the *transaction* pooler) and falls back to DIRECT_URL. Both are TLS-
  // normalized below. Override with SEED_DATABASE_URL when needed.
  const raw =
    process.env.SEED_DATABASE_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    process.env.DIRECT_URL?.trim();
  if (!raw) {
    throw new Error(
      "متغیر محیطی DATABASE_URL (یا DIRECT_URL) تنظیم نشده است (فایل .env را بررسی کنید).",
    );
  }

  const url = normalizePgConnectionString(raw);
  if (url !== raw) {
    warn(
      "پارامتر uselibpqcompat=true به رشته اتصال افزوده شد تا TLS با معنی استاندارد libpq تفسیر شود (رفع خطای self-signed certificate).",
    );
  }
  log(`استخر اتصال: ${url.includes(":6543") ? "transaction pooler" : "session pooler"}`);

  const { PrismaClient } = await import("@prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const adapter = new PrismaPg({ connectionString: url });
  return new PrismaClient({ adapter } as unknown as ConstructorParameters<
    typeof PrismaClient
  >[0]);
}

/**
 * Retries a unit of work across transient connection failures.
 *
 * DIRECT_URL is Supabase's *session* pooler, and seeding 40 products issues
 * hundreds of sequential round trips. The pooler can close an idle connection
 * mid-run ("Connection terminated unexpectedly" / P1001 / P1017 / P2028). Every
 * write below is an upsert on a real unique key, so replaying a unit is safe.
 */
const TRANSIENT_CODES = [
  "P1000",
  "P1001",
  "P1002",
  "P1008",
  "P1010",
  "P1017",
  "P2024",
  "P2028",
];

function isTransient(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  if (TRANSIENT_CODES.some((code) => message.includes(code))) return true;
  return /connection terminated|connection closed|server closed the connection|connection reset|econnrefused|etimedout|socket hang up|timeout exceeded|pooler/i.test(
    message,
  );
}

async function withRetry<T>(label: string, work: () => Promise<T>, attempts = 4): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await work();
    } catch (error) {
      if (attempt >= attempts || !isTransient(error)) throw error;
      const delay = attempt * 1_500;
      warn(
        `قطع اتصال موقت هنگام «${label}»؛ تلاش ${fa(attempt + 1)} از ${fa(attempts)} پس از ${fa(delay / 1000)} ثانیه.`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

// ── Seed ───────────────────────────────────────────────────────────────────

async function seedCategories(prisma: Awaited<ReturnType<typeof createPrisma>>) {
  step("دسته‌بندی‌ها");
  const bySlug = new Map<string, string>();
  let created = 0;
  let matched = 0;

  // CATEGORIES is authored parent-first, so parentId always resolves.
  for (const category of CATEGORIES) {
    const parentId = category.parentSlug
      ? (bySlug.get(category.parentSlug) ??
        (
          await prisma.category.findUnique({
            where: { slug: category.parentSlug },
            select: { id: true },
          })
        )?.id ??
        null)
      : null;

    const existing = await prisma.category.findUnique({
      where: { slug: category.slug },
      select: { id: true },
    });

    const row = await prisma.category.upsert({
      where: { slug: category.slug },
      create: {
        name: category.name,
        slug: category.slug,
        description: category.description,
        sortOrder: category.sortOrder,
        level: category.level,
        status: "ACTIVE",
        parentId,
      },
      // `update` deliberately omits `parentId`: re-parenting an existing
      // merchant category is a manual, structural decision, not a seed concern.
      update: {
        name: category.name,
        description: category.description,
        sortOrder: category.sortOrder,
        level: category.level,
        status: "ACTIVE",
      },
      select: { id: true },
    });

    bySlug.set(category.slug, row.id);
    if (existing) matched++;
    else created++;
    log(`  ${existing ? "به‌روزرسانی" : "ایجاد"}: ${category.name} (${fa(category.slug)})`);
  }

  log(`  نتیجه دسته‌بندی‌ها → ایجاد: ${fa(created)} | به‌روزرسانی: ${fa(matched)}`);
  return bySlug;
}

async function seedProduct(
  prisma: Awaited<ReturnType<typeof createPrisma>>,
  product: SeedProduct,
  imageUrl: string,
  categoryIds: string[],
) {
  const now = new Date();

  const existing = await prisma.product.findUnique({
    where: { slug: product.slug },
    select: { id: true, publishedAt: true },
  });

  const row = await prisma.product.upsert({
    where: { slug: product.slug },
    create: {
      title: product.title,
      slug: product.slug,
      shortDescription: product.shortDescription,
      description: product.description,
      status: "ACTIVE",
      isFeatured: product.isFeatured,
      publishedAt: now,
      seoTitle: `${product.title} | فروشگاه ریحان`,
      seoDescription: product.shortDescription,
      seoKeywords: product.seoKeywords,
    },
    update: {
      title: product.title,
      shortDescription: product.shortDescription,
      description: product.description,
      status: "ACTIVE",
      isFeatured: product.isFeatured,
      seoTitle: `${product.title} | فروشگاه ریحان`,
      seoDescription: product.shortDescription,
      seoKeywords: product.seoKeywords,
      // Never blank out a real publish date on a re-run.
      ...(existing?.publishedAt ? {} : { publishedAt: now }),
    },
    select: { id: true },
  });

  // One round trip for every category link instead of one per category.
  // `skipDuplicates` makes the insert idempotent against the composite PK.
  if (categoryIds.length > 0) {
    await prisma.productCategory.createMany({
      data: categoryIds.map((categoryId) => ({ productId: row.id, categoryId })),
      skipDuplicates: true,
    });
  }

  // Variant carries the price. Upserted on the globally unique `sku`.
  const variant = await prisma.productVariant.upsert({
    where: { sku: product.sku },
    create: {
      productId: row.id,
      title: product.variantTitle,
      sku: product.sku,
      price: RIAL(product.priceToman),
      compareAtPrice:
        product.compareAtPriceToman === null
          ? null
          : RIAL(product.compareAtPriceToman),
      weight: product.weightGrams,
      isDefault: true,
      isActive: true,
      sortOrder: 0,
    },
    update: {
      productId: row.id,
      title: product.variantTitle,
      price: RIAL(product.priceToman),
      compareAtPrice:
        product.compareAtPriceToman === null
          ? null
          : RIAL(product.compareAtPriceToman),
      weight: product.weightGrams,
      isDefault: true,
      isActive: true,
    },
    select: { id: true },
  });

  // Exactly one default variant per product.
  await prisma.productVariant.updateMany({
    where: { productId: row.id, id: { not: variant.id }, isDefault: true },
    data: { isDefault: false },
  });

  // Inventory is 1:1 with the variant (`variantId` is unique). Existing stock
  // movements are preserved: the seed only tops an already-drained row back up.
  const inventory = await prisma.inventory.findUnique({
    where: { variantId: variant.id },
    select: { quantity: true, reservedQuantity: true },
  });

  if (!inventory) {
    await prisma.inventory.create({
      data: {
        variantId: variant.id,
        quantity: product.stock,
        reservedQuantity: 0,
        lowStockThreshold: 5,
      },
    });
  } else if (inventory.reservedQuantity === 0 && inventory.quantity === 0) {
    await prisma.inventory.update({
      where: { variantId: variant.id },
      data: { quantity: product.stock, lowStockThreshold: 5 },
    });
  }

  // `ProductImage` has no natural unique key, so reconcile by (productId, url)
  // exactly like scripts/ingest-supabase.mjs does. When the preflight resolves a
  // different URL than a previous run wrote (e.g. placeholder -> real Unsplash
  // photo), the seed's own placeholder row is updated in place rather than
  // accumulating alongside the new one. Delete-free and idempotent.
  const staleUrl = placeholderFor(product.slug);
  const [existingImage, staleImage] = await Promise.all([
    prisma.productImage.findFirst({
      where: { productId: row.id, url: imageUrl },
      select: { id: true },
    }),
    prisma.productImage.findFirst({
      where: { productId: row.id, url: staleUrl },
      select: { id: true },
    }),
  ]);

  if (existingImage) {
    // Already correct — keep any admin-edited alt text untouched.
  } else if (staleImage) {
    await prisma.productImage.update({
      where: { id: staleImage.id },
      data: { url: imageUrl, alt: product.title },
    });
  } else {
    const count = await prisma.productImage.count({ where: { productId: row.id } });
    await prisma.productImage.create({
      data: {
        productId: row.id,
        variantId: null,
        url: imageUrl,
        alt: product.title,
        sortOrder: count,
      },
    });
  }

  for (const [index, spec] of product.specifications.entries()) {
    await prisma.productSpecification.upsert({
      where: { productId_key: { productId: row.id, key: spec.key } },
      create: {
        productId: row.id,
        key: spec.key,
        value: spec.value,
        sortOrder: index + 1,
      },
      update: { value: spec.value, sortOrder: index + 1 },
    });
  }

  return existing ? "updated" : "created";
}

async function main() {
  console.log("");
  console.log(`${TAG} ███  ساخت داده اولیه کاتالوگ ریحان — ${fa(PRODUCTS.length)} محصول`);
  console.log("");

  // ── 0. Static self-checks (fail before touching the network or the DB) ────
  const slugs = new Set<string>();
  const skus = new Set<string>();
  for (const [index, product] of PRODUCTS.entries()) {
    const label = product.slug || `index ${index}`;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(product.slug))
      fail(`اسلاگ نامعتبر (فقط لاتین کوچک و خط تیره): ${label}`);
    if (slugs.has(product.slug)) fail(`اسلاگ تکراری: ${label}`);
    slugs.add(product.slug);

    if (!/^[A-Za-z0-9._:\-]+$/.test(product.sku) || product.sku.length > 64)
      fail(`کد کالا نامعتبر: ${product.sku}`);
    if (skus.has(product.sku)) fail(`کد کالا تکراری: ${product.sku}`);
    skus.add(product.sku);

    if (product.title.length > 200) fail(`عنوان بلندتر از حد مجاز: ${product.slug}`);
    if (product.shortDescription.length > 600)
      fail(`توضیح کوتاه بلندتر از حد مجاز: ${product.slug}`);
    if (product.seoKeywords.length > 500)
      fail(`کلیدواژه‌ها بلندتر از حد مجاز: ${product.slug}`);

    for (const slug of product.categorySlugs) {
      if (!CATEGORIES.some((c) => c.slug === slug))
        fail(`دسته‌بندی ناشناخته «${slug}» در محصول ${product.slug}`);
    }
  }
  const units = PRODUCTS.filter((p) =>
    p.categorySlugs.includes("water-purification-devices"),
  );
  const parts = PRODUCTS.filter((p) => !p.categorySlugs.includes("water-purification-devices"));
  log(`ترکیب داده → دستگاه تصفیه آب: ${fa(units.length)} | قطعه و فیلتر: ${fa(parts.length)}`);

  const unitPrices = units.map((p) => p.priceToman);
  const partPrices = parts.map((p) => p.priceToman);
  log(
    `بازه قیمت دستگاه‌ها: ${fa(toman(Math.min(...unitPrices) * T))} تا ${fa(
      toman(Math.max(...unitPrices) * T),
    )} تومان`,
  );
  log(
    `بازه قیمت قطعات: ${fa(toman(Math.min(...partPrices) * T))} تا ${fa(
      toman(Math.max(...partPrices) * T),
    )} تومان`,
  );

  // ── 1. Image preflight ────────────────────────────────────────────────────
  const candidateUrls = PRODUCTS.map((_, index) => unsplash(index));
  const report = await preflightImages(candidateUrls);

  if (report.ok.length === 0 && !FORCE_PLACEHOLDER) {
    fail("هیچ‌کدام از آدرس‌های تصاویر در دسترس نبودند (احتمالاً محدودیت شبکه).");
    fail("پس از بررسی دسترسی، یکی از این دو کار را انجام دهید:");
    fail("  ۱) شناسه‌های معتبر Unsplash را در ثابت PHOTO_IDS جایگزین کنید؛");
    fail("  ۲) یا با --placeholder-images اجرا کنید تا از تصاویر جایگزین استفاده شود.");
    process.exit(1);
  }

  log(`تصاویر معتبر: ${fa(report.ok.length)} | نامعتبر: ${fa(report.failed.length)}`);
  if (report.failed.length > 0) {
    warn(
      `${fa(report.failed.length)} آدرس تصویر پاسخ نداد و با تصویر جایگزین تعویین شد. برای استفاده از عکس واقعی، شناسه آن را در PHOTO_IDS اصلاح کنید.`,
    );
  }

  // Anything the probe rejected falls back to the deterministic placeholder.
  const verified = new Set(report.ok);
  const imageUrls = PRODUCTS.map((product, index) =>
    verified.has(candidateUrls[index]) ? candidateUrls[index] : placeholderFor(product.slug),
  );

  if (DRY_RUN) {
    step("حالت آزمایشی (--dry-run): بررسی اتصال بدون نوشتن در پایگاه داده…");
    // Read-only probe: this validates the PrismaPg adapter path and confirms the
    // schema is actually migrated on the target database, without writing a row.
    const probe = await createPrisma();
    try {
      const [products, categories, variants] = await Promise.all([
        probe.product.count(),
        probe.category.count(),
        probe.productVariant.count(),
      ]);
      log(`  اتصال موفق — محصولات: ${fa(products)} | دسته‌بندی‌ها: ${fa(categories)} | گونه‌ها: ${fa(variants)}`);
    } finally {
      await probe.$disconnect();
    }
    log("هیچ تغییری در پایگاه داده نوشته نشد.");
    log("برای نوشتن واقعی، دستور زیر را اجرا کنید:");
    log("  npm run db:seed");
    console.log("");
    return;
  }

  // ── 2. Database ──────────────────────────────────────────────────────────
  step("اتصال به پایگاه داده…");
  const prisma = await createPrisma();
  try {
    const [productCount, variantCount] = await Promise.all([
      prisma.product.count(),
      prisma.productVariant.count(),
    ]);    log(
      `اتصال برقرار شد. وضعیت فعلی: ${fa(productCount)} محصول و ${fa(variantCount)} گونه.`,
    );

    // ── 3. Categories ──────────────────────────────────────────────────────
    const categoryIds = await withRetry("دسته‌بندی‌ها", () => seedCategories(prisma));

    // ── 4. Products ────────────────────────────────────────────────────────
    step(`درج ${fa(PRODUCTS.length)} محصول…`);
    let created = 0;
    let updated = 0;

    for (const [index, product] of PRODUCTS.entries()) {
      const productCategoryIds: string[] = [];
      for (const slug of product.categorySlugs) {
        const id = categoryIds.get(slug);
        if (!id) throw new Error(`دسته‌بندی «${slug}» برای ${product.slug} یافت نشد.`);
        productCategoryIds.push(id);
      }

      const outcome = await withRetry(product.slug, () =>
        seedProduct(prisma, product, imageUrls[index], productCategoryIds),
      );
      if (outcome === "created") created++;
      else updated++;

      const counter = `  [${fa(index + 1)}/${fa(PRODUCTS.length)}]`;
      const verb = outcome === "created" ? "ایجاد" : "به‌روزرسانی";
      log(`${counter} ${verb}: ${product.title}`);
      log(
        `${" ".repeat(counter.length - 2)}    قیمت: ${fa(toman(RIAL(product.priceToman)))} تومان | موجودی: ${fa(product.stock)}`,
      );
    }

    // ── 5. Verification (read-only) ────────────────────────────────────────
    step("تأیید نهایی (خواندنی)");

    // Retried too: the pooler can drop the connection during long runs.
    const seededSlugs = PRODUCTS.map((p) => p.slug);
    const { counts, seededVariants } = await withRetry("تأیید نهایی", async () => {
      const counts = await Promise.all([
        prisma.product.count(),
        prisma.product.count({ where: { status: "ACTIVE" } }),
        prisma.product.count({ where: { status: "ACTIVE", isFeatured: true } }),
        prisma.productVariant.count(),
        prisma.productImage.count(),
        prisma.productSpecification.count(),
        prisma.inventory.count(),
        prisma.category.count(),
      ]);
      // Every seeded product must resolve a real, buyable price.
      const seededVariants = await prisma.productVariant.findMany({
        where: { product: { slug: { in: seededSlugs } } },
        select: { price: true, inventory: { select: { quantity: true } } },
      });
      return { counts, seededVariants };
    });

    const [
      totalProducts,
      activeProducts,
      featuredProducts,
      totalVariants,
      totalImages,
      totalSpecs,
      totalInventory,
      totalCategories,
    ] = counts;

    const unpriced = seededVariants.filter((v) => !v.price || v.price <= 0).length;
    const outOfStock = seededVariants.filter((v) => (v.inventory?.quantity ?? 0) <= 0).length;
    const missingLinks = seededVariants.length === PRODUCTS.length ? 0 : 1;

    log(`  کل محصولات پایگاه داده: ${fa(totalProducts)}`);
    log(`  محصولات فعال: ${fa(activeProducts)}`);
    log(`  محصولات ویژه: ${fa(featuredProducts)}`);
    log(`  دسته‌بندی‌ها: ${fa(totalCategories)}`);
    log(`  گونه‌ها: ${fa(totalVariants)} | موجودی‌ها: ${fa(totalInventory)}`);
    log(`  تصاویر: ${fa(totalImages)} | مشخصات فنی: ${fa(totalSpecs)}`);
    log(`  محصولات این اسکریپت: ایجاد ${fa(created)} | به‌روزرسانی ${fa(updated)}`);

    if (unpriced > 0) {
      fail(`${fa(unpriced)} گونه قیمت معتبر ندارد.`);
    }
    if (missingLinks > 0) {
      fail(`تعداد گونه‌های محصولات این اسکریپت ${fa(seededVariants.length)} است، نه ${fa(PRODUCTS.length)}.`);
    }
    if (outOfStock > 0) {
      warn(`${fa(outOfStock)} گونه موجودی صفر دارد (احتمالاً مصرف‌شده در سفارش‌های واقعی).`);
    }

    console.log("");
    log(`پایان — ${fa(created + updated)} محصول بدون هیچ حذف پردازش شد.`);
    console.log("");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
