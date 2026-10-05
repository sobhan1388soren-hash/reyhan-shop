import prisma from "../src/lib/prisma";

const PRODUCTS = [
  {
    title: "دستگاه تصفیه آب ۶ مرحله‌ای ایزی‌ول مدل RO-116",
    slug: "easywell-ro-116-6-stage",
    shortDescription: "دستگاه تصفیه آب خانگی ۶ مرحله‌ای ایزی‌ول با فناوری اسمز معکوس (RO) مناسب آب شهری",
    description:
      "دستگاه تصفیه آب ۶ مرحله‌ای ایزی‌ول مدل RO-116 با فناوری پیشرفته اسمز معکوس، مناسب برای آب شهری و املاح کم تا متوسط. این دستگاه با عبور آب از ۶ مرحله فیلتراسیون شامل فیلترهای PP، UDF، CTO، ممبران RO، پست کربن و مینرال، آبی purified و سالم را برای خانواده شما فراهم می‌کند. دارای مخزن ذخیره ۱۶ لیتری، شیر برداشت اهرمی و گارانتی معتبر.",
    price: 8500000,
    compareAtPrice: 9800000,
    weight: 9500,
    isFeatured: true,
    isPublished: true,
    seoTitle: "دستگاه تصفیه آب ۶ مرحله‌ای ایزی‌ول RO-116 | فروشگاه ریحان",
    seoDescription:
      "خرید دستگاه تصفیه آب ۶ مرحله‌ای ایزی‌ول مدل RO-116 با فناوری اسمز معکوس. مناسب آب شهری، گارانتی معتبر. ارسال به سراسر ایران.",
    seoKeywords: "دستگاه تصفیه آب, ایزی‌ول, RO-116, تصفیه آب خانگی, فیلتر آب, اسمز معکوس",
    specifications: [
      { key: "تعداد مراحل فیلتراسیون", value: "۶ مرحله", sortOrder: 1 },
      { key: "نوع فناوری", value: "اسمز معکوس (RO)", sortOrder: 2 },
      { key: "ظرفیت تولید", value: "۵۰ گالن در روز (حدود ۱۸۹ لیتر)", sortOrder: 3 },
      { key: "مخزن ذخیره", value: "۱۶ لیتر", sortOrder: 4 },
      { key: "فشار پمپ", value: "۱۲۵ PSI", sortOrder: 5 },
      { key: "مناسب برای", value: "آب شهری با املاح کم تا متوسط", sortOrder: 6 },
      { key: "گارانتی", value: "۱ سال گارانتی معتبر", sortOrder: 7 },
    ],
  },
  {
    title: "فیلتر ممبران ۷۵ گالن اسمز معکوس فیلمتک (Filmtec)",
    slug: "filmtec-ro-membrane-75g",
    shortDescription: "فیلتر ممبران ۷۵ گالن Filmtec آمریکایی با کیفیت بالا جهت دستگاه‌های تصفیه آب RO",
    description:
      "فیلتر ممبران ۷۵ گالن فیلمتک (Filmtec) ساخت ایالات متحده آمریکا، قلب تپنده دستگاه‌های تصفیه آب با فناوری اسمز معکوس. این ممبران با دقت ۰.۰۰۰۱ میکرون قادر به حذف ۹۹.۸٪ ناخالصی‌ها، فلزات سنگین، باکتری‌ها و ویروس‌ها از آب است. عمر مفید ۲ تا ۳ سال بسته به کیفیت آب ورودی.",
    price: 680000,
    compareAtPrice: null,
    weight: 280,
    isFeatured: false,
    isPublished: true,
    seoTitle: "فیلتر ممبران ۷۵ گالن فیلمتک Filmtec | فروشگاه ریحان",
    seoDescription:
      "خرید فیلتر ممبران ۷۵ گالن فیلمتک (Filmtec) آمریکایی. اصل و با کیفیت، حذف ۹۹.۸٪ ناخالصی‌ها. ارسال به سراسر ایران.",
    seoKeywords: "فیلتر ممبران, ممبران فیلمتک, Filmtec, ممبران RO, فیلتر اسمز معکوس, تعویض ممبران",
    specifications: [
      { key: "ظرفیت", value: "۷۵ گالن در روز (۲۸۳ لیتر)", sortOrder: 1 },
      { key: "دقت فیلتراسیون", value: "۰.۰۰۰۱ میکرون", sortOrder: 2 },
      { key: "درصد حذف ناخالصی‌ها", value: "۹۹.۸٪", sortOrder: 3 },
      { key: "عمر مفید", value: "۲ تا ۳ سال", sortOrder: 4 },
      { key: "ساخت", value: "ایالات متحده آمریکا", sortOrder: 5 },
      { key: "مناسب برای", value: "تمامی دستگاه‌های RO استاندارد ۱۱ اینچی", sortOrder: 6 },
    ],
  },
  {
    title: "مخزن ذخیره آب تصفیه ۱۶ لیتری تانک پاک (TankPAC)",
    slug: "tankpac-water-storage-tank-16l",
    shortDescription: "مخزن ذخیره آب تصفیه ۱۶ لیتری تانک پاک با دیافراگم پزشکی و فشار داخلی استاندارد",
    description:
      "مخزن ذخیره آب تصفیه ۱۶ لیتری (۴ گالن) تانک پاک (TankPAC) با دیافراگم پزشکی از جنس EPDM و بدنه پلاستیکی فودگرید. این مخزن با فشار داخلی ۷ PSI (پیش‌بار اولیه) طراحی شده و برای استفاده در دستگاه‌های تصفیه آب اسمز معکوس (RO) مناسب است. اتصال ۱/۴ اینچی استاندارد.",
    price: 1950000,
    compareAtPrice: 2200000,
    weight: 3200,
    isFeatured: true,
    isPublished: true,
    seoTitle: "مخزن ذخیره آب تصفیه ۱۶ لیتری تانک پاک TankPAC | فروشگاه ریحان",
    seoDescription:
      "خرید مخزن ذخیره آب تصفیه ۱۶ لیتری تانک پاک (TankPAC) با دیافراگم پزشکی. مناسب دستگاه‌های RO. ارسال به سراسر ایران.",
    seoKeywords: "مخزن آب تصفیه, تانک پاک, TankPAC, مخزن RO, مخزن ذخیره آب, تصفیه آب خانگی",
    specifications: [
      { key: "ظرفیت", value: "۱۶ لیتر (۴ گالن)", sortOrder: 1 },
      { key: "فشار پیش‌بار", value: "۷ PSI", sortOrder: 2 },
      { key: "جنس دیافراگم", value: "EPDM پزشکی", sortOrder: 3 },
      { key: "جنس بدنه", value: "پلاستیک فودگرید", sortOrder: 4 },
      { key: "اتصال", value: "۱/۴ اینچی استاندارد", sortOrder: 5 },
      { key: "مناسب برای", value: "دستگاه‌های تصفیه آب RO خانگی", sortOrder: 6 },
    ],
  },
  {
    title: "پک فیلترهای پیش‌پالایش ۳ عددی (PP, UDF, CTO)",
    slug: "pre-filter-pack-3-stage",
    shortDescription: "پک ۳ عددی فیلترهای پیش‌پالایش شامل فیلتر الیافی PP، کربن فعال UDF و کربن بلاک CTO",
    description:
      "پک فیلترهای پیش‌پالایش ۳ عددی شامل: فیلتر الیافی ۵ میکرون PP، فیلتر کربن فعال گرانول UDF و فیلتر کربن بلاک CTO. این سه فیلتر مراحل اولیه تصفیه آب را انجام می‌دهند و از ورود ذرات معلق، کلر، بو و طعم نامطبوع به ممبران جلوگیری می‌کنند. عمر مفید: PP و UDF هر ۳-۶ ماه، CTO هر ۶-۹ ماه.",
    price: 390000,
    compareAtPrice: 450000,
    weight: 450,
    isFeatured: false,
    isPublished: true,
    seoTitle: "پک فیلترهای پیش‌پالایش ۳ عددی PP UDF CTO | فروشگاه ریحان",
    seoDescription:
      "خرید پک فیلترهای پیش‌پالایش ۳ عددی شامل فیلتر PP، UDF و CTO. فیلترهای اصلی دستگاه تصفیه آب RO. ارسال به سراسر ایران.",
    seoKeywords: "فیلتر تصفیه آب, پک فیلتر, فیلتر PP, فیلتر UDF, فیلتر CTO, فیلتر کربن, تصفیه آب خانگی",
    specifications: [
      { key: "محتویات", value: "فیلتر PP ۵ میکرون، فیلتر UDF، فیلتر CTO", sortOrder: 1 },
      { key: "دقت فیلتر PP", value: "۵ میکرون", sortOrder: 2 },
      { key: "جنس فیلتر UDF", value: "کربن فعال گرانول (GAC)", sortOrder: 3 },
      { key: "جنس فیلتر CTO", value: "کربن بلاک فشرده", sortOrder: 4 },
      { key: "عمر مفید", value: "۳ تا ۹ ماه (بسته به کیفیت آب)", sortOrder: 5 },
      { key: "سایز", value: "۱۰ اینچی استاندارد", sortOrder: 6 },
    ],
  },
  {
    title: "پمپ دستگاه تصفیه آب تایوانی هدرون (Headon) ۱۲۵ PSI",
    slug: "headon-booster-pump-125psi",
    shortDescription: "پمپ تقویتی تایوانی هدرون ۱۲۵ PSI مناسب فشار آب پایین شهری",
    description:
      "پمپ تقویتی (بوستر پمپ)Headon ساخت تایوان با فشار خروجی ۱۲۵ PSI (حدود ۸.۶ بار) برای دستگاه‌های تصفیه آب اسمز معکوس. این پمپ برای مناطقی با فشار آب شهری پایین طراحی شده و با ایجاد فشار کافی، عملکرد بهینه دستگاه تصفیه را تضمین می‌کند. دارای آداپتور ۲۴ ولت DC و اتصال ۱/۴ اینچی.",
    price: 1450000,
    compareAtPrice: 1680000,
    weight: 2100,
    isFeatured: false,
    isPublished: true,
    seoTitle: "پمپ دستگاه تصفیه آب هدرون Headon 125 PSI تایوان | فروشگاه ریحان",
    seoDescription:
      "خرید پمپ تقویتی Headon 125 PSI ساخت تایوان. مناسب دستگاه‌های تصفیه آب RO برای مناطق با فشار آب پایین. ارسال به سراسر ایران.",
    seoKeywords: "پمپ تصفیه آب, پمپ بوستر, هدرون, Headon, پمپ RO, تقویت فشار آب, تصفیه آب خانگی",
    specifications: [
      { key: "فشار خروجی", value: "۱۲۵ PSI (۸.۶ بار)", sortOrder: 1 },
      { key: "ولتاژ ورودی", value: "۲۴ ولت DC", sortOrder: 2 },
      { key: "ساخت", value: "تایوان", sortOrder: 3 },
      { key: "اتصال", value: "۱/۴ اینچی استاندارد", sortOrder: 4 },
      { key: "مناسب برای", value: "دستگاه‌های تصفیه آب RO خانگی", sortOrder: 5 },
      { key: "نوع", value: "پمپ دیافراگمی (تیDAYTON)", sortOrder: 6 },
    ],
  },
];

