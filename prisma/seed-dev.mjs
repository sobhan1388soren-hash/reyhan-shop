// Development-only idempotent seed for Reyhan catalog.
// - 0 destructive deletes, never touches users/orders/payments/reviews
// - Idempotent via upsert on unique slugs/SKUs; safe to run repeatedly
// - Guards against accidental production execution
//
// Usage:  npm run seed:dev
//         (requires DATABASE_URL in .env; never auto-runs)
// Requirements:
//  * Creates 4-6 realistic categories + 1-2 subcategories
//  * Creates 8 realistic fictional products (ACTIVE, with variant + inventory + image + specs)
//  * Marks 3 products as featured (homepage)
//  * Placeholder images use URL-only https architecture (picsum.photos seed URLs)
//  * No fake reviews/sales/orders/payments/brands/customer data

import "dotenv/config";

const DEV_SENTINEL = "reyhan-dev-";

// ── Guard: never run in production unless explicitly forced ─────────────────
if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEV_SEED !== "true") {
  console.error(
    "[seed:dev] Refusing to run in production. Set ALLOW_DEV_SEED=true to force (not recommended).",
  );
  process.exit(1);
}

async function createPrisma() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (check .env)");
  const { PrismaClient } = await import("@prisma/client");
  try {
    const { PrismaPg } = await import("@prisma/adapter-pg");
    const adapter = new PrismaPg({ connectionString: url });
    return new PrismaClient({ adapter });
  } catch {
    // Fallback for offline / missing adapter (mirrors src/lib/prisma.ts safe path)
    return new PrismaClient();
  }
}

// ── Category definitions (4 top-level + 2 subcategories = 6 total) ──────────
// Slugs prefixed with reyhan- where needed to avoid collision? Requirement says
// realistic dev categories for Reyhan — use clean Latin slugs (existing catalog
// uses Latin slugs). Keep short, idempotent, Persian names stored in `name`.
const CATEGORIES = [
  {
    slug: "water-purification-devices",
    name: "دستگاه تصفیه آب",
    description: "دستگاه‌های خانگی تصفیه آب شهری — زیرسینکی و رومیزی (نمونه توسعه).",
    image: null,
    sortOrder: 10,
    level: 0,
    parentSlug: null,
  },
  {
    slug: "filters",
    name: "فیلترها",
    description: "فیلترهای الیافی، کربنی و ممبران — نمونه توسعه ریحان.",
    image: null,
    sortOrder: 20,
    level: 0,
    parentSlug: null,
  },
  {
    slug: "spare-parts",
    name: "قطعات یدکی",
    description: "قطعات یدکی سازگار با دستگاه‌های تصفیه آب خانگی (تست).",
    image: null,
    sortOrder: 30,
    level: 0,
    parentSlug: null,
  },
  {
    slug: "accessories",
    name: "لوازم جانبی",
    description: "لوازم نصب و جانبی دستگاه تصفیه آب (تست).",
    image: null,
    sortOrder: 40,
    level: 0,
    parentSlug: null,
  },
  // Subcategories (supported by parentId + level)
  {
    slug: "under-sink",
    name: "زیرسینکی",
    description: "دستگاه‌های زیرسینکی — نصب زیر کابینت (نمونه توسعه).",
    image: null,
    sortOrder: 1,
    level: 1,
    parentSlug: "water-purification-devices",
  },
  {
    slug: "countertop",
    name: "رومیزی",
    description: "دستگاه‌های رومیزی و قابل حمل (نمونه توسعه).",
    image: null,
    sortOrder: 2,
    level: 1,
    parentSlug: "water-purification-devices",
  },
];

// ── Product definitions (8 fictional / test products) ───────────────────────
// All slugs prefixed with reyhan-dev- so a second run can never collide with
// real merchant data and the seed is trivially distinguishable as test data.
// Prices in Rial (1 Toman = 10 Rial) — store Rial, display Toman.
function placeholderUrl(slug) {
  return `https://picsum.photos/seed/${DEV_SENTINEL}${slug}/600/400`;
}

