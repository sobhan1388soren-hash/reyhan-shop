import supabase from "@/lib/supabase";
import type { HeroContentView, PromoBannerView } from "./banner-rules";

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  if (!supabase) return fallback;
  try {
    return await fn();
  } catch (e) {
    console.error("[banner.supabase] query failed; returning fallback:", e);
    return fallback;
  }
}

const HERO_DEFAULTS: HeroContentView = {
  title: "فروشگاه ریحان",
  description: "بهترین محصولات با کیفیت بالا",
  imageUrl: null,
  primaryLinkHref: "/products",
  primaryLinkLabel: "مشاهده محصولات",
  secondaryLinkHref: null,
  secondaryLinkLabel: null,
};

export async function getHeroContent(): Promise<HeroContentView> {
  return safe(async () => {
    if (!supabase) return HERO_DEFAULTS;
    const { data, error } = await supabase
      .from("banners")
      .select("*")
      .eq("placement", "HERO")
      .eq("isActive", true)
      .order("sortOrder", { ascending: true })
      .limit(1)
      .single();

    if (error || !data) return HERO_DEFAULTS;

    const banner = data as {
      title: string;
      description?: string;
      imageUrl?: string;
      primaryLinkHref?: string;
      primaryLinkLabel?: string;
      secondaryLinkHref?: string;
      secondaryLinkLabel?: string;
    };

    const secondaryHref = banner.secondaryLinkHref?.trim();
    const secondaryLabel = banner.secondaryLinkLabel?.trim();

    return {
      title: banner.title.trim() || HERO_DEFAULTS.title,
      description: banner.description?.trim() || HERO_DEFAULTS.description,
      imageUrl: banner.imageUrl ?? null,
      primaryLinkHref: banner.primaryLinkHref?.trim() || HERO_DEFAULTS.primaryLinkHref,
      primaryLinkLabel: banner.primaryLinkLabel?.trim() || HERO_DEFAULTS.primaryLinkLabel,
      secondaryLinkHref: secondaryHref && secondaryLabel ? secondaryHref : null,
      secondaryLinkLabel: secondaryHref && secondaryLabel ? secondaryLabel : null,
    };
  }, HERO_DEFAULTS);
}

export async function getActivePromoBanners(): Promise<PromoBannerView[]> {
  return safe(async () => {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from("banners")
      .select("*")
      .eq("placement", "PROMO")
      .eq("isActive", true)
      .order("sortOrder", { ascending: true });

    if (error || !data) return [];

    return (data as Array<{
      id: string;
      title: string;
      description?: string;
      imageUrl?: string;
      primaryLinkHref?: string;
      primaryLinkLabel?: string;
    }>).map((b) => ({
      id: b.id,
      title: b.title,
      description: b.description ?? null,
      imageUrl: b.imageUrl ?? null,
      linkHref: b.primaryLinkHref?.trim() || null,
      linkLabel: b.primaryLinkLabel?.trim() || null,
    }));
  }, []);
}