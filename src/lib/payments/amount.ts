// Payment amount guards — pure. Amounts are always Int Rial, always
// derived server-side (order row / gateway verification). Client-submitted
// amounts are never trusted anywhere in the payment flow.

/** Hard upper bound on a single payment (Rial) — well inside safe integers. */
export const MAX_PAYMENT_AMOUNT_RIAL = 1_000_000_000_000;

export class PaymentAmountError extends Error {
  constructor(value: unknown) {
    super(`PAYMENT_AMOUNT_INVALID:${String(value)}`);
    this.name = "PaymentAmountError";
  }
}

export function isValidServerAmount(amount: unknown): amount is number {
  return (
    typeof amount === "number" &&
    Number.isSafeInteger(amount) &&
    amount > 0 &&
    amount <= MAX_PAYMENT_AMOUNT_RIAL
  );
}

/** Throws for corrupt/non-positive/non-integer amounts (internal invariant). */
export function assertServerAmount(amount: number, label = "amount"): void {
  if (!isValidServerAmount(amount)) {
    throw new PaymentAmountError(`${label}:${amount}`);
  }
}

/** Exact-integer comparison — no coercion, no tolerance. */
export function amountsMatch(a: number, b: number): boolean {
  return isValidServerAmount(a) && isValidServerAmount(b) && a === b;
}
