import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { canonicalUrl } from "@/lib/seo/site";
export const metadata: Metadata = { title: "حریم خصوصی", description: "سیاست حریم خصوصی فروشگاه ریحان.", alternates: { canonical: canonicalUrl("/privacy") } };
export default function PrivacyPage() {
  return (
    <Container className="py-8 sm:py-10">
      <nav aria-label="مسیر صفحه" className="mb-6 text-xs text-muted-foreground"><ol className="flex items-center gap-2"><li><Link href="/" className="hover:text-foreground">خانه</Link></li><li aria-hidden="true" className="opacity-40">/</li><li aria-current="page" className="font-medium text-foreground">حریم خصوصی</li></ol></nav>
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold sm:text-3xl">حریم خصوصی</h1>
        <div className="mt-6 rounded-xl border bg-card p-6 shadow-card text-sm leading-7 text-muted-foreground">
          <p>ریحان به حریم خصوصی شما احترام می‌گذارد. اطلاعات حساب، نشانی‌ها و سفارش‌های شما تنها برای پردازش سفارش و پشتیبانی استفاده می‌شود و بدون رضایت شما در اختیار شخص ثالث قرار نمی‌گیرد.</p>
          <p className="mt-4">برای پرسش درباره داده‌های خود با <Link href="/contact" className="font-medium text-[var(--reyhan-blue-700)] hover:underline">تماس با ما</Link> در ارتباط باشید.</p>
        </div>
      </div>
    </Container>
  );
}
