"use client";

import * as React from "react";
import { useActionState } from "react";
import {
  createBannerAction,
  updateBannerAction,
  type BannerActionState,
} from "@/app/actions/banners";
import {
  BANNER_TITLE_MAX,
  BANNER_DESCRIPTION_MAX,
  BANNER_LINK_LABEL_MAX,
  BANNER_LINK_HREF_MAX,
  BANNER_IMAGE_URL_MAX,
} from "@/lib/marketing/banner-rules";
import type { AdminBannerDetail } from "@/lib/marketing/banner-service";
import { Input } from "@/components/ui/input";
import {
  AdminField,
  AdminFieldError,
  AdminFormFeedback,
  AdminFormSection,
  AdminSubmitButton,
  adminSelectClass,
  adminTextareaClass,
} from "@/components/admin/admin-form";

// BannerForm — create/edit for one hero or promo banner. Server-side
// validation is authoritative (validateBannerInput in the service); the
// HTML constraints here are UX only. Placement drives which CTA fields are
// relevant (the secondary CTA is hero-only).

export type BannerDraft = {
  placement: string;
  title: string;
  description: string;
  imageUrl: string;
  primaryLinkLabel: string;
  primaryLinkHref: string;
  secondaryLinkLabel: string;
  secondaryLinkHref: string;
  isActive: boolean;
  sortOrder: string;
};

export const emptyBannerDraft: BannerDraft = {
  placement: "PROMO",
  title: "",
  description: "",
  imageUrl: "",
  primaryLinkLabel: "",
  primaryLinkHref: "",
  secondaryLinkLabel: "",
  secondaryLinkHref: "",
  isActive: true,
  sortOrder: "0",
};

export function draftFromBanner(banner: AdminBannerDetail): BannerDraft {
  return {
    placement: banner.placement,
    title: banner.title,
    description: banner.description ?? "",
    imageUrl: banner.imageUrl ?? "",
    primaryLinkLabel: banner.primaryLinkLabel ?? "",
    primaryLinkHref: banner.primaryLinkHref ?? "",
    secondaryLinkLabel: banner.secondaryLinkLabel ?? "",
    secondaryLinkHref: banner.secondaryLinkHref ?? "",
    isActive: banner.isActive,
    sortOrder: String(banner.sortOrder),
  };
}