async function main() {
  console.log("[seed] Starting production seed...");

  let productsCreated = 0;
  let variantsCreated = 0;
  let inventoryCreated = 0;
  let specificationsCreated = 0;

  for (const product of PRODUCTS) {
    const existing = await prisma.product.findUnique({ where: { slug: product.slug } });
    if (existing) {
      console.log(`[seed] Product ${product.slug} already exists, skipping...`);
      continue;
    }

    const productRecord = await prisma.product.create({
      data: {
        title: product.title,
        slug: product.slug,
        shortDescription: product.shortDescription,
        description: product.description,
        status: product.isPublished ? "ACTIVE" : "DRAFT",
        isFeatured: product.isFeatured,
        publishedAt: product.isPublished ? new Date() : null,
        seoTitle: product.seoTitle,
        seoDescription: product.seoDescription,
        seoKeywords: product.seoKeywords,
      },
    });

    productsCreated++;

    const sku = `REYHAN-${product.slug.toUpperCase().replace(/-/g, "")}-V1`;

    const variantRecord = await prisma.productVariant.create({
      data: {
        productId: productRecord.id,
        title: `${product.title} — نسخه استاندارد`,
        sku,
        price: product.price,
        compareAtPrice: product.compareAtPrice,
        isDefault: true,
        isActive: true,
        sortOrder: 0,
      },
    });

    variantsCreated++;

    await prisma.inventory.create({
      data: {
        variantId: variantRecord.id,
        quantity: 25,
        reservedQuantity: 0,
        lowStockThreshold: 5,
      },
    });

    inventoryCreated++;

    for (const spec of product.specifications) {
      await prisma.productSpecification.create({
        data: {
          productId: productRecord.id,
          key: spec.key,
          value: spec.value,
          sortOrder: spec.sortOrder,
        },
      });
      specificationsCreated++;
    }

    await prisma.productImage.create({
      data: {
        productId: productRecord.id,
        url: `https://picsum.photos/seed/${product.slug}/600/400`,
        alt: product.title,
        sortOrder: 0,
      },
    });

    console.log(`[seed] Created: ${product.title}`);
  }

  console.log("[seed] Summary:");
  console.log(`  products: ${productsCreated}`);
  console.log(`  variants: ${variantsCreated}`);
  console.log(`  inventory records: ${inventoryCreated}`);
  console.log(`  specifications: ${specificationsCreated}`);
  console.log("[seed] Done.");
}

main()
  .catch((err) => {
    console.error("[seed] Failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });