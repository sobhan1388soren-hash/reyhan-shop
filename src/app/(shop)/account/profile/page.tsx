import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/dal";
import { ProfileForm } from "@/components/account/profile-form";
import { formatPhoneForDisplay } from "@/lib/auth/phone";
import { formatFaDate } from "@/lib/catalog/format";

export const metadata: Metadata = {
  title: "اطلاعات شخصی",
  alternates: { canonical: "/account/profile" },
};

export default async function ProfilePage() {
  const user = await requireUser();

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-5 shadow-card sm:p-6">
        <h1 className="text-lg font-bold text-foreground">اطلاعات شخصی</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          اطلاعات حساب خود را در این بخش مدیریت کنید.
        </p>

        <div className="mt-5">
          <ProfileForm
            initial={{
              firstName: user.firstName ?? "",
              lastName: user.lastName ?? "",
              displayName: user.displayName ?? "",
              email: user.email ?? "",
            }}
          />
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-card sm:p-6">
        <h2 className="text-base font-semibold text-foreground">امنیت حساب</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-4 py-3">
            <dt className="text-muted-foreground">شماره موبایل (شناسه ورود)</dt>
            <dd className="flex items-center gap-2">
              <span className="font-semibold tabular-nums text-foreground" dir="ltr">
                {formatPhoneForDisplay(user.phone)}
              </span>
              {user.phoneVerified && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--reyhan-green-50)] px-2 py-0.5 text-[11px] font-medium text-[var(--reyhan-green-700)]">
                  تأیید شده
                </span>
              )}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-4 py-3">
            <dt className="text-muted-foreground">روش ورود</dt>
            <dd className="font-semibold text-foreground">پیامک با کد یک‌بارمصرف</dd>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-4 py-3">
            <dt className="text-muted-foreground">عضویت از</dt>
            <dd className="font-semibold text-foreground">{formatFaDate(user.createdAt)}</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs leading-6 text-muted-foreground">
          ورود به حساب ریحان فقط از طریق شماره موبایل و کد یک‌بارمصرف انجام می‌شود؛
          بنابراین هیچ رمز عبوری برای نگهداری وجود ندارد و امنیت حساب شما به شماره
          موبایلتان وابسته است.
        </p>
      </div>
    </div>
  );
}
