// Guest cart persistence — hardened localStorage layer.
// Malformed, outdated, or hostile data is dropped silently; the cart never
// crashes the page. Prices are only UX snapshots — never trusted by the server.

import type { StoredCartEntry } from "./types";

export const CART_STORAGE_KEY = "reyhan-cart";
export const CART_CHANGE_EVENT = "reyhan-cart-change";
/** Bump when the persisted shape changes so stale data is discarded. */
const CART_SCHEMA_VERSION = 2;
const VERSIONED_KEY = `${CART_STORAGE_KEY}:v${CART_SCHEMA_VERSION}`;
/** Safety ceiling — a guest cart larger than this is trimmed. */
const MAX_ENTRIES = 50;
const MAX_QUANTITY = 999;

/**
 * Shared cart lifetime — one TTL for both the localStorage cart and the
 * cookie mirror so the two stores never drift apart. 7 days is a staleness
 * bound; active carts keep being re-written on every mutation, so only
 * abandoned carts expire. Documented TTL: CART_TTL_SECONDS.
 */
export const CART_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

/** Conservative cap for the encoded cookie value (~3.5KB, below the ~4KB browser limit). */
export const MAX_COOKIE_VALUE_BYTES = 3584;

function isPositiveFiniteInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

/** Raw persisted shape: versioned envelope with an explicit timestamp. */
type StoredCartEnvelope = { v: number; savedAt: number; entries: unknown };

function isCartEnvelope(value: unknown): value is StoredCartEnvelope {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as Record<string, unknown>).v === "number" &&
    typeof (value as Record<string, unknown>).savedAt === "number" &&
    "entries" in (value as Record<string, unknown>)
  );
}

/**
 * Parse a raw localStorage payload into sanitized entries.
 * Accepts the current {v, savedAt, entries} envelope and the legacy bare
 * array (migrated on the next write). Unknown versions, stale or future
 * timestamps, and malformed data all degrade to [] — never throw.
 */
export function parseStoredPayload(raw: string | null, now: number = Date.now()): StoredCartEntry[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (Array.isArray(parsed)) {
    // Legacy v2 payload without a timestamp — accept once, re-stamped on write.
    return sanitizeEntries(parsed);
  }
  if (isCartEnvelope(parsed)) {
    if (parsed.v !== CART_SCHEMA_VERSION) return [];
    if (!Number.isFinite(parsed.savedAt) || parsed.savedAt <= 0) return [];
    if (parsed.savedAt > now + 5 * 60 * 1000) return [];
    if (now - parsed.savedAt > CART_TTL_SECONDS * 1000) return [];
    return sanitizeEntries(parsed.entries);
  }
  return [];
}

function sanitizeEntry(value: unknown): StoredCartEntry | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  const variantId = typeof v.variantId === "string" ? v.variantId.trim() : "";
  if (!variantId || variantId.length > 128) return null;
  if (!isPositiveFiniteInt(v.quantity)) return null;
  const entry: StoredCartEntry = {
    variantId,
    quantity: Math.min(v.quantity, MAX_QUANTITY),
  };
  if (typeof v.priceSnapshot === "number" && Number.isFinite(v.priceSnapshot) && v.priceSnapshot >= 0) {
    entry.priceSnapshot = Math.round(v.priceSnapshot);
  }
  if (typeof v.addedAt === "number" && Number.isFinite(v.addedAt) && v.addedAt > 0) {
    entry.addedAt = Math.min(v.addedAt, Date.now() + 5 * 60 * 1000);
  }
  return entry;
}

/** Parse arbitrary unknown data into a clean entry list; hostile input yields []. */
export function sanitizeEntries(value: unknown): StoredCartEntry[] {
  if (!Array.isArray(value)) return [];
  const out: StoredCartEntry[] = [];
  const seen = new Set<string>();
  for (const raw of value.slice(0, MAX_ENTRIES)) {
    const entry = sanitizeEntry(raw);
    if (!entry) continue;
    if (seen.has(entry.variantId)) continue; // merge handled by write layer
    seen.add(entry.variantId);
    out.push(entry);
  }
  return out;
}

/** Validate a variantId+quantity payload coming back from UI components. */
export function isValidMutation(variantId: unknown, quantity: unknown): boolean {
  return (
    typeof variantId === "string" &&
    variantId.trim().length > 0 &&
    variantId.length <= 128 &&
    isPositiveFiniteInt(quantity) &&
    quantity <= MAX_QUANTITY
  );
}

export function readStoredEntries(): StoredCartEntry[] {
  return parseStoredPayload(readRaw());
}

