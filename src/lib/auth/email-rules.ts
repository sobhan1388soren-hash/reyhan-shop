// Email + password authentication domain — pure validation and normalization.
//
// DB-free and framework-free so it is unit-testable in a bare `node --test`
// process, mirroring the catalog/admin/blog rules modules. The server
// actions in src/app/actions/auth.ts call these rules; the UI never decides
// validity — server-side is authoritative.
//
// Security model:
//   - the email is lowercased and trimmed so login and registration agree on
//     one identity for the same address (the DB column is `@unique`)
//   - national code is REQUIRED for registration and validated by the real
//     Iranian checksum (re-used from ./password.ts, which is server-only, so
//     the checksum itself is re-implemented here as a pure function)
//   - password strength follows the same 8..128 bounds as the server
//   - email login reports "unknown email" and "wrong password" separately so
//     users get actionable errors. Unlike the phone/OTP flow (which keeps one
//     generic message), this endpoint can therefore reveal whether an email is
//     registered — an explicit product decision. Inactive accounts still get
//     the generic message so status is not leaked.
//
// Error copy is Persian and lives here so the modal, the /login page and the
// /register page can never drift apart.

/** Longest accepted e-mail address (RFC 5321 practical maximum). */
export const EMAIL_MAX = 254;
/** Iranian national code length. */
export const NATIONAL_CODE_LENGTH = 10;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

/** One generic rejection for every failed-credential path (anti-enumeration). */
export const GENERIC_CREDENTIALS_ERROR = "اطلاعات واردشده صحیح نیست. لطفاً دوباره تلاش کنید.";

/** Email login: no account exists for the submitted email address. */
export const EMAIL_NOT_FOUND_ERROR = "کاربری با این ایمیل یافت نشد.";

/** Email login: the submitted password does not match the stored hash. */
export const WRONG_PASSWORD_ERROR = "رمز عبور اشتباه است.";

export const EMAIL_ERROR_MESSAGES = {
  emailRequired: "نشانی ایمیل را وارد کنید.",
  emailInvalid: "نشانی ایمیل معتبر نیست.",
  emailTooLong: "نشانی ایمیل بیش از حد طولانی است.",
  emailTaken: "این ایمیل قبلاً ثبت شده است.",
  passwordRequired: "رمز عبور را وارد کنید.",
  passwordTooShort: `رمز عبور باید حداقل ${PASSWORD_MIN} نویسه باشد.`,
  passwordTooLong: `رمز عبور نمی‌تواند بیش از ${PASSWORD_MAX} نویسه باشد.`,
  nationalCodeRequired: "کد ملی را وارد کنید.",
  nationalCodeInvalid: "کد ملی معتبر نیست.",
  nationalCodeTaken: "این کد ملی قبلاً ثبت شده است.",
} as const;

// ── Normalization ────────────────────────────────────────────────────

/** Trim + lowercase. The single canonical form used for lookups and storage. */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Convert Persian/Arabic-Indic digits to Latin so a national code typed with
 * those digits is still accepted. Whitespace and separators are stripped.
 */
export function normalizeNationalCode(raw: string): string {
  return raw
    .replace(/[\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\s\u200c-]/g, "");
}

/**
 * Iranian national code checksum. Pure re-implementation of the same
 * algorithm the server-only ./password.ts uses, so it can be unit-tested
 * without importing `server-only`.
 */
export function isValidNationalCode(code: string): boolean {
  if (!/^\d{10}$/.test(code)) return false;
  const digits = code.split("").map(Number);
  const check = digits[9];
  const sum = digits.slice(0, 9).reduce((acc, d, i) => acc + d * (10 - i), 0);
  const remainder = sum % 11;
  const calculated = remainder < 2 ? remainder : 11 - remainder;
  return check === calculated;
}

// ── Field validators ─────────────────────────────────────────────────

export type FieldResult = { ok: true; value: string } | { ok: false; error: string };

export function validateEmail(raw: string): FieldResult {
  const email = normalizeEmail(raw);
  if (!email) return { ok: false, error: EMAIL_ERROR_MESSAGES.emailRequired };
  if (email.length > EMAIL_MAX) {
    return { ok: false, error: EMAIL_ERROR_MESSAGES.emailTooLong };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return { ok: false, error: EMAIL_ERROR_MESSAGES.emailInvalid };
  }
  return { ok: true, value: email };
}

