// Pure production safety guards — Phase 18 security audit.
//
// DB-free, dependency-free, and safe for client and server imports, so the
// critical fail-closed decisions are unit-testable in a bare `node --test`
// process. The server-only modules (auth/session.ts, auth/sms.ts) delegate
// to these helpers and MUST NOT reimplement the decisions inline.

/** Deterministic dev-only session secret (mirrors auth/session.ts). */
export const DEV_SESSION_SECRET = "reyhan-dev-secret-do-not-use-in-production-0123456789";

export type EnvLike = {
  SESSION_SECRET?: string | undefined;
  NODE_ENV?: string | undefined;
};

export type SecretResolution =
  | { ok: true; secret: string; devFallback: boolean }
  | { ok: false; error: string };

/**
 * Resolve the session signing secret. Production with a missing/short
 * secret is a hard failure — callers must fail closed (reject sessions),
 * because anyone holding the public dev fallback could forge sessions.
 */
export function resolveSessionSecret(env: EnvLike): SecretResolution {
  const secret = env.SESSION_SECRET;
  if (secret && secret.length >= 32) return { ok: true, secret, devFallback: false };
  if (env.NODE_ENV === "production") {
    return { ok: false, error: "SESSION_SECRET is missing or too short in production." };
  }
  return { ok: true, secret: DEV_SESSION_SECRET, devFallback: true };
}

/**
 * Whether the console (no-op) SMS sender may claim successful delivery.
 * In production it delivers nothing, so claiming success would issue real
 * OTP tokens the user can never receive — always refuse there.
 */
export function isConsoleSmsDeliveryAllowed(env: EnvLike): boolean {
  return env.NODE_ENV !== "production";
}
