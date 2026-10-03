"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRecentlyViewed } from "@/lib/recently-viewed/hooks";
import { readRecentSlugs } from "@/lib/recently-viewed/storage";
import type { CatalogProduct } from "@/lib/catalog/types";
import { ProductCard } from "@/components/catalog/product-card";
import { Container } from "@/components/layout/container";
import { HomeSectionHeading } from "@/components/home/section-heading";

async function fetchProductsBySlugs(slugs: string[]): Promise<CatalogProduct[]> {
  if (slugs.length === 0) return [];
  const res = await fetch(`/api/products/by-slugs?slugs=${encodeURIComponent(slugs.join(","))}`, {
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.products ?? [];
}

export function RecentlyViewedSection() {
  const { slugs } = useRecentlyViewed();
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (slugs.length === 0) {
      setProducts([]);
      return;
    }
    setLoading(true);
    fetchProductsBySlugs(slugs)
      .then((p) => {
        const map = new Map(p.map((pr) => [pr.slug, pr]));
        setProducts(slugs.map((s) => map.get(s)).filter(Boolean) as CatalogProduct[]);
      })
      .finally(() => setLoading(false));
  }, [slugs]);

  if (slugs.length === 0 || products.length === 0) return null;

  return (
    <section className="py-8">
      <Container>
        <HomeSectionHeading
          title="بازدیدهای اخیر"
          description="محصولاتی که اخیراً مشاهده کرده‌اید"
        />
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {products.map((product) => (
            <ProductCard key={product.slug} product={product} />
          ))}
        </div>
        <div className="mt-6 flex justify-center">
          <Link
            href="/products"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            مشاهده همه محصولات
          </Link>
        </div>
      </Container>
    </section>
  );
}

export function TrackProductView({ slug }: { slug: string }) {
  useEffect(() => {
    const { addRecentSlug } = require("@/lib/recently-viewed/storage");
    addRecentSlug(slug);
  }, [slug]);
  return null;
}