const PRODUCTS = [
  {
    title: "دستگاه تصفیه آب خانگی AquaClear 100 (نمونه تست)",
    slug: "reyhan-dev-aqua-clear-100",
    shortDescription: "سیستم زیرسینکی ۶ مرحله‌ای — بدنه شبیه‌سازی شده برای تست کاتالوگ.",
    description:
      "AquaClear 100 یک نمونه آزمایشی (غیرتجاری) برای نمایش کارت محصول ریحان است. نام ساختگی؛ هیچ برند واقعی را نمایندگی نمی‌کند. مشخصات برای تست UI: دبی حدودی، فشار کاری و اقلام همراه درج شده است.",
    status: "ACTIVE",
    isFeatured: true,
    categorySlugs: ["water-purification-devices", "under-sink"],
    seoTitle: "AquaClear 100 — نمونه دستگاه تصفیه آب (تست)",
    seoDescription: "نمونه توسعه دستگاه تصفیه آب زیرسینکی برای تست کاتالوگ ریحان — نام ساختگی.",
    variant: {
      title: "پکیج استاندارد — AquaClear 100",
      sku: "REYHAN-DEV-AC100-V1",
      price: 45000000, // 4,500,000 Toman
      compareAtPrice: 52000000,
      quantity: 25,
      weight: 8200,
    },
    specifications: [
      { key: "تعداد مراحل", value: "۶ مرحله", sortOrder: 1 },
      { key: "نوع نصب", value: "زیرسینکی", sortOrder: 2 },
      { key: "منبع تغذیه", value: "بدون برق (اسمز معکوس شبیه‌سازی)", sortOrder: 3 },
    ],
  },
  {
    title: "دستگاه رومیزی AquaClear 200 (نمونه تست)",
    slug: "reyhan-dev-aqua-clear-200",
    shortDescription: "دستگاه رومیزی کم‌حجم — نمونه توسعه برای تست چیدمان ریسپانسیو.",
    description:
      "AquaClear 200 نمونه تست رومیزی با نام ساختگی. صرفاً برای پر کردن گرید محصولات و تست نمایش کارت‌ها ایجاد شده و هیچ فروش واقعی/ادعای فنی را نمایش نمی‌دهد.",
    status: "ACTIVE",
    isFeatured: true,
    categorySlugs: ["water-purification-devices", "countertop"],
    seoTitle: "AquaClear 200 — نمونه رومیزی (تست)",
    seoDescription: "نمونه توسعه دستگاه رومیزی — داده تست ریحان.",
    variant: {
      title: "نسخه رومیزی — AquaClear 200",
      sku: "REYHAN-DEV-AC200-V1",
      price: 38000000,
      compareAtPrice: null,
      quantity: 12,
      weight: 6100,
    },
    specifications: [
      { key: "تعداد مراحل", value: "۴ مرحله", sortOrder: 1 },
      { key: "ظرفیت مخزن", value: "۵ لیتر (شبیه‌سازی)", sortOrder: 2 },
    ],
  },
  {
    title: "پک ۳ عددی فیلتر الیافی ۵ میکرون — Rey-Flow PP (تست)",
    slug: "reyhan-dev-filter-pp-5micron-set",
    shortDescription: "مجموعه ۳ تایی فیلتر الیافی PP — نمونه توسعه.",
    description: "بسته سه‌تایی فیلتر الیافی ۵ میکرون با نام ساختگی Rey-Flow برای نمایش دسته «فیلترها».",
    status: "ACTIVE",
    isFeatured: false,
    categorySlugs: ["filters"],
    variant: {
      title: "بسته ۳ عددی — ۵ میکرون",
      sku: "REYHAN-DEV-PP5-3PK-V1",
      price: 2800000,
      compareAtPrice: null,
      quantity: 80,
      weight: 420,
    },
    specifications: [
      { key: "جنس", value: "پلی‌پروپیلن (PP) شبیه‌سازی", sortOrder: 1 },
      { key: "دقت", value: "۵ میکرون", sortOrder: 2 },
      { key: "تعداد", value: "۳ عدد", sortOrder: 3 },
    ],
  },
  {
    title: "فیلتر کربن بلاک CarbonPure (نمونه تست)",
    slug: "reyhan-dev-filter-carbon-block",
    shortDescription: "فیلتر کربن بلاک — نمونه توسعه دسته فیلترها.",
    description: "فیلتر کربن بلاک با برچسب ساختگی CarbonPure — صرفاً داده تست UI.",
    status: "ACTIVE",
    isFeatured: false,
    categorySlugs: ["filters"],
    variant: {
      title: "کربن بلاک استاندارد",
      sku: "REYHAN-DEV-CB-V1",
      price: 3200000,
      compareAtPrice: null,
      quantity: 60,
      weight: 380,
    },
    specifications: [
      { key: "نوع", value: "کربن بلاک", sortOrder: 1 },
      { key: "عمر مفید", value: "حدود ۶ ماه (شبیه‌سازی)", sortOrder: 2 },
    ],
  },
  {
    title: "ممبران ۷۵GPD سری AquaMem (نمونه تست)",
    slug: "reyhan-dev-membrane-75gpd",
    shortDescription: "ممبران ۷۵ گالن در روز — نمونه توسعه.",
    description: "ممبران RO با ظرفیت اسمی ۷۵GPD و نام ساختگی AquaMem — داده تست برای فیلتر/قطعات یدکی.",
    status: "ACTIVE",
    isFeatured: true,
    categorySlugs: ["filters", "spare-parts"],
    variant: {
      title: "ممبران ۷۵GPD — استاندارد",
      sku: "REYHAN-DEV-MEM75-V1",
      price: 4500000,
      compareAtPrice: 5200000,
      quantity: 40,
      weight: 250,
    },
    specifications: [
      { key: "ظرفیت", value: "۷۵ GPD (اسمز معکوس شبیه‌سازی)", sortOrder: 1 },
      { key: "سازگاری", value: "هوزینگ استاندارد ۱۱ اینچی", sortOrder: 2 },
    ],
  },
  {
    title: "شیر برداشت اهرمی Goose-Neck (نمونه تست)",
    slug: "reyhan-dev-faucet-gooseneck",
    shortDescription: "شیر برداشت غازی — نمونه لوازم جانبی.",
    description: "شیر اهرمی غازی با روکش کروم شبیه‌سازی — نام ساختگی برای تست کارت‌های «قطعات یدکی/لوازم جانبی».",
    status: "ACTIVE",
    isFeatured: false,
    categorySlugs: ["spare-parts", "accessories"],
    variant: {
      title: "شیر غازی — کروم",
      sku: "REYHAN-DEV-FAUCET-GN-V1",
      price: 1900000,
      compareAtPrice: null,
      quantity: 35,
      weight: 520,
    },
    specifications: [
      { key: "جنس", value: "استیل/کروم شبیه‌سازی", sortOrder: 1 },
      { key: "اتصال", value: "۱/۴ اینچ", sortOrder: 2 },
    ],
  },
  {
    title: "مخزن ذخیره ۱۶ لیتری TankCell (نمونه تست)",
    slug: "reyhan-dev-pressure-tank-16l",
    shortDescription: "مخزن تحت فشار ۴ گالن (~۱۶ لیتر) — نمونه تست.",
    description: "مخزن ذخیره تحت فشار ۱۶ لیتری با نام ساختگی TankCell — داده تست برای بخش قطعات یدکی.",
    status: "ACTIVE",
    isFeatured: false,
    categorySlugs: ["spare-parts"],
    variant: {
      title: "مخزن ۱۶ لیتری — استاندارد",
      sku: "REYHAN-DEV-TANK16-V1",
      price: 7500000,
      compareAtPrice: null,
      quantity: 18,
      weight: 3400,
    },
    specifications: [
      { key: "حجم کل", value: "۱۶ لیتر (~۴ گالن)", sortOrder: 1 },
      { key: "فشار پیش‌بار", value: "۷ PSI (شبیه‌سازی)", sortOrder: 2 },
    ],
  },
  {
    title: "کیت نصب استاندارد InstallKit (نمونه تست)",
    slug: "reyhan-dev-install-kit-standard",
    shortDescription: "کیت کامل نصب — شلنگ، بست و اتصالات (تست).",
    description: "کیت نصب عمومی با نام ساختگی InstallKit — اقلام نصب شبیه‌سازی برای نمایش لوازم جانبی.",
    status: "ACTIVE",
    isFeatured: false,
    categorySlugs: ["accessories"],
    variant: {
      title: "کیت نصب — استاندارد",
      sku: "REYHAN-DEV-INSTKIT-V1",
      price: 850000,
      compareAtPrice: null,
      quantity: 100,
      weight: 900,
    },
    specifications: [
      { key: "شامل", value: "شلنگ ۱/۴، سه‌راه، بست‌ها (شبیه‌سازی)", sortOrder: 1 },
      { key: "سازگاری", value: "عمومی — همه دستگاه‌های تست", sortOrder: 2 },
    ],
  },
];

