import * as React from "react";
import type { CatalogSpecification } from "@/lib/catalog/types";

// Product-specific FAQ — reads Q&A pairs from product specifications
// (spec key prefix "faq:" — value format "question|answer").
// Falls back to a concise store-policy FAQ when no product-specific data exists.

type FaqItem = { question: string; answer: string };

const FAQ_SPEC_PREFIX = "faq:";

function parseSpecFaqs(specs: CatalogSpecification[]): FaqItem[] {
  const items: FaqItem[] = [];
  for (const spec of specs) {
    if (!spec.key.toLowerCase().startsWith(FAQ_SPEC_PREFIX)) continue;
    const raw = spec.value;
    const sep = raw.indexOf("|");
    if (sep <= 0) continue;
    const question = raw.slice(0, sep).trim();
    const answer = raw.slice(sep + 1).trim();
    if (question && answer) items.push({ question, answer });
  }
  return items;
}

const storeFaq: FaqItem[] = [
  {
    question: "این محصول شامل ارسال است؟",
    answer:
      "بله، محصولات ریحان با ارسال به سراسر ایران عرضه می‌شوند. هزینه و زمان ارسال پس از ثبت سفارش از طریق پشتیبانی اعلام می‌شود.",
  },
  {
    question: "امکان مرجوع کردن محصول وجود دارد؟",
    answer:
      "در صورت خرابی یا مغایرت کالا با سفارش، تا ۷ روز پس از دریافت می‌توانید درخواست مرجوعی ثبت کنید.",
  },
  {
    question: "این محصول گارانتی دارد؟",
    answer:
      "بله. دستگاه‌ها و قطعات دارای گارانتی معتبر هستند؛ مدت و شرایط گارانتی هر محصول در مشخصات آن ذکر شده است.",
  },
  {
    question: "برای انتخاب مدل مناسب چه کنم؟",
    answer:
      "می‌توانید پیش از خرید از طریق صفحه تماس با ما با کارشناسان ریحان مشورت کنید تا مناسب‌ترین گزینه را بر اساس کیفیت آب منطقه شما پیشنهاد دهند.",
  },
];

function FaqItemRow({ item }: { item: FaqItem }) {
  return (
    <details className="group rounded-lg border bg-card px-4 py-3 [&_summary::-webkit-details-marker]:hidden">
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
  );
}

export function ProductFaqSection({
  specifications,
}: {
  specifications: CatalogSpecification[];
}) {
  const productFaqs = React.useMemo(() => parseSpecFaqs(specifications), [specifications]);
  const items = productFaqs.length > 0 ? productFaqs : storeFaq;

  return (
    <section aria-labelledby="faq-heading" className="space-y-4">
      <h2 id="faq-heading" className="text-lg font-semibold text-foreground">
        سوالات متداول
      </h2>
      {productFaqs.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          پاسخ به پرسش‌های رایج درباره این محصول
        </p>
      ) : null}
      <div className="space-y-2">
        {items.map((item) => (
          <FaqItemRow key={item.question} item={item} />
        ))}
      </div>
    </section>
  );
}