// ── Cached snapshot for useSyncExternalStore ──────────────────────────────
// getSnapshot must return a referentially stable value between changes;
// parsing on every call would create a new array each render and loop React.

const emptyEntries: StoredCartEntry[] = [];
let snapshotCache: { raw: string | null; entries: StoredCartEntry[] } | null = null;

function readRaw(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(VERSIONED_KEY);
  } catch {
    return null;
  }
}

function parseRaw(raw: string | null): StoredCartEntry[] {
  return parseStoredPayload(raw);
}

/** Referentially-stable snapshot keyed by the raw storage string. */
export function getStoredEntriesSnapshot(): StoredCartEntry[] {
  if (typeof window === "undefined") return emptyEntries;
  const raw = readRaw();
  if (snapshotCache && snapshotCache.raw === raw) return snapshotCache.entries;
  const entries = parseRaw(raw);
  snapshotCache = { raw, entries };
  return entries;
}

export const CART_COOKIE = "reyhan-cart";

/** Cookie mirror carries only what the server snapshot needs to identify rows. */
type CookieCartEntry = { variantId: string; quantity: number };

export function toCookieEntries(entries: StoredCartEntry[]): CookieCartEntry[] {
  return entries
    .slice(0, MAX_ENTRIES)
    .map((e) => ({ variantId: e.variantId, quantity: e.quantity }));
}

/**
 * Encode the minimal cookie payload; returns null when it would exceed the
 * conservative byte budget. Never throws — hostile input yields a safe
 * payload or null.
 */
export function encodeCartCookieValue(entries: StoredCartEntry[]): string | null {
  const payload = toCookieEntries(entries);
  if (payload.length === 0) return null;
  const encoded = encodeURIComponent(JSON.stringify(payload));
  const bytes =
    typeof TextEncoder !== "undefined"
      ? new TextEncoder().encode(encoded).length
      : encoded.length;
  return bytes <= MAX_COOKIE_VALUE_BYTES ? encoded : null;
}

/** Safe inverse of encodeCartCookieValue; malformed data yields []. */
export function decodeCartCookieValue(raw: string | null | undefined): StoredCartEntry[] {
  if (!raw) return [];
  try {
    return sanitizeEntries(JSON.parse(decodeURIComponent(raw)));
  } catch {
    return [];
  }
}

/**
 * Secure cookies only over HTTPS (explicit, environment-driven — there is
 * no `secure` attribute on plain-HTTP localhost, where it would be rejected
 * by the browser).
 */
export function shouldUseSecureCookie(protocol: string): boolean {
  return protocol === "https:";
}

export function serializeCartCookie(
  entries: StoredCartEntry[],
  options: { maxAge?: number; secure?: boolean } = {}
): string | null {
  const value = encodeCartCookieValue(entries);
  if (value === null) return null;
  const parts = [
    `${CART_COOKIE}=${value}`,
    "Path=/",
    `Max-Age=${options.maxAge ?? CART_TTL_SECONDS}`,
    "SameSite=Lax",
  ];
  if (options.secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearCartCookie(options: { secure?: boolean } = {}): string {
  const parts = [`${CART_COOKIE}=`, "Path=/", "Max-Age=0", "SameSite=Lax"];
  if (options.secure) parts.push("Secure");
  return parts.join("; ");
}

export function writeStoredEntries(entries: StoredCartEntry[]): boolean {
  if (typeof window === "undefined") return false;
  try {
    const clean = entries.slice(0, MAX_ENTRIES);
    if (clean.length === 0) {
      window.localStorage.removeItem(VERSIONED_KEY);
    } else {
      const envelope = {
        v: CART_SCHEMA_VERSION,
        savedAt: Date.now(),
        entries: clean,
      };
      window.localStorage.setItem(VERSIONED_KEY, JSON.stringify(envelope));
    }
    window.dispatchEvent(new Event(CART_CHANGE_EVENT));

    // Sync the minimal cookie mirror for server-side checkout page access.
    // The encoded payload is size-checked; on overflow we clear the mirror
    // rather than write an oversized cookie or throw (localStorage remains
    // the source of truth and the cart simply renders with a server-empty
    // initial snapshot, corrected by the client-side re-validation).
    const secure = shouldUseSecureCookie(window.location?.protocol ?? "");
    if (clean.length === 0) {
      document.cookie = clearCartCookie({ secure });
    } else {
      const serialized = serializeCartCookie(clean, { secure });
      document.cookie = serialized ?? clearCartCookie({ secure });
    }
    return true;
  } catch {
    return false; // storage unavailable (private mode) — stays in-memory only
  }
}
