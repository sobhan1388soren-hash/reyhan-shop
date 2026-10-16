import type { AdminBannerDetail } from "@/lib/marketing/banner-service";

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
