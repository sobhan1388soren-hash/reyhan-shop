// MediaPlaceholder — the shared visual placeholder for the image areas of the
// storefront cards and homepage sections. It lets the layout be reviewed and
// styled before real imagery exists, and it is built to be replaced: every
// consumer renders it at exactly the `imageUrl ? <img/> : <MediaPlaceholder/>`
// boundary, so setting a real image URL swaps it out with no other changes.
//
// Deliberately minimal and honest — a soft brand-token surface that fills the
// fixed-aspect container owned by the consumer (no layout shift). It never
// depicts product photography, logos, certifications or marketing claims; the
// glyph is a generic image/water affordance and the optional label always
// comes from real record data (a category name, never invented copy).
// The surface is decorative, so it is hidden from assistive technology.

import { cn } from "@/lib/utils";

export type MediaPlaceholderTone =
  | "blue"
  | "green"
  | "mixed"
  | "band"
  | "neutral";

export type MediaPlaceholderGlyph = "image" | "drop" | "none";

const TONE_CLASS: Record<MediaPlaceholderTone, string> = {
  blue: "bg-gradient-to-br from-[var(--reyhan-blue-50)] to-[var(--reyhan-blue-100)]",
  green:
    "bg-gradient-to-br from-[var(--reyhan-green-50)] to-[var(--reyhan-green-100)]",
  mixed:
    "bg-gradient-to-br from-[var(--reyhan-blue-50)] via-white to-[var(--reyhan-green-50)]",
  band: "bg-gradient-to-l from-[var(--reyhan-blue-50)] via-white to-[var(--reyhan-green-50)]",
  neutral: "bg-muted",
};

function PlaceholderGlyph({
  glyph,
  className,
}: {
  glyph: Exclude<MediaPlaceholderGlyph, "none">;
  className?: string;
}) {
  if (glyph === "drop") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
        <path
          d="M12 3.4C12 3.4 6.6 8.7 6.6 12.7C6.6 16.1 9 18.6 12 18.6C15 18.6 17.4 16.1 17.4 12.7C17.4 8.7 12 3.4 12 3.4Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M9.6 13.3c.9 1.1 2.1 1.7 3.4 1.7"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          opacity=".7"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <rect
        x="3.25"
        y="4.75"
        width="17.5"
        height="14.5"
        rx="2.25"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="8.6" cy="9.6" r="1.4" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M3.9 16.9l4.4-4.4 3.4 3.4 3-3 5.4 5.4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MediaPlaceholder({
  tone = "blue",
  glyph = "image",
  label,
  className,
}: {
  tone?: MediaPlaceholderTone;
  glyph?: MediaPlaceholderGlyph;
  label?: string | null;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex h-full w-full items-center justify-center",
        TONE_CLASS[tone],
        className,
      )}
    >
      {glyph !== "none" || label ? (
        <div className="flex flex-col items-center px-4">
          {glyph !== "none" && (
            <span
              className={cn(
                "flex size-10 items-center justify-center rounded-xl bg-white/75 shadow-sm backdrop-blur-sm",
                tone === "green"
                  ? "text-[var(--reyhan-green-600)]"
                  : "text-[var(--reyhan-blue-600)]",
              )}
            >
              <PlaceholderGlyph glyph={glyph} className="size-5" />
            </span>
          )}
          {label ? (
            <span className="mt-2 max-w-full text-center text-xs font-medium text-muted-foreground line-clamp-1">
              {label}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
