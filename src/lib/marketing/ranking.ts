// Pure, DB-free ranking helpers for the homepage marketing selections
// (Phase 16). Kept separate from the Prisma-backed queries so the merge
// step is unit-testable in a bare `node --test` process — the DB layer
// computes the ordered sales ranking; this module turns that ranking into
// an ordered, storefront-valid product list.

/**
 * Turn a sales-ranked list of product ids into an ordered product list.
 *
 * Contract:
 *   - `ranked` is already ordered by real sales volume (the query's job);
 *     only its order and ids are used here — volumes are never surfaced
 *   - `products` are the rows actually fetched (already filtered to
 *     storefront-valid statuses upstream); any ranked id whose row is
 *     absent was dropped and is skipped, so the output order still matches
 *     the ranking
 *   - the result is capped at `take`
 */
export function selectRankedProducts<T extends { id: string }>(
  ranked: ReadonlyArray<{ productId: string }>,
  products: ReadonlyArray<T>,
  take: number
): T[] {
  const limit = Math.max(0, take);
  const byId = new Map(products.map((p) => [p.id, p]));
  const out: T[] = [];
  for (const row of ranked) {
    if (out.length >= limit) break;
    const product = byId.get(row.productId);
    if (product) out.push(product);
  }
  return out;
}
