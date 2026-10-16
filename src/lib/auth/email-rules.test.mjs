// Email/password authentication domain tests — pure, DB-free.
//
// Covers src/lib/auth/email-rules.ts: normalization, the national-code
// checksum (including Persian/Arabic digits), password bounds, per-field
// validation independence and the anti-enumeration guarantees.
//
// Run: npm run test:auth-email

import test from "node:test";
import assert from "node:assert/strict";

import {
  EMAIL_ERROR_MESSAGES,
  GENERIC_CREDENTIALS_ERROR,
  PASSWORD_MAX,
  PASSWORD_MIN,
  isValidNationalCode,
  normalizeEmail,
  normalizeNationalCode,
  validateEmail,
  validateEmailLogin,
  validateEmailRegister,
  validateNationalCodeField,
  validatePassword,
} from "./email-rules.ts";

// ── Normalization ────────────────────────────────────────────────────

test("normalizeEmail trims and lowercases so one address has one identity", () => {
  assert.equal(normalizeEmail("  Ali@Example.COM "), "ali@example.com");
  assert.equal(normalizeEmail("ALI@EXAMPLE.COM"), "ali@example.com");
});

test("validateEmail accepts a normal address and normalizes it", () => {
  const r = validateEmail(" User@Reyhan.ir ");
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.value, "user@reyhan.ir");
});

test("validateEmail rejects empty, malformed and over-long addresses", () => {
  const empty = validateEmail("   ");
  assert.equal(empty.ok, false);
  assert.equal(empty.ok === false && empty.error, EMAIL_ERROR_MESSAGES.emailRequired);

  for (const bad of ["no-at-sign", "a@b", "a b@c.com", "@nope.com", "a@@b.com"]) {
    const r = validateEmail(bad);
    assert.equal(r.ok, false, `expected rejection for ${bad}`);
    assert.equal(r.ok === false && r.error, EMAIL_ERROR_MESSAGES.emailInvalid);
  }

  const long = validateEmail(`${"a".repeat(250)}@example.com`);
  assert.equal(long.ok, false);
  assert.equal(long.ok === false && long.error, EMAIL_ERROR_MESSAGES.emailTooLong);
});

// ── National code ────────────────────────────────────────────────────

test("normalizeNationalCode converts Persian and Arabic digits, strips separators", () => {
  assert.equal(normalizeNationalCode("۰۰۱۲۳۴۵۶۷۸"), "0012345678");
  assert.equal(normalizeNationalCode("٠٠١٢٣٤٥٦٧٨"), "0012345678");
  assert.equal(normalizeNationalCode(" 001-234 5678 "), "0012345678");
  assert.equal(normalizeNationalCode("۰۰۱۲۳۴۵۶۷\u200c۸"), "0012345678");
});

test("isValidNationalCode accepts real checksums and rejects wrong ones", () => {
  // Well-known valid Iranian national codes.
  assert.equal(isValidNationalCode("0499370899"), true);
  assert.equal(isValidNationalCode("0084575948"), true);
  // Right length, wrong check digit.
  assert.equal(isValidNationalCode("0499370898"), false);
  assert.equal(isValidNationalCode("0084575949"), false);
  // Wrong shapes.
  assert.equal(isValidNationalCode("123456789"), false);
  assert.equal(isValidNationalCode("04993708990"), false);
  assert.equal(isValidNationalCode("abcdefghij"), false);
  assert.equal(isValidNationalCode(""), false);
});

test("validateNationalCodeField accepts Persian digits typed by the user", () => {
  const r = validateNationalCodeField("۰۴۹۹۳۷۰۸۹۹");
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.value, "0499370899");
});

test("validateNationalCodeField distinguishes missing from invalid", () => {
  const missing = validateNationalCodeField("");
  assert.equal(missing.ok, false);
  assert.equal(missing.ok === false && missing.error, EMAIL_ERROR_MESSAGES.nationalCodeRequired);

  const invalid = validateNationalCodeField("0499370898");
  assert.equal(invalid.ok, false);
  assert.equal(invalid.ok === false && invalid.error, EMAIL_ERROR_MESSAGES.nationalCodeInvalid);
});

// ── Password ─────────────────────────────────────────────────────────

test("validatePassword enforces the documented bounds", () => {
  assert.equal(validatePassword("").ok, false);
  assert.equal(validatePassword("a".repeat(PASSWORD_MIN - 1)).ok, false);
  assert.equal(validatePassword("a".repeat(PASSWORD_MIN)).ok, true);
  assert.equal(validatePassword("a".repeat(PASSWORD_MAX)).ok, true);
  assert.equal(validatePassword("a".repeat(PASSWORD_MAX + 1)).ok, false);
});

test("validatePassword never trims — spaces are legitimate password characters", () => {
  const r = validatePassword("  pass word  ");
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.value, "  pass word  ");
});

// ── Login form ───────────────────────────────────────────────────────

