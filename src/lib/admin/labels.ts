// Persian label/tone maps for admin status display — built ONLY on the
// real schema enums (OrderStatus, PaymentStatus, UserStatus, UserRole,
// DiscountType). No invented business states. Tone keys match the shared
// AdminStatusBadge so colors communicate meaning consistently across all
// admin modules.

import type {
  OrderStatus,
  PaymentStatus,
  UserStatus,
  UserRole,
  DiscountType,
  CategoryStatus,
  ProductStatus,
  ReviewStatus,
  QuestionStatus,
  PostStatus,
  BannerPlacement,
} from "@prisma/client";

export type StatusTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger";

export const orderStatusTones: Record<OrderStatus, StatusTone> = {
  PENDING: "warning",
  CONFIRMED: "success",
  PROCESSING: "info",
  SHIPPED: "info",
  DELIVERED: "success",
  CANCELLED: "danger",
  RETURNED: "danger",
};

export const paymentStatusTones: Record<PaymentStatus, StatusTone> = {
  PENDING: "warning",
  PAID: "success",
  FAILED: "danger",
  REFUNDED: "neutral",
  CANCELLED: "danger",
};

export const userStatusLabels: Record<UserStatus, string> = {
  ACTIVE: "فعال",
  BLOCKED: "مسدود",
  DELETED: "حذف‌شده",
};

export const userStatusTones: Record<UserStatus, StatusTone> = {
  ACTIVE: "success",
  BLOCKED: "danger",
  DELETED: "neutral",
};

export const userRoleLabels: Record<UserRole, string> = {
  CUSTOMER: "مشتری",
  ADMIN: "مدیر کل",
  STAFF: "کارشناس پشتیبانی",
};

export const categoryStatusLabels: Record<CategoryStatus, string> = {
  ACTIVE: "فعال",
  INACTIVE: "غیرفعال",
};

export const categoryStatusTones: Record<CategoryStatus, StatusTone> = {
  ACTIVE: "success",
  INACTIVE: "neutral",
};

// ── Products (Phase 14, Part 1) ────────────────────────────────────────
// Built strictly on the ProductStatus schema enum.

export const productStatusLabels: Record<ProductStatus, string> = {
  DRAFT: "پیشنویس",
  ACTIVE: "فعال",
  ARCHIVED: "آرشیو شده",
};

export const productStatusTones: Record<ProductStatus, StatusTone> = {
  DRAFT: "neutral",
  ACTIVE: "success",
  ARCHIVED: "warning",
};

// ── Reviews & Q&A (Phase 14, Part 2) ───────────────────────────────────

export const reviewStatusLabels: Record<ReviewStatus, string> = {
  PENDING: "در انتظار بررسی",
  APPROVED: "تأیید شده",
  REJECTED: "رد شده",
};

export const reviewStatusTones: Record<ReviewStatus, StatusTone> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
};

export const questionStatusLabels: Record<QuestionStatus, string> = {
  PENDING: "در انتظار پاسخ",
  ANSWERED: "پاسخ داده شده",
  CLOSED: "بسته شده",
};

export const questionStatusTones: Record<QuestionStatus, StatusTone> = {
  PENDING: "warning",
  ANSWERED: "success",
  CLOSED: "neutral",
};

// ── Discounts (Phase 14, Part 2) ───────────────────────────────────────
// Admin list derives a display status from isActive + the validity window.

export type DiscountDisplayStatus = "ACTIVE" | "SCHEDULED" | "EXPIRED" | "INACTIVE";

export const discountStatusLabels: Record<DiscountDisplayStatus, string> = {
  ACTIVE: "فعال",
  SCHEDULED: "زمان‌بندی‌شده",
  EXPIRED: "منقضی",
  INACTIVE: "غیرفعال",
};

export const discountStatusTones: Record<DiscountDisplayStatus, StatusTone> = {
  ACTIVE: "success",
  SCHEDULED: "info",
  EXPIRED: "warning",
  INACTIVE: "neutral",
};

// Discount snapshots store the type as a plain string on Order — the
// label map stays total over the enum and falls back safely.
export const discountTypeLabels: Record<DiscountType, string> = {
  PERCENTAGE: "درصدی",
  FIXED_AMOUNT: "مبلغ ثابت",
  FREE_SHIPPING: "ارسال رایگان",
};

export function discountTypeLabel(type: string | null | undefined): string | null {
  if (!type) return null;
  return (discountTypeLabels as Record<string, string>)[type] ?? null;
}

// ── Blog (Phase 15) ─────────────────────────────────────────────────────
// Built strictly on the PostStatus schema enum.

export const postStatusLabels: Record<PostStatus, string> = {
  DRAFT: "پیش‌نویس",
  PUBLISHED: "منتشر شده",
  ARCHIVED: "بایگانی شده",
};

export const postStatusTones: Record<PostStatus, StatusTone> = {
  DRAFT: "neutral",
  PUBLISHED: "success",
  ARCHIVED: "warning",
};

// ── Homepage marketing (Phase 16) ───────────────────────────────────────
// Banner placement is the real schema enum; active/inactive reuse the
// existing CategoryStatus label vocabulary (no invented states).

export const bannerPlacementLabels: Record<BannerPlacement, string> = {
  HERO: "هیرو صفحه اصلی",
  PROMO: "بنر تبلیغاتی",
};
