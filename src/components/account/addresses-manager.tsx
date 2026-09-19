"use client";

import * as React from "react";
import { AddressForm, emptyDraft, type AddressDraft } from "./address-form";

// Client wrapper managing add/edit modes + confirm-on-delete UX.

import { deleteAddress, setDefaultAddress } from "@/app/actions/addresses";

type Address = {
  id: string;
  recipientName: string;
  phone: string;
  province: string;
  city: string;
  postalCode: string | null;
  addressLine: string;
  isDefault: boolean;
};

function DeleteForm({ addressId }: { addressId: string }) {
  const [armed, setArmed] = React.useState(false);
  return (
    <form
      action={deleteAddress}
      onSubmit={(e) => {
        if (!armed) {
          e.preventDefault();
          setArmed(true);
        }
      }}
    >
      <input type="hidden" name="addressId" value={addressId} />
      {armed ? (
        <span className="flex items-center gap-2">
          <button
            type="submit"
            className="text-xs font-semibold text-destructive hover:underline"
          >
            تأیید حذف
          </button>
          <button
            type="button"
            onClick={() => setArmed(false)}
            className="text-xs text-muted-foreground hover:underline"
          >
            انصراف
          </button>
        </span>
      ) : (
        <button
          type="submit"
          className="text-xs font-medium text-destructive hover:underline"
        >
          حذف
        </button>
      )}
    </form>
  );
}

export function AddressesManager({ addresses }: { addresses: Address[] }) {
  const [formOpen, setFormOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<AddressDraft>(emptyDraft);

  const openAdd = () => {
    setDraft(emptyDraft);
    setFormOpen(true);
  };

  const openEdit = (address: Address) => {
    setDraft({
      id: address.id,
      recipientName: address.recipientName,
      phone: address.phone,
      province: address.province,
      city: address.city,
      postalCode: address.postalCode ?? "",
      addressLine: address.addressLine,
    });
    setFormOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Add / Edit form */}
      {formOpen && (
        <div className="rounded-xl border bg-card p-5 shadow-card sm:p-6">
          <h2 className="mb-4 text-base font-semibold text-foreground">
            {draft.id ? "ویرایش نشانی" : "افزودن نشانی جدید"}
          </h2>
          <AddressForm draft={draft} onClose={() => setFormOpen(false)} />
        </div>
      )}

      {/* Add button */}
      {!formOpen && (
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-[var(--reyhan-blue-700)]"
        >
          <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4" fill="none">
            <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          افزودن نشانی
        </button>
      )}

      {/* Cards */}
      {addresses.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          هنوز نشانی‌ای ثبت نکرده‌اید. با دکمه «افزودن نشانی» اولین نشانی خود را ثبت کنید.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {addresses.map((address) => (
            <li
              key={address.id}
              className={
                address.isDefault
                  ? "rounded-xl border-2 border-primary bg-card p-5 shadow-card"
                  : "rounded-xl border bg-card p-5 shadow-card"
              }
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">
                  {address.recipientName}
                  {address.isDefault && (
                    <span className="ms-2 inline-flex rounded-full bg-[var(--reyhan-green-50)] px-2 py-0.5 text-[10px] font-medium text-[var(--reyhan-green-700)]">
                      نشانی پیش‌فرض
                    </span>
                  )}
                </p>
              </div>
              <dl className="mt-3 space-y-1.5 text-xs leading-6 text-muted-foreground">
                <div className="flex gap-2">
                  <dt className="shrink-0 font-medium">استان و شهر:</dt>
                  <dd className="text-foreground">
                    {address.province}، {address.city}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="shrink-0 font-medium">نشانی:</dt>
                  <dd className="text-foreground">{address.addressLine}</dd>
                </div>
                {address.postalCode && (
                  <div className="flex gap-2">
                    <dt className="shrink-0 font-medium">کد پستی:</dt>
                    <dd className="tabular-nums text-foreground" dir="ltr">
                      {address.postalCode}
                    </dd>
                  </div>
                )}
                <div className="flex gap-2">
                  <dt className="shrink-0 font-medium">تلفن:</dt>
                  <dd className="tabular-nums text-foreground" dir="ltr">
                    {address.phone}
                  </dd>
                </div>
              </dl>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => openEdit(address)}
                        className="text-xs font-medium text-[var(--reyhan-blue-700)] hover:underline"
                  >
                    ویرایش
                  </button>
                  {!address.isDefault && (
                    <form action={setDefaultAddress}>
                      <input type="hidden" name="addressId" value={address.id} />
                      <button
                        type="submit"
                    className="text-xs font-medium text-[var(--reyhan-blue-700)] hover:underline"
                      >
                        تنظیم به‌عنوان پیش‌فرض
                      </button>
                    </form>
                  )}
                </div>
                <DeleteForm addressId={address.id} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
