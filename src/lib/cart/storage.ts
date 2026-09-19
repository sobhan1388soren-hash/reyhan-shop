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

function isPositiveFiniteInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
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
  return sanitizeEntries(readRaw());
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
  if (!raw) return emptyEntries;
  try {
    return sanitizeEntries(JSON.parse(raw));
  } catch {
    return emptyEntries;
  }
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

export function writeStoredEntries(entries: StoredCartEntry[]): boolean {
  if (typeof window === "undefined") return false;
  try {
    const clean = entries.slice(0, MAX_ENTRIES);
    if (clean.length === 0) {
      window.localStorage.removeItem(VERSIONED_KEY);
    } else {
      window.localStorage.setItem(VERSIONED_KEY, JSON.stringify(clean));
    }
    window.dispatchEvent(new Event(CART_CHANGE_EVENT));
    return true;
  } catch {
    return false; // storage unavailable (private mode) — stays in-memory only
  }
}
