import { formatPriceToman, formatPriceRange } from "@/lib/catalog/format";

export function Price({ value }: { value: number | null | undefined }) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  return <span className="font-medium tabular-nums">{formatPriceToman(value)}</span>;
}

export function PriceRange({ min, max }: { min: number | null; max: number | null }) {
  if (min == null && max == null) return <span className="text-sm text-muted-foreground">قیمت اعلام نشده است</span>;
  if (min != null && max != null && min !== max) {
    return (
      <span className="font-semibold tabular-nums text-foreground">
        {formatPriceRange(min, max)}
      </span>
    );
  }
  return <Price value={min ?? max} />;
}
