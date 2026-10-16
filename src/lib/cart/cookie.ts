import { cookies } from "next/headers";
import type { StoredCartEntry } from "./types";
import {
  CART_COOKIE,
  CART_TTL_SECONDS,
  decodeCartCookieValue,
  encodeCartCookieValue,
} from "./storage";

export const CART_COOKIE_MAX_AGE = CART_TTL_SECONDS;

export async function readCartEntriesFromCookie(): Promise<StoredCartEntry[]> {
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get(CART_COOKIE)?.value;
    return decodeCartCookieValue(raw);
  } catch {
    return [];
  }
}

export async function writeCartEntriesToCookie(
  _entries: StoredCartEntry[]
): Promise<void> {
  // This is a no-op server-side. Client writes via document.cookie.
  // Kept for symmetry and potential future server-side cart operations.
  void _entries;
}

export function buildCartCookieHeader(
  entries: StoredCartEntry[],
  maxAge: number = CART_COOKIE_MAX_AGE,
  options: { secure?: boolean } = {}
): string {
  const secure = options.secure ?? process.env.NODE_ENV === "production";
  if (entries.length === 0) {
    return `${CART_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure ? "; Secure" : ""}`;
  }
  const encoded = encodeCartCookieValue(entries);
  if (encoded === null) {
    // Fail safely: never emit an oversized cookie.
    return `${CART_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure ? "; Secure" : ""}`;
  }
  return `${CART_COOKIE}=${encoded}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure ? "; Secure" : ""}`;
}
