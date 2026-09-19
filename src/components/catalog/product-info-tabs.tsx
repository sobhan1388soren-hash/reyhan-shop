"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { CatalogSpecification } from "@/lib/catalog/types";

type InfoSection = {
  id: string;
  title: string;
  content: React.ReactNode;
};

type ProductInfoTabsProps = {
  description: string | null;
  specifications: CatalogSpecification[];
};

// Spec keys (Persian or English) recognized as informational sections
const COMPATIBILITY_KEYS = ["compatibility", "سازگاری", "compatibility information", "اطلاعات سازگاری"];
const INSTALLATION_KEYS = ["installation", "نصب", "راهنمای نصب", "installation guide", "installation guidance"];
const WARRANTY_KEYS = ["warranty", "گارانتی", " warranty", "warranty information", "اطلاعات گارانتی"];
const AFTERSALES_KEYS = ["after-sales", "services", "خدمات پس از فروش", "پشتیبانی پس از فروش"];
const BENEFITS_KEYS = ["benefits", "مزایا", "advantages", "ویژگی‌ها", "ویژگی ها"];

function matchSpec(
  specs: { key: string; value: string }[],
  keys: string[]
): { key: string; value: string } | null {
  for (const spec of specs) {
    const normalized = spec.key.trim().toLowerCase();
    if (keys.some((k) => normalized === k.toLowerCase())) return spec;
  }
  return null;
}

function Prose({ text }: { text: string }) {
  return (
    <p className="whitespace-pre-line text-sm leading-7 text-muted-foreground">
      {text}
    </p>
  );
}

function EmptyInfo({ label }: { label: string }) {
  return (
    <p className="text-sm text-muted-foreground">
      اطلاعات {label} برای این محصول ثبت نشده است. برای دریافت اطلاعات بیشتر{" "}
      می‌توانید با کارشناسان ما تماس بگیرید.
    </p>
  );
}

export function ProductInfoTabs({
  description,
  specifications,
}: ProductInfoTabsProps) {
  const specificationsWithMeta = React.useMemo(
    () => specifications.map((s) => ({ key: s.key, value: s.value })),
    [specifications]
  );
  const compatibility = matchSpec(specificationsWithMeta, COMPATIBILITY_KEYS);
  const installation = matchSpec(specificationsWithMeta, INSTALLATION_KEYS);
  const warranty = matchSpec(specificationsWithMeta, WARRANTY_KEYS);
  const afterSales = matchSpec(specificationsWithMeta, AFTERSALES_KEYS);
  const benefits = matchSpec(specificationsWithMeta, BENEFITS_KEYS);

  // Core spec rows exclude those surfaced as their own sections
  const coreSpecs = specifications.filter(
    (s) =>
      ![compatibility?.key, installation?.key, warranty?.key, afterSales?.key, benefits?.key]
        .filter(Boolean)
        .includes(s.key)
  );

  const sections: InfoSection[] = [
    {
      id: "description",
      title: "معرفی محصول",
      content: description ? <Prose text={description} /> : <EmptyInfo label="معرفی" />,
    },
    ...(benefits
      ? [
          {
            id: "benefits",
            title: "مزایا و ویژگی‌ها",
            content: <Prose text={benefits.value} />,
          },
        ]
      : []),
    {
      id: "specs",
      title: "مشخصات فنی",
      content: coreSpecs.length ? (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <caption className="sr-only">مشخصات فنی محصول</caption>
            <tbody>
              {coreSpecs.map((spec, i) => (
                <tr
                  key={spec.key}
                  className={cn(i % 2 === 0 ? "bg-muted/40" : "bg-background")}
                >
                  <th scope="row" className="w-1/3 px-4 py-3 text-start font-medium text-foreground">
                    {spec.key}
                  </th>
                  <td className="px-4 py-3 text-muted-foreground">{spec.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyInfo label="مشخصات فنی" />
      ),
    },
    ...(compatibility
      ? [
          {
            id: "compatibility",
            title: "اطلاعات سازگاری",
            content: <Prose text={compatibility.value} />,
          },
        ]
      : []),
    ...(installation
      ? [
          {
            id: "installation",
            title: "راهنمای نصب",
            content: <Prose text={installation.value} />,
          },
        ]
      : []),
    ...(warranty
      ? [
          {
            id: "warranty",
            title: "گارانتی",
            content: <Prose text={warranty.value} />,
          },
        ]
      : []),
    ...(afterSales
      ? [
          {
            id: "after-sales",
            title: "خدمات پس از فروش",
            content: <Prose text={afterSales.value} />,
          },
        ]
      : []),
  ];

  const [activeTab, setActiveTab] = React.useState(sections[0]?.id);

  return (
    <div>
      {/* Tab buttons — scrollable on mobile */}
      <div
        role="tablist"
        aria-label="اطلاعات محصول"
        className="flex gap-1 overflow-x-auto border-b pb-px"
      >
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={activeTab === s.id}
            aria-controls={`panel-${s.id}`}
            id={`tab-${s.id}`}
            onClick={() => setActiveTab(s.id)}
            className={cn(
              "shrink-0 rounded-t-md border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              activeTab === s.id
                ? "border-primary text-[var(--reyhan-blue-700)]"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {s.title}
          </button>
        ))}
      </div>

      {sections.map((s) => (
        <section
          key={s.id}
          id={`panel-${s.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${s.id}`}
          hidden={activeTab !== s.id}
          className="pt-5"
        >
          <h3 className="sr-only">{s.title}</h3>
          {s.content}
        </section>
      ))}
    </div>
  );
}
