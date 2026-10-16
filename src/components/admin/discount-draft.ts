import type { AdminDiscountDetail } from "@/lib/admin/discount-admin-service";

export type DiscountDraft = {
  code: string;
  type: string;
  value: string;
  minOrderAmount: string;
  maxDiscountAmount: string;
  maxUses: string;
  maxUsesPerUser: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
};

export const emptyDiscountDraft: DiscountDraft = {
  code: "",
  type: "PERCENTAGE",
  value: "",
  minOrderAmount: "",
  maxDiscountAmount: "",
  maxUses: "",
  maxUsesPerUser: "",
  startsAt: "",
  endsAt: "",
  isActive: true,
};

function toDateInput(date: Date | null): string {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

function tomanField(rial: number | null): string {
  if (rial == null) return "";
  return String(Math.round(rial / 10));
}

export function draftFromDiscount(discount: AdminDiscountDetail): DiscountDraft {
  return {
    code: discount.code,
    type: discount.type,
    value:
      discount.type === "PERCENTAGE"
        ? String(discount.value)
        : discount.type === "FIXED_AMOUNT"
          ? tomanField(discount.value)
          : "",
    minOrderAmount: tomanField(discount.minOrderAmount),
    maxDiscountAmount: tomanField(discount.maxDiscountAmount),
    maxUses: discount.maxUses != null ? String(discount.maxUses) : "",
    maxUsesPerUser: discount.maxUsesPerUser != null ? String(discount.maxUsesPerUser) : "",
    startsAt: toDateInput(discount.startsAt),
    endsAt: toDateInput(discount.endsAt),
    isActive: discount.isActive,
  };
}
