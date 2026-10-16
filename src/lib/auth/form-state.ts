// Shared auth form-state types — safe to import from client components.
// (Server action files may only export async functions.)

export type AuthFormState = {
  step: "phone" | "otp";
  phone?: string;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
  retryAfterSeconds?: number;
  attemptsLeft?: number;
};

export const initialAuthState: AuthFormState = { step: "phone" };

export type EmailLoginFormState = {
  step: "email";
  /** True only when the server actually established a session. */
  success?: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
};

export const initialEmailLoginState: EmailLoginFormState = { step: "email" };

export type EmailRegisterFormState = {
  step: "email" | "email_pending";
  /** True only when the server actually created the account + session. */
  success?: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
};

export const initialEmailRegisterState: EmailRegisterFormState = { step: "email" };

export type ProfileFormState = {
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
};

export type AddressFormState = {
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
};
