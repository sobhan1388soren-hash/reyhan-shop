// Admin filter option lists — derived from the REAL schema enums only.
// Values are the exact Prisma enum strings, so any option submitted by a
// client passes parseEnumFilter and maps to a legal where-clause value.

import type {
  OrderStatus,
  PaymentStatus,
  UserRole,
  UserStatus,
  ProductStatus,
  ReviewStatus,
  QuestionStatus,
  PostStatus,
  BannerPlacement,
} from "@prisma/client";
import {
  orderStatusLabels,
  paymentStatusLabels,
} from "../auth/labels.ts";
import {
  userStatusLabels,
  userRoleLabels,
  productStatusLabels,
  reviewStatusLabels,
  questionStatusLabels,
  discountTypeLabels,
  discountStatusLabels,
  postStatusLabels,
  bannerPlacementLabels,
  type DiscountDisplayStatus,
} from "./labels.ts";
import { PRODUCT_STATUSES } from "./product-rules.ts";
import { POST_STATUSES } from "../blog/post-rules.ts";

export const ADMIN_STATUS_OPTIONS: { value: OrderStatus; label: string }[] = (
  Object.keys(orderStatusLabels) as OrderStatus[]
).map((value) => ({ value, label: orderStatusLabels[value] }));

export const ADMIN_PAYMENT_STATUS_OPTIONS: { value: PaymentStatus; label: string }[] = (
  Object.keys(paymentStatusLabels) as PaymentStatus[]
).map((value) => ({ value, label: paymentStatusLabels[value] }));

export const ADMIN_USER_ROLE_OPTIONS: { value: UserRole; label: string }[] = (
  Object.keys(userRoleLabels) as UserRole[]
).map((value) => ({ value, label: userRoleLabels[value] }));

export const ADMIN_USER_STATUS_OPTIONS: { value: UserStatus; label: string }[] = (
  Object.keys(userStatusLabels) as UserStatus[]
).map((value) => ({ value, label: userStatusLabels[value] }));

// Product status options are sourced from the pure rules' allow-list so a
// client-submitted value can only ever be a real schema enum string.
export const ADMIN_PRODUCT_STATUS_OPTIONS: { value: ProductStatus; label: string }[] =
  PRODUCT_STATUSES.map((value) => ({ value, label: productStatusLabels[value] }));

export const ADMIN_PRODUCT_SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "updated_desc", label: "آخرین به‌روزرسانی" },
  { value: "created_desc", label: "جدیدترین" },
  { value: "created_asc", label: "قدیمی‌ترین" },
  { value: "title_asc", label: "نام (الف → ی)" },
  { value: "title_desc", label: "نام (ی → الف)" },
];

export const ADMIN_REVIEW_STATUS_OPTIONS: { value: ReviewStatus; label: string }[] = (
  Object.keys(reviewStatusLabels) as ReviewStatus[]
).map((value) => ({ value, label: reviewStatusLabels[value] }));

export const ADMIN_QUESTION_STATUS_OPTIONS: { value: QuestionStatus; label: string }[] = (
  Object.keys(questionStatusLabels) as QuestionStatus[]
).map((value) => ({ value, label: questionStatusLabels[value] }));

export const ADMIN_DISCOUNT_TYPE_OPTIONS: { value: string; label: string }[] = (
  Object.keys(discountTypeLabels) as (keyof typeof discountTypeLabels)[]
).map((value) => ({ value, label: discountTypeLabels[value] }));

export const ADMIN_DISCOUNT_STATUS_OPTIONS: { value: DiscountDisplayStatus; label: string }[] = (
  Object.keys(discountStatusLabels) as DiscountDisplayStatus[]
).map((value) => ({ value, label: discountStatusLabels[value] }));

// Blog post status options (Phase 15) — sourced from the pure rules'
// allow-list so a client-submitted value can only ever be a real schema enum.
export const ADMIN_POST_STATUS_OPTIONS: { value: PostStatus; label: string }[] =
  POST_STATUSES.map((value) => ({ value, label: postStatusLabels[value] }));

// Banner placement options (Phase 16) — the exact Prisma enum values, so a
// client-submitted placement can only ever be a legal value.
export const ADMIN_BANNER_PLACEMENT_OPTIONS: { value: BannerPlacement; label: string }[] = (
  Object.keys(bannerPlacementLabels) as BannerPlacement[]
).map((value) => ({ value, label: bannerPlacementLabels[value] }));
