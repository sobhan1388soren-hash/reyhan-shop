import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { canonicalUrl } from "@/lib/seo/site";

export const metadata: Metadata = {
  title: "درباره ریحان",
  description: "درباره فروشگاه تخصصی تصفیه آب خانگی ریحان.",
  alternates: { canonical: canonicalUrl("/about") },
};

export default function AboutPage() {
  return (
    <Container className="py-8 sm:py-10">
      <nav aria-label="مسیر صفحه" className="mb-6 text-xs text-muted-foreground">
        <ol className="flex items-center gap-2">
          <li><Link href="/" className="hover:text-foreground">خانه</Link></li>
          <li aria-hidden="true" className="opacity-40">/</li>
          <li aria-current="page" className="font-medium text-foreground">درباره ما</li>
        </ol>
      </nav>
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold sm:text-3xl">درباره ریحان</h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          ریحان فروشگاه تخصصی تصفیه آب خانگی است — تمرکز ما بر دستگاه‌ها، فیلترهای جایگزین، قطعات یدکی و لوازم جانبی با پشتیبانی تخصصی است.
        </p>
        <div className="mt-6 rounded-xl border bg-card p-6 shadow-card">
          <h2 className="text-sm font-bold text-foreground">اعتماد و تخصص</h2>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            محتوای تخصصی، راهنمای خرید و مقایسه محصولات را در <Link href="/blog" className="font-medium text-[var(--reyhan-blue-700)] hover:underline">وبلاگ ریحان</Link> دنبال کنید.
            برای پرسش‌های تخصصی، از <Link href="/contact" className="font-medium text-[var(--reyhan-blue-700)] hover:underline">تماس با ما</Link> استفاده کنید.
          </p>
        </div>
      </div>
    </Container>
  );
}
