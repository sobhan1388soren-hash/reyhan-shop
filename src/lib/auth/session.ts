// Session management — HMAC-SHA256 signed cookie, server-only.
// Payload contains only the minimal user identity (id, role, phone-verified flag).
// No PII beyond the minimum; signature prevents tampering.

import "server-only";
import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { resolveSessionSecret } from "./guards.ts";

const SESSION_COOKIE = "reyhan-session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export type SessionPayload = {
  userId: string;
  role: string;
  createdAt: number;
  expiresAt: number;
};

function getSecret(): string {
  // Decision logic lives in the pure, unit-tested ./guards module.
  const resolved = resolveSessionSecret(process.env);
  if (!resolved.ok) {
    // Fail closed in production: without a strong secret anyone holding the
    // (public, in-repo) dev fallback could forge valid sessions, including
    // admin ones. Set SESSION_SECRET (>= 32 chars) — see .env.example.
    throw new Error(resolved.error);
  }
  return resolved.secret;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(data: string): string {
  return createHmac("sha256", getSecret()).update(data).digest("base64url");
}

export function serializeSession(payload: SessionPayload): string {
  const body = base64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

export function parseSession(token: string | undefined | null): SessionPayload | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const signature = token.slice(dot + 1);

  let expected: string;
  try {
    expected = sign(body);
  } catch {
    // Missing/invalid secret in production → deny every session (fail
    // closed) instead of crashing the caller (e.g. proxy middleware).
    return null;
  }
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf-8"));
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof parsed.userId !== "string" ||
      typeof parsed.expiresAt !== "number"
    ) {
      return null;
    }
    if (Date.now() >= parsed.expiresAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Create the authenticated session cookie. */
export async function createSession(userId: string, role: string): Promise<void> {
  const now = Date.now();
  const payload: SessionPayload = {
    userId,
    role,
    createdAt: now,
    expiresAt: now + SESSION_TTL_SECONDS * 1000,
  };
  const token = serializeSession(payload);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

/** Read the current session (no redirect). Returns null when unauthenticated. */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  return parseSession(cookieStore.get(SESSION_COOKIE)?.value);
}

/** Destroy the session cookie — secure logout. */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/** Regenerate the session identifier-equivalent (fresh token) on login. */
export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}
