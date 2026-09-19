import type { Metadata } from "next";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/auth/dal";
import { AddressesManager } from "@/components/account/addresses-manager";

export const metadata: Metadata = {
  title: "نشانی‌ها",
  alternates: { canonical: "/account/addresses" },
};

export default async function AddressesPage() {
  const user = await requireUser();

  const addresses = await prisma.address
    .findMany({
      where: { userId: user.id },
      orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    })
    .catch(() => []);

  return (
    <div className="rounded-xl border bg-card p-5 shadow-card sm:p-6">
      <h1 className="text-lg font-bold text-foreground">نشانی‌های من</h1>
      <p className="mt-1.5 mb-6 text-sm text-muted-foreground">
        نشانی‌های ارسال سفارش را اینجا مدیریت کنید. نشانی پیش‌فرض در ثبت سفارش‌ها
        به‌صورت خودکار انتخاب می‌شود.
      </p>
      <AddressesManager
        addresses={addresses.map((a) => ({
          id: a.id,
          recipientName: a.recipientName,
          phone: a.phone,
          province: a.province,
          city: a.city,
          postalCode: a.postalCode,
          addressLine: a.addressLine,
          isDefault: a.isDefault,
        }))}
      />
    </div>
  );
}
