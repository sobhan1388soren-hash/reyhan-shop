"use client";

// Address selection for checkout — reuses the SAME Address model, form,
// and createAddress action from Phase 7 (no duplicate address system).
// The user picks one saved address or adds a new one inline; ownership of
// whatever id is submitted is re-verified server-side at submission time.

import * as React from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { AddressForm, emptyDraft } from "@/components/account/address-form";
import type { CheckoutAddress } from "@/lib/checkout/types";

export function AddressSelector({
  addresses,
  selectedId,
  onSelect,
  onAddressAdded,
}: {
  addresses: CheckoutAddress[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddressAdded: (address: CheckoutAddress) => void;
}) {
  const router = useRouter();
  const [formOpen, setFormOpen] = React.useState(false);
  const [announced, setAnnounced] = React.useState("");

  // Server list is the source of truth; a local override holds addresses
  // added inline during this session. Derived during render (no effects).
  const [addedAddresses, setAddedAddresses] = React.useState<CheckoutAddress[]>([]);
  const localAddresses = React.useMemo(() => {
    const seen = new Set(addedAddresses.map((a) => a.id));
    return [...addedAddresses, ...addresses.filter((a) => !seen.has(a.id))];
  }, [addedAddresses, addresses]);

  // After a successful inline save: fetch the session-scoped list (API is
  // authorized by the session cookie — no client-supplied ids), select the
  // newest address, and refresh server components.
  const handleSaved = React.useCallback(async () => {
    const res = await fetch("/api/checkout/addresses");
    if (!res.ok) return;
    const data = (await res.json()) as { addresses?: CheckoutAddress[] };
    if (!data.addresses?.length) return;
    setAddedAddresses(data.addresses);
    const newest = data.addresses[0];
    onAddressAdded(newest);
    setAnnounced("نشانی جدید ذخیره و برای این سفارش انتخاب شد.");
    router.refresh();
  }, [onAddressAdded, router]);

  return (
    <section
      aria-labelledby="checkout-address-heading"
      className="rounded-xl border bg-card p-5 shadow-card sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="checkout-address-heading" className="text-base font-bold text-foreground">
          نشانی ارسال
        </h2>
        <button
          type="button"
          onClick={() => setFormOpen((v) => !v)}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent"
          aria-expanded={formOpen}
          aria-controls="checkout-new-address"
        >
          <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5" fill="none">
            <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          {formOpen ? "بستن فرم نشانی" : "افزودن نشانی جدید"}
        </button>
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {announced}
      </p>

      {/* Inline add form — same Phase 7 AddressForm + createAddress action */}
      {formOpen && (
        <div id="checkout-new-address" className="mt-4 rounded-lg border bg-background p-4">
          <h3 className="mb-3 text-sm font-semibold text-foreground">نشانی جدید</h3>
          <AddressForm
            draft={emptyDraft}
            onClose={() => setFormOpen(false)}
            onSaved={handleSaved}
          />
        </div>
      )}

      {localAddresses.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed px-4 py-8 text-center">
          <p className="text-sm leading-7 text-muted-foreground">
            هنوز نشانی‌ای ثبت نکرده‌اید. برای ثبت سفارش، با دکمه «افزودن نشانی جدید»
            اولین نشانی خود را ثبت کنید.
          </p>
        </div>
      ) : (
        <fieldset className="mt-4">
          <legend className="sr-only">انتخاب نشانی ارسال</legend>
          <ul className="grid gap-3 sm:grid-cols-2">
            {localAddresses.map((address) => {
              const checked = selectedId === address.id;
              return (
                <li key={address.id}>
                  <label
                    className={cn(
                      "flex h-full cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors",
                      checked
                        ? "border-primary bg-[var(--reyhan-blue-50)]/50"
                        : "bg-background hover:bg-muted/50"
                    )}
                  >
                    <input
                      type="radio"
                      name="addressChoice"
                      value={address.id}
                      checked={checked}
                      onChange={() => onSelect(address.id)}
                      className="mt-0.5 size-4 accent-[var(--reyhan-blue-600)]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">
                          {address.recipientName}
                        </span>
                        {address.isDefault && (
                          <span className="rounded-full bg-[var(--reyhan-green-50)] px-2 py-0.5 text-[10px] font-medium text-[var(--reyhan-green-700)]">
                            پیش‌فرض
                          </span>
                        )}
                      </span>
                      <span className="mt-1 block text-xs leading-6 text-muted-foreground">
                        {address.province}، {address.city} — {address.addressLine}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        کد پستی:{" "}
                        <span className="tabular-nums" dir="ltr">
                          {address.postalCode ?? "—"}
                        </span>
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        تلفن:{" "}
                        <span className="tabular-nums" dir="ltr">
                          {address.phone}
                        </span>
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>
      )}
    </section>
  );
}
