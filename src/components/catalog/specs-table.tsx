import type { CatalogSpecification } from "@/lib/catalog/types";

type SpecsTableProps = {
  specifications: CatalogSpecification[];
};

export function SpecsTable({ specifications }: SpecsTableProps) {
  if (!specifications.length) return null;

  return (
    <div className="mt-4 rounded-lg border border-border p-4 bg-card">
      <h3 className="mb-3 text-sm font-semibold text-foreground">
        مشخصات فنی
      </h3>
      <div className="space-y-1">
        {specifications.map((spec) => (
          <div key={spec.key} className="flex justify-between text-sm">
            <span className="font-medium text-muted-foreground">{spec.key}</span>
            <span className="text-foreground">{spec.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}