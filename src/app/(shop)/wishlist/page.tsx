import { Metadata } from "next";
import { Container } from "@/components/layout/container";
import { EmptyState } from "@/components/catalog/empty-state";
import { getCurrentUser } from "@/lib/auth/dal";
import { getWishlistByUserId } from "@/lib/wishlist/service";
import { getWishlistProducts } from "@/lib/wishlist/queries";
import { WishlistClientView } from "./wishlist-client";
import { buildMetadata } from "@/lib/seo/metadata";

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: "لیست علاقه‌مندی‌ها",
    description: "محصولات مورد علاقه شما",
    path: "/wishlist",
  });
}

export default async function WishlistPage() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <Container className="py-16">
        <EmptyState
          title="لطفاً وارد شوید"
          description="برای مشاهده لیست علاقه‌مندی‌ها، ابتدا وارد حساب کاربری خود شوید."
          actionHref="/login"
          actionLabel="ورود به حساب"
        />
      </Container>
    );
  }

  const wishlistResult = await getWishlistByUserId(user.id);
  if (wishlistResult.state === "error") {
    return (
      <Container className="py-16">
        <EmptyState
          title="خطا در بارگذاری"
          description="لطفاً صفحه را رفرش کنید."
          actionHref="/wishlist"
          actionLabel="تلاش مجدد"
        />
      </Container>
    );
  }

  const wishlist = wishlistResult.wishlist;
  if (!wishlist) {
    return (
      <Container className="py-16">
        <EmptyState
          title="لیست علاقه‌مندی‌ها خالی است"
          description="محصولات مورد علاقه خود را از صفحه محصولات به لیست اضافه کنید."
          actionHref="/products"
          actionLabel="مشاهده محصولات"
        />
      </Container>
    );
  }

  const products = await getWishlistProducts(wishlist.id);

  return (
    <Container className="py-8">
      <WishlistClientView
        wishlistId={wishlist.id}
        shareId={wishlist.shareId}
        isPublic={wishlist.isPublic}
        title={wishlist.title}
        initialProducts={products}
      />
    </Container>
  );
}