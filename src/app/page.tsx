import Link from "next/link";
import { Container, Section } from "@/components/layout/container";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HeroVisual } from "@/components/home/hero-visual";

const categories = [
  {
    title: "دستگاه‌های تصفیه آب",
    description: "سیستم‌های رومیزی و زیرسینکی برای آب پاک خانگی.",
    accent: "bg-[var(--reyhan-blue-50)] text-[var(--reyhan-blue-700)]",
    icon: (
      <>
        <path d="M12 3.2C12 3.2 7.2 8.2 7.2 12.2C7.2 14.9 9.35 17.05 12 17.05C14.65 17.05 16.8 14.9 16.8 12.2C16.8 8.2 12 3.2 12 3.2Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M12 17.05C12 17.05 13.1 19 15.2 19.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity=".8" />
      </>
    ),
  },
  {
    title: "فیلترها",
    description: "فیلترهای جایگزین باکیفیت — نگهداری منظم، جریان سالم.",
    accent: "bg-[var(--reyhan-green-50)] text-[var(--reyhan-green-700)]",
    icon: (
      <>
        <rect x="4" y="8" width="16" height="10" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
        <path d="M8 8V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V8" stroke="currentColor" strokeWidth="1.6" />
        <path d="M4.5 12h15" stroke="currentColor" strokeWidth="1.4" />
      </>
    ),
  },
  {
    title: "قطعات یدکی",
    description: "شیرها، محفظه‌ها و اتصالات — نگهداری با اطمینان.",
    accent: "bg-muted text-muted-foreground",
    icon: (
      <>
        <path d="M14 4.5a4 4 0 0 0-5.7 4.4L4.5 12.7a2 2 0 1 0 2.8 2.8l3.8-3.8a4 4 0 0 0 4.4-5.7l-2 2-1.8-.5-.5-1.8 2-2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </>
    ),
  },
  {
    title: "لوازم جانبی",
    description: "شمیرها، مخازن و متعلقات برای راه‌اندازی کامل.",
    accent: "bg-[var(--reyhan-blue-50)] text-[var(--reyhan-blue-700)]",
    icon: (
      <>
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
        <path d="M12 8v4l2.5 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
];

const categorySlugs = [
  "water-purification-devices",
  "filters",
  "spare-parts",
  "accessories",
];

const heroStats = [
  { value: "+۵", label: "سال تجربه تخصصی" },
  { value: "۲۴/۷", label: "پشتیبانی کارشناسان" },
  { value: "۱۰۰٪", label: "تضمین اصالت کالا" },
];

const trustPoints = [
  {
    title: "تضمین اصالت کالا",
    description: "همه محصولات اورجینال و دارای اصالت هستند.",
    icon: (
      <path
        d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    ),
  },
  {
    title: "گارانتی معتبر",
    description: "گارانتی رسمی برای دستگاه‌ها و قطعات ارائه می‌شود.",
    icon: (
      <>
        <circle cx="12" cy="10" r="6" stroke="currentColor" strokeWidth="1.5" />
        <path d="M9.5 10l1.8 1.8L15 8.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  {
    title: "ارسال به سراسر ایران",
    description: "پس‌کرایه به تمام نقاط کشور ارسال می‌شود.",
    icon: (
      <>
        <path d="M3 7h9v9H3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M12 10h4l3 3v3h-7" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <circle cx="7" cy="17.5" r="1.6" stroke="currentColor" strokeWidth="1.4" />
        <circle cx="16" cy="17.5" r="1.6" stroke="currentColor" strokeWidth="1.4" />
      </>
    ),
  },
  {
    title: "پشتیبانی تخصصی",
    description: "کارشناسان ما همراه شما هستند، از انتخاب تا نصب.",
    icon: (
      <>
        <path
          d="M4 12a8 8 0 1 1 2.3 5.7L4 20"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M9 12h.01M12 12h.01M15 12h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </>
    ),
  },
];

const steps = [
  {
    title: "انتخاب و مشاوره",
    description: "بر اساس کیفیت آب منطقه و نیاز خانوار، بهترین گزینه را با کارشناسان ما انتخاب کنید.",
    icon: (
      <>
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.6" />
        <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </>
    ),
  },
  {
    title: "خرید مطمئن",
    description: "سفارش خود را با تضمین اصالت کالا و گارانتی معتبر، به‌سادگی ثبت کنید.",
    icon: (
      <>
        <path d="M4 5h2l2 11h10l2-8H8" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <circle cx="10" cy="20" r="1.6" stroke="currentColor" strokeWidth="1.4" />
        <circle cx="17" cy="20" r="1.6" stroke="currentColor" strokeWidth="1.4" />
      </>
    ),
  },
  {
    title: "نصب و راه‌اندازی",
    description: "راهنمای نصب گام‌به‌گام و پشتیبانی کارشناسان تا نخستین لیوان آب پاک.",
    icon: (
      <>
        <path d="M12 3.2C12 3.2 7.2 8.2 7.2 12.2C7.2 14.9 9.35 17.05 12 17.05C14.65 17.05 16.8 14.9 16.8 12.2C16.8 8.2 12 3.2 12 3.2Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </>
    ),
  },
  {
    title: "نگهداری و خدمات",
    description: "یادآوری تعویض فیلتر و تأمین قطعات یدکی برای عمر طولانی دستگاه شما.",
    icon: (
      <>
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
        <path d="M12 8v4l2.5 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
];

const faqs = [
  {
    question: "کدام دستگاه تصفیه آب برای خانه من مناسب است؟",
    answer:
      "انتخاب دستگاه به کیفیت آب منطقه، تعداد افراد خانوار و فضای نصب بستگی دارد. کارشناسان ریحان با تحلیل این موارد، مناسب‌ترین گزینه را پیشنهاد می‌دهند.",
  },
  {
    question: "فیلترها هر چند وقت یک‌بار باید تعویض شوند؟",
    answer:
      "معمولاً فیلترهای پیش تصفیه هر ۶ تا ۸ ماه و ممبران روزانه‌ی سیستم‌های اسمز معکوس هر ۲ تا ۳ سال نیاز به تعویض دارند. کیفیت آب منطقه در این بازه‌ها مؤثر است.",
  },
  {
    question: "خدمات پس از فروش به چه شکل است؟",
    answer:
      "گارانتی معتبر، تأمین قطعات یدکی و پشتیبانی تخصصی از انتخاب تا نگهداری در کنار شماست. پس از خرید، راهنمای نصب گام‌به‌گام نیز در اختیار شما قرار می‌گیرد.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      {/* Hero — split composition: content + product visual */}
      <Section className="border-b bg-gradient-to-b from-[var(--reyhan-blue-50)]/60 via-white to-white py-10 sm:py-14 lg:py-20">
        <Container>
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-12 xl:gap-16">
            {/* Content side */}
            <div className="max-w-xl">
              <Badge variant="success" className="mb-4">
                اعتماد · سلامت · تخصص
              </Badge>
              <h1 className="text-balance text-3xl font-bold leading-[1.35] text-foreground sm:text-4xl sm:leading-[1.35] lg:text-[2.75rem] lg:leading-[1.35]">
                آبِ پاک برای{" "}
                <span className="text-[var(--reyhan-blue-600)]">خانه‌ای سالم</span>
              </h1>
              <p className="mt-5 text-pretty text-base leading-8 text-muted-foreground sm:text-lg sm:leading-9">
                ریحان — فروشگاه تخصصی تجهیزات تصفیه آب خانگی. دستگاه‌ها، فیلترها،
                قطعات یدکی و لوازم جانبی، با تضمین اصالت و پشتیبانی کارشناسان.
              </p>

              {/* CTAs */}
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/products"
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-primary px-8 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-[var(--reyhan-blue-700)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:w-auto"
                >
                  مشاهده محصولات
                  <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 rtl:rotate-180" fill="none">
                    <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex h-12 w-full items-center justify-center rounded-md border border-input bg-background px-8 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:w-auto"
                >
                  دریافت مشاوره تخصصی
                </Link>
              </div>

              {/* Hero stats — trust signals */}
              <dl className="mt-10 grid grid-cols-3 gap-3 sm:gap-6">
                {heroStats.map((s) => (
                  <div key={s.label} className="border-e pe-3 last:border-e-0 sm:pe-4">
                    <dt className="sr-only">{s.label}</dt>
                    <dd className="text-xl font-bold tabular-nums text-[var(--reyhan-blue-700)] sm:text-2xl">
                      {s.value}
                    </dd>
                    <dd className="mt-1 text-xs text-muted-foreground sm:text-xs">
                      {s.label}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Visual side — brand illustration, no fake product photos */}
            <div className="relative order-first mx-auto w-full max-w-md px-2 sm:max-w-lg lg:order-none lg:max-w-none lg:px-0">
              <HeroVisual className="mx-auto h-auto w-full drop-shadow-sm" />
            </div>
          </div>
        </Container>
      </Section>

      {/* Trust strip — why Reyhan, with 4 guarantees */}
      <Section className="border-b bg-muted/30 py-8 sm:py-10">
        <Container>
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {trustPoints.map((item) => (
              <li key={item.title} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--reyhan-blue-50)] text-[var(--reyhan-blue-700)]">
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none">
                    {item.icon}
                  </svg>
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{item.title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      {/* Categories — 4-up cards */}
      <Section>
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
              خرید بر اساس دسته‌بندی
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              دسته‌بندی‌های فروشگاه ریحان — دستگاه‌ها، فیلترها، قطعات و لوازم جانبی.
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map((cat, i) => (
              <Card key={cat.title} className="group flex flex-col transition-shadow hover:shadow-md">
                <CardHeader className="pb-3">
                  <span className={`inline-flex size-11 shrink-0 items-center justify-center rounded-xl ${cat.accent}`}>
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5.5" fill="none">
                      {cat.icon}
                    </svg>
                  </span>
                  <CardTitle className="mt-3 text-base leading-6">{cat.title}</CardTitle>
                  <CardDescription className="leading-6">{cat.description}</CardDescription>
                </CardHeader>
                <CardContent className="mt-auto pt-0">
                  <Link
                    href={`/categories/${categorySlugs[i]}`}
                    className="inline-flex h-9 w-full items-center justify-center rounded-md border border-input bg-background px-3 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground group-hover:border-primary/40"
                  >
                    مشاهده محصولات
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-2 text-sm">
            <Link href="/blog" className="rounded-full border bg-background px-4 py-2 transition-colors hover:bg-accent">
              وبلاگ
            </Link>
            <Link href="/contact" className="rounded-full border bg-background px-4 py-2 transition-colors hover:bg-accent">
              تماس با ما
            </Link>
            <Link href="/products" className="rounded-full bg-primary px-4 py-2 font-medium text-primary-foreground transition-colors hover:bg-[var(--reyhan-blue-700)]">
              مشاهده همه ←
            </Link>
          </div>
        </Container>
      </Section>

      {/* How it works — 4-step journey */}
      <Section className="border-y bg-muted/30">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
              مسیر خرید تا آب پاک
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              از انتخاب دستگاه تا نگهداری آن — ریحان در تمام مراحل کنار شماست.
            </p>
          </div>

          <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, i) => (
              <li key={step.title} className="relative flex flex-col items-center text-center">
                <span className="flex size-14 items-center justify-center rounded-2xl border bg-card text-[var(--reyhan-blue-700)] shadow-card">
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6" fill="none">
                    {step.icon}
                  </svg>
                </span>
                <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--reyhan-blue-600)]">
                  گام {new Intl.NumberFormat("fa-IR").format(i + 1)}
                </span>
                <h3 className="mt-1.5 text-base font-bold text-foreground">{step.title}</h3>
                <p className="mt-2 text-xs leading-6 text-muted-foreground">
                  {step.description}
                </p>
              </li>
            ))}
          </ol>
        </Container>
      </Section>

      {/* FAQ — store-level */}
      <Section>
        <Container>
          <div className="grid gap-8 lg:grid-cols-12 lg:gap-12">
            <div className="lg:col-span-5">
              <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
                سوالات متداول
              </h2>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                پاسخ پرسش‌های رایج درباره خرید و نگهداری تجهیزات تصفیه آب خانگی.
              </p>
              <Link
                href="/contact"
                className="mt-5 inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                پاسخ خود را پیدا نکردید؟ تماس بگیرید
              </Link>
            </div>
            <div className="lg:col-span-7">
              <div className="space-y-2">
                {faqs.map((item) => (
                  <details key={item.question} className="group rounded-lg border bg-card px-4 py-3 [&_summary::-webkit-details-marker]:hidden">
                    <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm font-medium text-foreground">
                      {item.question}
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 16 16"
                        className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                        fill="none"
                      >
                        <path
                          d="M4 6L8 10L12 6"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </summary>
                    <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.answer}</p>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </Container>
      </Section>

      {/* Final CTA band */}
      <Section className="pb-12 sm:pb-16">
        <Container>
          <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-l from-[var(--reyhan-blue-50)] via-white to-[var(--reyhan-green-50)] px-6 py-10 text-center sm:px-10 sm:py-14">
            <h2 className="text-balance text-xl font-bold text-foreground sm:text-2xl">
              همین امروز، آب سالم‌تر بنوشید
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-muted-foreground">
              کارشناسان ریحان برای انتخاب مناسب‌ترین سیستم تصفیه آب، متناسب با
              شرایط خانه شما در کنارشان هستند.
            </p>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/products"
                className="inline-flex h-11 w-full items-center justify-center rounded-md bg-primary px-8 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-[var(--reyhan-blue-700)] sm:w-auto"
              >
                مشاهده محصولات
              </Link>
              <Link
                href="/contact"
                className="inline-flex h-11 w-full items-center justify-center rounded-md border border-input bg-background px-8 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground sm:w-auto"
              >
                دریافت مشاوره تخصصی
              </Link>
            </div>
          </div>
        </Container>
      </Section>
    </div>
  );
}
