import { Badge } from "@/components/ui/badge";
import { availabilityLabel, availabilityVariant } from "@/lib/catalog/availability";
import type { AvailabilityState } from "@/lib/catalog/types";

export function ProductAvailability({ state, size = "default" }: { state: AvailabilityState; size?: "default" | "sm" }) {
  return (
    <Badge
      variant={availabilityVariant(state)}
      className={size === "sm" ? "px-2 py-0 text-[11px]" : undefined}
    >
      <span className="inline-flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="size-1.5 rounded-full bg-current opacity-80"
        />
        {availabilityLabel(state)}
      </span>
    </Badge>
  );
}
