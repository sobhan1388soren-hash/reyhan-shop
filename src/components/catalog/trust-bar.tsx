import Link from "next/link";

// Purchase-confidence signals for the product detail page — server component

const trustItems = [
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

export function TrustBar() {
  return (
    <section aria-label="تضمین‌های خرید" className="rounded-xl border bg-muted/30 p-5">
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {trustItems.map((item) => (
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
      <div className="mt-4 flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          پیش از خرید نیاز به مشاوره دارید؟ کارشناسان ریحان پاسخگوی شما هستند.
        </p>
        <Link
          href="/contact"
          className="inline-flex h-9 shrink-0 items-center justify-center rounded-md bg-primary px-4 text-xs font-medium text-primary-foreground shadow-sm transition-colors hover:bg-[var(--reyhan-blue-700)]"
        >
          گفت‌وگو با کارشناس
        </Link>
      </div>
    </section>
  );
}