export function BannerForm({
  mode,
  bannerId,
  draft: initialDraft,
}: {
  mode: "create" | "edit";
  bannerId?: string;
  draft: BannerDraft;
}) {
  const isEdit = mode === "edit";
  const [state, action, pending] = useActionState<BannerActionState, FormData>(
    isEdit ? updateBannerAction : createBannerAction,
    {}
  );
  const [placement, setPlacement] = React.useState(initialDraft.placement);
  const isHero = placement === "HERO";

  return (
    <form action={action} className="space-y-6">
      {isEdit && <input type="hidden" name="bannerId" value={bannerId} />}

      <AdminFormSection title="محل نمایش و محتوا">
        <div className="grid gap-4 sm:grid-cols-2">
          <AdminField id="b-placement" label="محل نمایش" error={state.fieldErrors?.placement}>
            <select
              id="b-placement"
              name="placement"
              className={adminSelectClass}
              value={placement}
              onChange={(e) => setPlacement(e.target.value)}
            >
              <option value="PROMO">بنر تبلیغاتی (صفحه اصلی)</option>
              <option value="HERO">هیرو صفحه اصلی</option>
            </select>
          </AdminField>
          <AdminField
            id="b-order"
            label="ترتیب نمایش"
            hint="(عدد کوچک‌تر = زودتر)"
            error={state.fieldErrors?.sortOrder}
          >
            <Input
              id="b-order"
              name="sortOrder"
              dir="ltr"
              className="text-start"
              inputMode="numeric"
              defaultValue={initialDraft.sortOrder}
            />
          </AdminField>
        </div>

        <div className="mt-4">
          <AdminField id="b-title" label="عنوان" error={state.fieldErrors?.title}>
            <Input
              id="b-title"
              name="title"
              maxLength={BANNER_TITLE_MAX}
              defaultValue={initialDraft.title}
              placeholder={isHero ? "عنوان اصلی هیرو" : "عنوان بنر تبلیغاتی"}
              required
            />
          </AdminField>
        </div>

        <div className="mt-4">
          <AdminField
            id="b-desc"
            label="متن توضیحی"
            hint="(اختیاری)"
            error={state.fieldErrors?.description}
          >
            <textarea
              id="b-desc"
              name="description"
              rows={3}
              maxLength={BANNER_DESCRIPTION_MAX}
              defaultValue={initialDraft.description}
              className={adminTextareaClass}
            />
          </AdminField>
        </div>

        <div className="mt-4">
          <AdminField
            id="b-image"
            label="آدرس تصویر"
            hint="(اختیاری — http(s) یا مسیر داخلی؛ خالی = تصویر برند)"
            error={state.fieldErrors?.imageUrl}
          >
            <Input
              id="b-image"
              name="imageUrl"
              dir="ltr"
              className="text-start"
              maxLength={BANNER_IMAGE_URL_MAX}
              defaultValue={initialDraft.imageUrl}
              placeholder="https://example.com/banner.jpg"
            />
          </AdminField>
        </div>
      </AdminFormSection>

      <AdminFormSection
        title="لینک اصلی"
        description={isHero ? "دکمه اصلی هیرو (در صورت خالی بودن، پیش‌فرض «مشاهده محصولات» نشان داده می‌شود)." : "لینک قابل کلیک بنر (اختیاری)."}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <AdminField
            id="b-primary-label"
            label="برچسب لینک اصلی"
            error={state.fieldErrors?.primaryLinkLabel}
          >
            <Input
              id="b-primary-label"
              name="primaryLinkLabel"
              maxLength={BANNER_LINK_LABEL_MAX}
              defaultValue={initialDraft.primaryLinkLabel}
              placeholder="مشاهده محصولات"
            />
          </AdminField>
          <AdminField
            id="b-primary-href"
            label="نشانی لینک اصلی"
            error={state.fieldErrors?.primaryLinkHref}
          >
            <Input
              id="b-primary-href"
              name="primaryLinkHref"
              dir="ltr"
              className="text-start"
              maxLength={BANNER_LINK_HREF_MAX}
              defaultValue={initialDraft.primaryLinkHref}
              placeholder="/products"
            />
          </AdminField>
        </div>

        {isHero && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <AdminField
              id="b-secondary-label"
              label="برچسب لینک دوم"
              hint="(اختیاری — فقط هیرو)"
              error={state.fieldErrors?.secondaryLinkLabel}
            >
              <Input
                id="b-secondary-label"
                name="secondaryLinkLabel"
                maxLength={BANNER_LINK_LABEL_MAX}
                defaultValue={initialDraft.secondaryLinkLabel}
                placeholder="مطالعه مقالات تخصصی"
              />
            </AdminField>
            <AdminField
              id="b-secondary-href"
              label="نشانی لینک دوم"
              hint="(اختیاری — فقط هیرو)"
              error={state.fieldErrors?.secondaryLinkHref}
            >
              <Input
                id="b-secondary-href"
                name="secondaryLinkHref"
                dir="ltr"
                className="text-start"
                maxLength={BANNER_LINK_HREF_MAX}
                defaultValue={initialDraft.secondaryLinkHref}
                placeholder="/blog"
              />
            </AdminField>
          </div>
        )}
      </AdminFormSection>

      <AdminFormSection title="وضعیت">
        <label className="flex h-10 items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="isActive"
            value="true"
            defaultChecked={initialDraft.isActive}
            className="size-4 accent-[var(--reyhan-blue-600)]"
          />
          بنر فعال باشد
          {isHero && (
            <span className="text-xs text-muted-foreground">
              (فقط یک هیرو فعال در صفحه نمایش داده می‌شود)
            </span>
          )}
        </label>
        <AdminFieldError message={state.fieldErrors?.isActive} />
      </AdminFormSection>

      <AdminFormFeedback message={state.message} error={state.error} />

      <AdminSubmitButton pending={pending}>
        {pending ? "در حال ذخیره..." : isEdit ? "ذخیره تغییرات" : "ثبت بنر"}
      </AdminSubmitButton>
    </form>
  );
}