async function main() {
  const prisma = await createPrisma();

  console.log(`[seed:dev] NODE_ENV=${process.env.NODE_ENV ?? "(unset)"} — starting idempotent dev seed…`);
  console.log(`[seed:dev] Categories: ${CATEGORIES.length}, Products: ${PRODUCTS.length}`);

  let categoriesCreated = 0;
  let categoriesMatched = 0;
  const categoryBySlug = new Map();

  // Categories must be created parent-first so parentId FK is satisfied.
  // CATEGORIES is already parent-first ordered (levels asc).
  for (const cat of CATEGORIES) {
    let parentId = null;
    if (cat.parentSlug) {
      const parent = categoryBySlug.get(cat.parentSlug) ?? (await prisma.category.findUnique({ where: { slug: cat.parentSlug } }));
      if (!parent) throw new Error(`Parent category missing for ${cat.slug} → ${cat.parentSlug}`);
      parentId = parent.id;
      if (typeof parentId === "string") {
        // cached entry is raw record
        if (parent.id) parentId = parent.id;
      }
      if (typeof parentId === "object") parentId = parentId.id;
    }

    const existing = await prisma.category.findUnique({ where: { slug: cat.slug } });
    const data = {
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      image: cat.image,
      sortOrder: cat.sortOrder,
      status: "ACTIVE",
      level: cat.level,
      parentId,
    };

    const record = await prisma.category.upsert({
      where: { slug: cat.slug },
      create: data,
      update: {
        // Idempotent: keep name/description/status/level in sync, but never overwrite a manually edited sortOrder aggressively?
        // We do sync all seed-controlled fields so re-running stays consistent.
        name: cat.name,
        description: cat.description,
        status: "ACTIVE",
        level: cat.level,
        parentId,
        sortOrder: cat.sortOrder,
        ...(cat.image !== null ? { image: cat.image } : {}),
      },
    });

    categoryBySlug.set(cat.slug, record);
    if (!existing) categoriesCreated++;
    else categoriesMatched++;
  }

  console.log(`[seed:dev] Categories upserted — created: ${categoriesCreated}, matched: ${categoriesMatched}`);

  let productsCreated = 0;
  let productsMatched = 0;
  let variantsCreated = 0;
  let variantsMatched = 0;

  for (const p of PRODUCTS) {
    const existingProduct = await prisma.product.findUnique({ where: { slug: p.slug } });

    // Resolve category ids
    const categoryIds = [];
    for (const slug of p.categorySlugs) {
      const cat = categoryBySlug.get(slug) ?? (await prisma.category.findUnique({ where: { slug } }));
      if (!cat) throw new Error(`Category ${slug} not found for product ${p.slug}`);
      categoryIds.push(cat.id);
    }

    const productRecord = await prisma.product.upsert({
      where: { slug: p.slug },
      create: {
        title: p.title,
        slug: p.slug,
        description: p.description,
        shortDescription: p.shortDescription,
        status: p.status,
        isFeatured: p.isFeatured,
        publishedAt: new Date(),
        seoTitle: p.seoTitle ?? null,
        seoDescription: p.seoDescription ?? null,
      },
      update: {
        title: p.title,
        description: p.description,
        shortDescription: p.shortDescription,
        status: p.status,
        isFeatured: p.isFeatured,
        seoTitle: p.seoTitle ?? null,
        seoDescription: p.seoDescription ?? null,
        // publishedAt: keep existing if already set; set if missing
        ...(existingProduct?.publishedAt ? {} : { publishedAt: new Date() }),
      },
    });

    if (!existingProduct) productsCreated++;
    else productsMatched++;

    // Product ↔ Category links (idempotent: ensure all requested links exist, never delete real merchant links beyond seed set)
    for (const catId of categoryIds) {
      await prisma.productCategory.upsert({
        where: { productId_categoryId: { productId: productRecord.id, categoryId: catId } },
        create: { productId: productRecord.id, categoryId: catId },
        update: {},
      });
    }

    // Variant (one default variant per product). Upsert by SKU unique.
    const sku = p.variant.sku;
    const existingVariant = await prisma.productVariant.findUnique({ where: { sku } });
    const variantRecord = await prisma.productVariant.upsert({
      where: { sku },
      create: {
        productId: productRecord.id,
        title: p.variant.title,
        sku,
        barcode: null,
        price: p.variant.price,
        compareAtPrice: p.variant.compareAtPrice,
        costPrice: null,
        weight: p.variant.weight,
        isDefault: true,
        isActive: true,
        sortOrder: 0,
      },
      update: {
        title: p.variant.title,
        price: p.variant.price,
        compareAtPrice: p.variant.compareAtPrice,
        weight: p.variant.weight,
        isActive: true,
        isDefault: true,
      },
    });

    if (!existingVariant) variantsCreated++;
    else variantsMatched++;

    // Ensure exactly one default per product (seed variants are default; clear others if any)
    await prisma.productVariant.updateMany({
      where: { productId: productRecord.id, id: { not: variantRecord.id }, isDefault: true },
      data: { isDefault: false },
    });

    // Inventory — one per variant (unique variantId)
    const inv = await prisma.inventory.findUnique({ where: { variantId: variantRecord.id } });
    if (!inv) {
      await prisma.inventory.create({
        data: {
          variantId: variantRecord.id,
          quantity: p.variant.quantity,
          reservedQuantity: 0,
          lowStockThreshold: 5,
        },
      });
    } else {
      // Re-sync quantity to seed value only if below reserved? Seed is idempotent but
      // we preserve real stock movements: only bump quantity up to seed if empty,
      // otherwise leave as-is. To stay idempotent without clobbering real orders,
      // we ensure quantity is at least the seed value when currently 0.
      // For dev data with no orders, this is effectively: sync to seed value.
      // We choose to upsert quantity to max(existing, seed) only if existing==0.
      // Simpler: always sync quantity to seed when no orders touch it — but we can be conservative:
      // If reservedQuantity is 0 and quantity is low (< seed), reset to seed so re-runs repair manual wipes.
      if (inv.reservedQuantity === 0 && inv.quantity < p.variant.quantity) {
        await prisma.inventory.update({
          where: { variantId: variantRecord.id },
          data: { quantity: p.variant.quantity, lowStockThreshold: 5 },
        });
      }
    }

    // Product image — URL-only placeholder via existing image architecture
    const expectedUrl = placeholderUrl(p.slug);
    const existingImage = await prisma.productImage.findFirst({
      where: { productId: productRecord.id, url: expectedUrl },
    });
    if (!existingImage) {
      // Avoid duplicate placeholders on re-run: only create if none exists with this seed URL
      const anySeedImage = await prisma.productImage.findFirst({
        where: { productId: productRecord.id, url: { contains: DEV_SENTINEL } },
      });
      if (!anySeedImage) {
        const count = await prisma.productImage.count({ where: { productId: productRecord.id } });
        await prisma.productImage.create({
          data: {
            productId: productRecord.id,
            variantId: null,
            url: expectedUrl,
            alt: p.title,
            sortOrder: count,
          },
        });
      } else {
        // Seed image already exists under a slightly different URL — normalize to expected
        await prisma.productImage.update({
          where: { id: anySeedImage.id },
          data: { url: expectedUrl, alt: p.title },
        });
      }
    }

    // Specifications — upsert by (productId, key) unique
    for (const spec of p.specifications) {
      await prisma.productSpecification.upsert({
        where: { productId_key: { productId: productRecord.id, key: spec.key } },
        create: {
          productId: productRecord.id,
          key: spec.key,
          value: spec.value,
          sortOrder: spec.sortOrder,
        },
        update: {
          value: spec.value,
          sortOrder: spec.sortOrder,
        },
      });
    }
  }

  console.log(`[seed:dev] Products upserted — created: ${productsCreated}, matched: ${productsMatched}`);
  console.log(`[seed:dev] Variants upserted — created: ${variantsCreated}, matched: ${variantsMatched}`);

  // ── Read-only verification counts (req 9) ────────────────────────────────
  const [categoryCount, productCount, variantCount, inventoryCount, imageCount, featuredCount] = await Promise.all([
    prisma.category.count(),
    prisma.product.count(),
    prisma.productVariant.count(),
    prisma.inventory.count(),
    prisma.productImage.count(),
    prisma.product.count({ where: { status: "ACTIVE", isFeatured: true } }),
  ]);

  console.log("[seed:dev] Verification (read-only counts):");
  console.log(`  categories: ${categoryCount}`);
  console.log(`  products: ${productCount}`);
  console.log(`  variants: ${variantCount}`);
  console.log(`  inventories: ${inventoryCount}`);
  console.log(`  product_images: ${imageCount}`);
  console.log(`  featured (ACTIVE+isFeatured): ${featuredCount}`);

  // Seed-specific counts (dev rows only, filtered by sentinel slug/sku prefix)
  const [devProductCount, devVariantCount, devCategoryCount] = await Promise.all([
    prisma.product.count({ where: { slug: { startsWith: DEV_SENTINEL } } }),
    prisma.productVariant.count({ where: { sku: { startsWith: "REYHAN-DEV-" } } }),
    prisma.category.count({ where: { slug: { in: CATEGORIES.map((c) => c.slug) } } }),
  ]);
  console.log("[seed:dev] Dev sentinel counts:");
  console.log(`  dev categories (by slug list): ${devCategoryCount}`);
  console.log(`  dev products (slug startsWith reyhan-dev-): ${devProductCount}`);
  console.log(`  dev variants (sku startsWith REYHAN-DEV-): ${devVariantCount}`);

  if (devProductCount < 6) console.warn("[seed:dev] WARNING: dev product count below expected 6-10 range");
  if (featuredCount < 2) console.warn("[seed:dev] WARNING: featured count below expected 2-3 range");

  await prisma.$disconnect();
  console.log("[seed:dev] Done — idempotent, no destructive deletes performed.");
}

main().catch((err) => {
  console.error("[seed:dev] Failed:", err);
  process.exit(1);
});
