import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { CartView } from "@/components/cart/cart-view";

// Transactional/private page — never indexed, no product content duplication.
export const metadata: Metadata = {
  title: "سبد خرید",
  description: "سبد خرید فروشگاه ریحان.",
  robots: { index: false, follow: false },
};

export default function CartPage() {
  return (
    <Container className="py-6 sm:py-8 lg:py-10">
      {/* Breadcrumb-ish heading */}
      <nav aria-label="مسیر صفحه" className="mb-4 text-xs text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/" className="transition-colors hover:text-foreground">
              خانه
            </Link>
          </li>
          <li aria-hidden="true" className="opacity-50">
            /
          </li>
          <li aria-current="page" className="font-medium text-foreground">
            سبد خرید
          </li>
        </ol>
      </nav>

      <h1 className="text-2xl font-bold text-foreground sm:text-3xl">سبد خرید</h1>
      <p className="mt-2 text-sm leading-7 text-muted-foreground">
        کالاهای انتخابی شما در این صفحه بررسی و با قیمت‌های به‌روز فروشگاه محاسبه می‌شوند.
      </p>

      <div className="mt-8">
        <CartView />
      </div>
    </Container>
  );
}
