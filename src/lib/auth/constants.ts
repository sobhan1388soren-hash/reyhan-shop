// Shared auth constants — safe for client and server imports.
// (OTP security logic lives in the server-only otp.ts; only timings are here.)

export const OTP_TTL_SECONDS = 120; // 2 minutes
export const OTP_RESEND_COOLDOWN_SECONDS = 60; // 60 seconds
export const OTP_LENGTH = 6;
