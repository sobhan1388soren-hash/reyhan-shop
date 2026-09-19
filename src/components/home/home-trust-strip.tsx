// HomeTrustStrip — trust/expertise signals for the homepage.
//
// Content policy: these describe ACTUAL platform capabilities (the catalog's
// breadth, the consultation path, the knowledge center, the online ordering
// flow). No invented statistics, customer counts, years of experience,
// certifications, ratings or commercial guarantees are presented.

import type { ReactNode } from "react";

type TrustPoint = {
  title: string;
  description: string;
  icon: ReactNode;
};

const trustPoints: TrustPoint[] = [
  {
    title: "مشاوره تخصصی پیش از خرید",
    description:
      "انتخاب دستگاه بر اساس کیفیت آب منطقه و نیاز خانوار، با راهنمایی کارشناسان تصفیه آب.",
    icon: (
      <>
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.6" />
        <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </>
    ),
  },
  {
    title: "تنوع کامل تجهیزات",
    description:
      "دستگاه‌های تصفیه آب، فیلترهای جایگزین، قطعات یدکی و لوازم جانبی در یک مرجع تخصصی.",
    icon: (
      <>
        <path d="M12 3.5 20 8v8l-8 4.5L4 16V8l8-4.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M4 8l8 4.5L20 8M12 12.5V20.5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </>
    ),
  },
  {
    title: "مرکز دانش تخصصی",
    description:
      "مقالات آموزشی برای انتخاب، نصب و نگهداری تجهیزات تصفیه آب خانگی.",
    icon: (
      <>
        <rect x="4" y="3.5" width="16" height="17" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <path d="M8 8.5h8M8 12h8M8 15.5h4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </>
    ),
  },
  {
    title: "ثبت سفارش آنلاین",
    description:
      "خرید و ثبت سفارش به‌صورت آنلاین همراه با مشاهده تاریخچه خرید در حساب کاربری.",
    icon: (
      <>
        <path d="M4 5h2l2 11h10l2-8H8" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <circle cx="10" cy="20" r="1.6" stroke="currentColor" strokeWidth="1.4" />
        <circle cx="17" cy="20" r="1.6" stroke="currentColor" strokeWidth="1.4" />
      </>
    ),
  },
];

export function HomeTrustStrip() {
  return (
    <section aria-label="چرا ریحان" className="border-b bg-muted/30 py-8 sm:py-10">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
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
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.description}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
