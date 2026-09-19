import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/dal";
import { getAdminProductById, getAdminCategoryOptions } from "@/lib/admin/product-service";
import { canViewCostPrice } from "@/lib/admin/product-rules";
import { productStatusLabels, productStatusTones } from "@/lib/admin/labels";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminListErrorState } from "@/components/admin/admin-list";
import { ProductForm, draftFromProduct } from "@/components/admin/product-form";
import { ProductStatusActions } from "@/components/admin/product-status-actions";
import { ProductManager } from "@/components/admin/product-manager";
import { formatFaDate } from "@/lib/catalog/format";
import { SITE_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: {
    default: "مدیریت محصول",
    template: `%s | ${SITE_NAME}`,
  },
};

type PageProps = {
  params: Promise<{ productId: string }>;
};

export default async function AdminProductDetailPage({ params }: PageProps) {
  const { productId } = await params;
  const user = await requireAdmin();

  const [result, categories] = await Promise.all([
    getAdminProductById(user, productId),
    getAdminCategoryOptions(),
  ]);

  if (result.state === "error") {
    return (
      <div>
        <AdminPageHeader title="مدیریت محصول" />
        <AdminListErrorState onRetryHref="/admin/products" />
      </div>
    );
  }
  if (result.state === "notFound") notFound();

  const product = result.data;
  const canViewCost = canViewCostPrice(user.adminRole);
  const categoryOptions = categories.state === "ok" ? categories.categories : [];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={product.title}
        description={`ایجاد: ${formatFaDate(product.createdAt)} · آخرین به‌روزرسانی: ${formatFaDate(product.updatedAt)}`}
        actions={
          <div className="flex items-center gap-2">
            <AdminStatusBadge tone={productStatusTones[product.status]} className="px-3 py-1 text-xs">
              {productStatusLabels[product.status]}
            </AdminStatusBadge>
            {product.status === "ACTIVE" && (
              <Link
                href={`/products/${product.slug}`}
                className="inline-flex h-9 items-center rounded-md border border-input bg-background px-4 text-xs font-medium transition-colors hover:bg-accent"
                target="_blank"
                rel="noreferrer"
              >
                مشاهده در فروشگاه
              </Link>
            )}
            <Link
              href="/admin/products"
              className="inline-flex h-9 items-center rounded-md border border-input bg-background px-4 text-xs font-medium transition-colors hover:bg-accent"
            >
              بازگشت
            </Link>
          </div>
        }
      />

      <ProductStatusActions
        productId={product.id}
        status={product.status}
        variantCount={product.variants.length}
        orderItemCount={product.orderItemCount}
      />

      <ProductManager product={product} canViewCost={canViewCost} />

      <section>
        <h2 className="mb-3 text-base font-semibold text-foreground">اطلاعات محصول</h2>
        <ProductForm draft={draftFromProduct(product)} categories={categoryOptions} />
      </section>
    </div>
  );
}