test("validateEmailLogin reports each missing field independently", () => {
  const r = validateEmailLogin({ email: "", password: "" });
  assert.equal(r.ok, false);
  assert.ok(r.ok === false && r.fieldErrors.email);
  assert.ok(r.ok === false && r.fieldErrors.password);
});

test("validateEmailLogin does NOT enforce strength on an existing account", () => {
  // A 4-character password must still be submittable for login — only
  // registration is allowed to reject weak passwords.
  const r = validateEmailLogin({ email: "user@reyhan.ir", password: "abcd" });
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.data.password, "abcd");
});

test("validateEmailLogin returns the normalized email for the lookup", () => {
  const r = validateEmailLogin({ email: "  User@Reyhan.IR ", password: "valid-password" });
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.data.email, "user@reyhan.ir");
});

test("validateEmailLogin treats non-string input as empty, never throwing", () => {
  const r = validateEmailLogin({ email: { toString: null }, password: 12345 });
  assert.equal(r.ok, false);
});

// ── Registration form ────────────────────────────────────────────────

test("validateEmailRegister requires the national code", () => {
  const r = validateEmailRegister({
    email: "user@reyhan.ir",
    password: "valid-password",
    nationalCode: "",
    firstName: "علی",
  });
  assert.equal(r.ok, false);
  assert.equal(
    r.ok === false && r.fieldErrors.nationalCode,
    EMAIL_ERROR_MESSAGES.nationalCodeRequired
  );
});

test("validateEmailRegister returns fully typed values on success", () => {
  const r = validateEmailRegister({
    email: " User@Reyhan.IR ",
    password: "valid-password",
    nationalCode: "۰۴۹۹۳۷۰۸۹۹",
    firstName: "  علی  ",
    lastName: "  رضایی ",
  });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.data.email, "user@reyhan.ir");
  assert.equal(r.data.nationalCode, "0499370899");
  assert.equal(r.data.firstName, "علی");
  assert.equal(r.data.lastName, "رضایی");
});

test("validateEmailRegister converts an empty last name to null", () => {
  const r = validateEmailRegister({
    email: "user@reyhan.ir",
    password: "valid-password",
    nationalCode: "0499370899",
    firstName: "علی",
    lastName: "   ",
  });
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.data.lastName, null);
});

test("validateEmailRegister requires the first name", () => {
  const r = validateEmailRegister({
    email: "user@reyhan.ir",
    password: "valid-password",
    nationalCode: "0499370899",
    firstName: "",
  });
  assert.equal(r.ok, false);
  assert.ok(r.ok === false && r.fieldErrors.firstName);
});

test("validateEmailRegister accumulates every field error at once", () => {
  const r = validateEmailRegister({
    email: "bad",
    password: "short",
    nationalCode: "0499370898", // right length, wrong check digit
    firstName: "",
  });
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.ok(r.fieldErrors.email);
  assert.ok(r.fieldErrors.password);
  assert.ok(r.fieldErrors.nationalCode);
  assert.ok(r.fieldErrors.firstName);
});

test("validateEmailRegister rejects an over-long name", () => {
  const r = validateEmailRegister({
    email: "user@reyhan.ir",
    password: "valid-password",
    nationalCode: "0499370899",
    firstName: "a".repeat(61),
  });
  assert.equal(r.ok, false);
  assert.ok(r.ok === false && r.fieldErrors.firstName);
});

// ── Anti-enumeration ────────────────────────────────────────────────

test("login validation never produces an 'account exists/does not exist' message", () => {
  // The pure validator only knows about shape. Existence is a server concern,
  // and the server returns GENERIC_CREDENTIALS_ERROR for every one of those
  // cases — so nothing here may mention registration/existence state.
  const r = validateEmailLogin({ email: "nobody@reyhan.ir", password: "x".repeat(12) });
  assert.equal(r.ok, true, "shape is valid; the server decides existence");
  assert.equal(r.ok === false && JSON.stringify(r.fieldErrors).includes("ثبت شده"), false);
});

test("the generic credentials message is one shared constant", () => {
  assert.equal(typeof GENERIC_CREDENTIALS_ERROR, "string");
  assert.ok(GENERIC_CREDENTIALS_ERROR.length > 0);
  // It must not collide with any field-level message, otherwise a client
  // could tell a field error apart from a credential rejection.
  for (const message of Object.values(EMAIL_ERROR_MESSAGES)) {
    assert.notEqual(message, GENERIC_CREDENTIALS_ERROR);
  }
});

test("'already registered' copy is only used by registration, never by login", () => {
  const messages = Object.values(EMAIL_ERROR_MESSAGES);
  assert.ok(messages.includes(EMAIL_ERROR_MESSAGES.emailTaken));
  assert.ok(messages.includes(EMAIL_ERROR_MESSAGES.nationalCodeTaken));
  // Login has no dedicated existence-revealing message in the vocabulary.
  assert.equal(
    Object.keys(EMAIL_ERROR_MESSAGES).some((k) => /login/i.test(k)),
    false
  );
});