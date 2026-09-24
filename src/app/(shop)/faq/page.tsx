import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { canonicalUrl } from "@/lib/seo/site";

export const metadata: Metadata = {
  title: "سوالات متداول",
  description: "سوالات متداول خرید از فروشگاه ریحان.",
  alternates: { canonical: canonicalUrl("/faq") },
};

const FAQS = [
  { q: "چطور بفهمم کدام دستگاه برای من مناسب است؟", a: "نوع آب منطقه، میزان مصرف روزانه و فضای نصب را در نظر بگیرید. راهنمای خرید در وبلاگ و پشتیبانی تخصصی ریحان شما را راهنمایی می‌کند." },
  { q: "هزینه ارسال چقدر است؟", a: "هزینه ارسال بر اساس روش ارسال انتخابی و مقصد محاسبه می‌شود و پیش از پرداخت نهایی به شما اعلام می‌گردد." },
  { q: "آیا محصولات ضمانت دارند؟", a: "اصالت کالا تضمین می‌شود. شرایط ضمانت هر محصول در صفحه جزئیات آن ذکر شده است." },
  { q: "چطور سفارش خود را پیگیری کنم؟", a: "پس از ورود، از بخش حساب کاربری → سفارش‌ها وضعیت سفارش خود را مشاهده کنید." },
];

export default function FaqPage() {
  return (
    <Container className="py-8 sm:py-10">
      <nav aria-label="مسیر صفحه" className="mb-6 text-xs text-muted-foreground">
        <ol className="flex items-center gap-2">
          <li><Link href="/" className="hover:text-foreground">خانه</Link></li>
          <li aria-hidden="true" className="opacity-40">/</li>
          <li aria-current="page" className="font-medium text-foreground">سوالات متداول</li>
        </ol>
      </nav>
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold sm:text-3xl">سوالات متداول</h1>
        <div className="mt-8 space-y-3">
          {FAQS.map((f) => (
            <details key={f.q} className="group rounded-xl border bg-card px-5 py-4 shadow-card open:bg-muted/40">
              <summary className="cursor-pointer list-none text-sm font-semibold text-foreground">{f.q}</summary>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
        <p className="mt-8 text-sm text-muted-foreground">
          پرسش دیگری دارید؟ <Link href="/contact" className="font-medium text-[var(--reyhan-blue-700)] hover:underline">تماس با ما</Link>
        </p>
      </div>
    </Container>
  );
}
