// Metadata builders — Phase 17 SEO foundation.
//
// Small, typed helpers that assemble Next.js `Metadata` fragments for public
// indexable pages. Centralizing them keeps the title/description/canonical/
// Open Graph strategy in one place so page files stay declarative and the
// rules below are applied consistently everywhere:
//
//   title    — page-specific value; the root layout template appends the
//              brand, so builders NEVER add the brand suffix themselves
//              (avoids nested duplicate brand names / suffix stuffing).
//   description — normalized (whitespace-collapsed, capped) real content.
//   canonical — absolute, deterministic, no query/fragment, via seo/site.
//   Open Graph — real title/description/image/url per content type; images
//              are resolved to absolute URLs and omitted when absent.
//
// Pure and framework-free except for the `Metadata` type import (type-only),
// so these are unit-testable in a bare `node --test` process.

import type { Metadata } from "next";
import { SITE_NAME } from "../constants.ts";
import { canonicalUrl, absoluteMediaUrl } from "./site.ts";

const DESCRIPTION_MAX = 200;

/** Collapse whitespace, strip control chars, cap length at a sensible size. */
export function normalizeDescription(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const collapsed = value
    .replace(/\s+/g, " ")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim();
  if (!collapsed) return undefined;
  return collapsed.length > DESCRIPTION_MAX
    ? `${collapsed.slice(0, DESCRIPTION_MAX - 1).trimEnd()}…`
    : collapsed;
}

/**
 * Title for a content page. The root layout's `title.template`
 * (`%s | ریحان`) appends the brand, so this returns the bare page title.
 * Falls back to the brand only for the homepage.
 */
export function pageTitle(title: string | null | undefined): string | undefined {
  const trimmed = title?.trim();
  return trimmed ? trimmed : undefined;
}

export type BuildMetadataInput = {
  title?: string;
  description?: string | null;
  /** Canonical path (without origin); always rendered as an absolute URL. */
  path: string;
  /** OG image candidates; the first resolvable absolute URL wins. */
  images?: { url: string; alt?: string | null }[];
  /** Open Graph content type. */
  type?: "website" | "article";
  publishedTime?: string;
  modifiedTime?: string;
  authors?: string[];
  /** When true the page is not indexed (private/utility routes). */
  noindex?: boolean;
  /**
   * Additional arbitrary `other` metadata entries (e.g. OG product price
   * tags), forwarded verbatim. Kept opt-in so only real values are emitted.
   */
  other?: Record<string, string>;
};

/** Assemble a `Metadata` object for a public (or explicitly private) page. */
export function buildMetadata(input: BuildMetadataInput): Metadata {
  const canonical = canonicalUrl(input.path);
  const image = (input.images ?? [])
    .map((item) => ({ url: absoluteMediaUrl(item.url), alt: item.alt ?? undefined }))
    .filter((item): item is { url: string; alt: string | undefined } => item.url !== null);
  const firstImage = image[0];

  return {
    title: pageTitle(input.title),
    description: normalizeDescription(input.description),
    alternates: { canonical },
    openGraph: {
      type: input.type ?? "website",
      siteName: SITE_NAME,
      title: input.title?.trim() || SITE_NAME,
      description: normalizeDescription(input.description),
      url: canonical,
      locale: "fa_IR",
      images: firstImage ? image : undefined,
      ...(input.type === "article"
        ? {
            publishedTime: input.publishedTime,
            modifiedTime: input.modifiedTime,
            authors: input.authors,
          }
        : {}),
    },
    twitter: {
      card: firstImage ? "summary_large_image" : "summary",
      title: input.title?.trim() || SITE_NAME,
      description: normalizeDescription(input.description),
      images: firstImage ? [firstImage.url] : undefined,
    },
    ...(input.noindex ? { robots: { index: false, follow: false } } : {}),
    ...(input.other ? { other: input.other } : {}),
  };
}

/**
 * Metadata for a page that must never be indexed (account, checkout, admin,
 * auth, payment result, 404). Keeps the title usable in a browser tab while
 * telling crawlers to stay away.
 */
export function buildPrivateMetadata(title: string, description?: string): Metadata {
  return {
    title,
    description: normalizeDescription(description),
    robots: { index: false, follow: false },
  };
}
