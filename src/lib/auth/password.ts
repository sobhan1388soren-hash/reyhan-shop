// Password hashing utilities using PBKDF2 — server-only.
import "server-only";
import { pbkdf2Sync, randomBytes } from "node:crypto";

const ITERATIONS = 100_000;
const KEY_LENGTH = 64;
const DIGEST = "sha256";

export function hashPassword(password: string): string {
  const salt = randomBytes(32).toString("hex");
  const hash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;
  const computedHash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString("hex");
  if (computedHash.length !== hash.length) return false;
  let result = 0;
  for (let i = 0; i < computedHash.length; i++) {
    result |= computedHash.charCodeAt(i) ^ hash.charCodeAt(i);
  }
  return result === 0;
}

export function validateNationalCode(code: string): boolean {
  if (!/^\d{10}$/.test(code)) return false;
  const digits = code.split("").map(Number);
  const check = digits[9];
  const sum = digits.slice(0, 9).reduce((acc, d, i) => acc + d * (10 - i), 0);
  const remainder = sum % 11;
  const calculatedCheck = remainder < 2 ? remainder : 11 - remainder;
  return check === calculatedCheck;
}

export function validatePasswordStrength(password: string): { ok: true } | { ok: false; error: string } {
  if (password.length < 8) {
    return { ok: false, error: "رمز عبور باید حداقل ۸ نویسه باشد." };
  }
  if (password.length > 128) {
    return { ok: false, error: "رمز عبور نمی‌تواند بیش از ۱۲۸ نویسه باشد." };
  }
  return { ok: true };
}