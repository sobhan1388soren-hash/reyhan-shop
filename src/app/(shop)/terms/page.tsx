import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { canonicalUrl } from "@/lib/seo/site";
export const metadata: Metadata = { title: "قوانین و مقررات", description: "قوانین و مقررات فروشگاه ریحان.", alternates: { canonical: canonicalUrl("/terms") } };
export default function TermsPage() {
  return (
    <Container className="py-8 sm:py-10">
      <nav aria-label="مسیر صفحه" className="mb-6 text-xs text-muted-foreground"><ol className="flex items-center gap-2"><li><Link href="/" className="hover:text-foreground">خانه</Link></li><li aria-hidden="true" className="opacity-40">/</li><li aria-current="page" className="font-medium text-foreground">قوانین و مقررات</li></ol></nav>
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold sm:text-3xl">قوانین و مقررات</h1>
        <div className="mt-6 rounded-xl border bg-card p-6 shadow-card text-sm leading-7 text-muted-foreground">
          <p>استفاده از فروشگاه ریحان به معنای پذیرش قوانین زیر است: قیمت و موجودی کالاها تا پیش از ثبت نهایی سفارش ممکن است تغییر کند؛ سفارش پس از تایید پرداخت نهایی می‌شود.</p>
          <p className="mt-4">در صورت بروز مغایرت یا تاخیر در ارسال، پشتیبانی ریحان از طریق <Link href="/contact" className="font-medium text-[var(--reyhan-blue-700)] hover:underline">تماس با ما</Link> پاسخ‌گو خواهد بود.</p>
        </div>
      </div>
    </Container>
  );
}
