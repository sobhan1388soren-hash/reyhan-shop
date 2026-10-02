import { NextResponse } from "next/server";
import { getCompareProducts } from "@/lib/wishlist/queries";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slugsParam = searchParams.get("slugs") ?? "";
  const slugs = slugsParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 10);

  if (slugs.length === 0) {
    return NextResponse.json({ products: [] });
  }

  const products = await getCompareProducts(slugs);
  return NextResponse.json({ products });
}