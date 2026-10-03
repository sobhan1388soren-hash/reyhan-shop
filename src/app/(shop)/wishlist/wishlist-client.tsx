"use client";

import { useState, useTransition } from "react";
import { ProductCard } from "@/components/catalog/product-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toFaDigits } from "@/lib/catalog/format";
import type { CatalogProduct } from "@/lib/catalog/types";
import {
  removeFromWishlistAction,
  shareWishlistAction,
  unshareWishlistAction,
  updateWishlistTitleAction,
} from "@/app/actions/wishlist";

interface WishlistClientViewProps {
  wishlistId: string;
  shareId: string | null;
  isPublic: boolean;
  title: string;
  initialProducts: CatalogProduct[];
}

export function WishlistClientView({
  wishlistId,
  shareId,
  isPublic,
  title,
  initialProducts,
}: WishlistClientViewProps) {
  const [products, setProducts] = useState<CatalogProduct[]>(initialProducts);
  const [currentTitle, setCurrentTitle] = useState(title);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(title);
  const [publicLink, setPublicLink] = useState<{ shareId: string | null; isPublic: boolean }>({
    shareId,
    isPublic,
  });
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function showMessage(text: string) {
    setMessage(text);
    setTimeout(() => setMessage(null), 3000);
  }

  function handleRemove(productId: string, variantId?: string) {
    startTransition(async () => {
      const result = await removeFromWishlistAction(productId, variantId);
      if (result.state === "removed") {
        setProducts((prev) => prev.filter((p) => p.id !== productId));
        showMessage("از لیست علاقه‌مندی‌ها حذف شد.");
      } else if (result.state === "unauthenticated") {
        showMessage("لطفاً ابتدا وارد حساب خود شوید.");
      } else {
        showMessage("خطا در حذف؛ لطفاً دوباره تلاش کنید.");
      }
    });
  }

  function handleToggleShare() {
    startTransition(async () => {
      if (publicLink.isPublic) {
        const result = await unshareWishlistAction();
        if (result.state === "ok") {
          setPublicLink({ shareId: null, isPublic: false });
          showMessage("لینک اشتراک‌گذاری غیرفعال شد.");
        }
      } else {
        const result = await shareWishlistAction();
        if (result.state === "ok") {
          setPublicLink({ shareId: result.shareId, isPublic: true });
          showMessage("لینک عمومی ساخته شد.");
        }
      }
    });
  }

  function handleSaveTitle() {
    startTransition(async () => {
      const result = await updateWishlistTitleAction(titleDraft);
      if (result.state === "ok") {
        setCurrentTitle(titleDraft);
        setEditingTitle(false);
        showMessage("عنوان به‌روزرسانی شد.");
      } else {
        showMessage("خطا در ذخیره عنوان.");
      }
    });
  }

  const shareUrl =
    publicLink.shareId && typeof window !== "undefined"
      ? `${window.location.origin}/wishlist/${publicLink.shareId}`
      : null;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          {editingTitle ? (
            <div className="flex items-center gap-2">
              <Input
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                className="w-64"
                maxLength={200}
              />
              <Button onClick={handleSaveTitle} disabled={isPending} size="sm">
                ذخیره
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditingTitle(false);
                  setTitleDraft(currentTitle);
                }}
              >
                انصراف
              </Button>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-foreground">{currentTitle}</h1>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingTitle(true)}
                aria-label="ویرایش عنوان"
              >
                ✏️
              </Button>
            </>
          )}
          <span className="text-sm text-muted-foreground">
            {toFaDigits(products.length)} محصول
          </span>
        </div>

        <Button variant="outline" size="sm" onClick={handleToggleShare} disabled={isPending}>
          {publicLink.isPublic ? "غیرفعال کردن اشتراک‌گذاری" : "ایجاد لینک عمومی"}
        </Button>
      </div>

      {publicLink.isPublic && shareUrl && (
        <div className="mb-6 rounded-lg border bg-muted/40 p-3 text-sm">
          <div className="mb-1 text-muted-foreground">لینک عمومی لیست:</div>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-background px-2 py-1 text-xs" dir="ltr">
              {shareUrl}
            </code>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                navigator.clipboard?.writeText(shareUrl);
                showMessage("لینک کپی شد.");
              }}
            >
              کپی
            </Button>
          </div>
        </div>
      )}

      {message && (
        <p className="mb-4 rounded-md bg-[var(--reyhan-blue-50)] px-3 py-2 text-sm text-[var(--reyhan-blue-700)]">
          {message}
        </p>
      )}

      {products.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border bg-card px-6 py-14 text-center">
          <h3 className="text-[15px] font-bold text-foreground">لیست علاقه‌مندی‌ها خالی است</h3>
          <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            محصولات مورد علاقه خود را از صفحه محصولات به لیست اضافه کنید.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((product) => (
            <div key={product.id} className="relative">
              <ProductCard product={product} />
              <button
                onClick={() => handleRemove(product.id)}
                disabled={isPending}
                className="absolute end-2 top-2 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-xs font-medium text-destructive shadow-sm transition-colors hover:bg-white disabled:opacity-50"
                aria-label={`حذف ${product.title} از لیست`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}