export function validatePassword(raw: string): FieldResult {
  if (!raw) return { ok: false, error: EMAIL_ERROR_MESSAGES.passwordRequired };
  if (raw.length < PASSWORD_MIN) {
    return { ok: false, error: EMAIL_ERROR_MESSAGES.passwordTooShort };
  }
  if (raw.length > PASSWORD_MAX) {
    return { ok: false, error: EMAIL_ERROR_MESSAGES.passwordTooLong };
  }
  return { ok: true, value: raw };
}

export function validateNationalCodeField(raw: string): FieldResult {
  const code = normalizeNationalCode(raw);
  if (!code) return { ok: false, error: EMAIL_ERROR_MESSAGES.nationalCodeRequired };
  if (code.length !== NATIONAL_CODE_LENGTH || !isValidNationalCode(code)) {
    return { ok: false, error: EMAIL_ERROR_MESSAGES.nationalCodeInvalid };
  }
  return { ok: true, value: code };
}

// ── Form validators ──────────────────────────────────────────────────

export type EmailLoginInput = { email?: unknown; password?: unknown };
export type EmailLoginValues = { email: string; password: string };

export type EmailLoginValidation =
  | { ok: true; data: EmailLoginValues }
  | { ok: false; fieldErrors: Record<string, string> };

/**
 * Login never rejects on strength — an account created years ago with a
 * weaker password must still be able to sign in. Only presence and shape are
 * checked here; the credential itself is verified server-side against the
 * stored hash.
 */
export function validateEmailLogin(raw: EmailLoginInput): EmailLoginValidation {
  const fieldErrors: Record<string, string> = {};

  const email = validateEmail(typeof raw.email === "string" ? raw.email : "");
  if (!email.ok) fieldErrors.email = email.error;

  const passwordRaw = typeof raw.password === "string" ? raw.password : "";
  if (!passwordRaw) fieldErrors.password = EMAIL_ERROR_MESSAGES.passwordRequired;

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  return {
    ok: true,
    data: { email: email.ok ? email.value : "", password: passwordRaw },
  };
}

export type EmailRegisterInput = {
  email?: unknown;
  password?: unknown;
  nationalCode?: unknown;
  firstName?: unknown;
  lastName?: unknown;
};

export type EmailRegisterValues = {
  email: string;
  password: string;
  nationalCode: string;
  firstName: string | null;
  lastName: string | null;
};

export type EmailRegisterValidation =
  | { ok: true; data: EmailRegisterValues }
  | { ok: false; fieldErrors: Record<string, string> };

/**
 * Registration validates every field up front and returns typed, normalized
 * values. Each field is narrowed independently so the caller never re-reads a
 * union member after the aggregate check (the previous implementation did,
 * which is why it could not satisfy the type checker).
 */
export function validateEmailRegister(raw: EmailRegisterInput): EmailRegisterValidation {
  const fieldErrors: Record<string, string> = {};

  const email = validateEmail(typeof raw.email === "string" ? raw.email : "");
  if (!email.ok) fieldErrors.email = email.error;

  const password = validatePassword(typeof raw.password === "string" ? raw.password : "");
  if (!password.ok) fieldErrors.password = password.error;

  const nationalCode = validateNationalCodeField(
    typeof raw.nationalCode === "string" ? raw.nationalCode : ""
  );
  if (!nationalCode.ok) fieldErrors.nationalCode = nationalCode.error;

  const firstNameRaw = typeof raw.firstName === "string" ? raw.firstName.trim() : "";
  if (!firstNameRaw) {
    fieldErrors.firstName = "نام را وارد کنید.";
  } else if (firstNameRaw.length < 2) {
    fieldErrors.firstName = "نام باید حداقل ۲ نویسه باشد.";
  } else if (firstNameRaw.length > 60) {
    fieldErrors.firstName = "نام نمی‌تواند بیش از ۶۰ نویسه باشد.";
  }

  const lastNameRaw = typeof raw.lastName === "string" ? raw.lastName.trim() : "";
  if (lastNameRaw.length > 60) {
    fieldErrors.lastName = "نام خانوادگی نمی‌تواند بیش از ۶۰ نویسه باشد.";
  }

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  return {
    ok: true,
    data: {
      email: email.ok ? email.value : "",
      password: password.ok ? password.value : "",
      nationalCode: nationalCode.ok ? nationalCode.value : "",
      firstName: firstNameRaw || null,
      lastName: lastNameRaw || null,
    },
  };
}