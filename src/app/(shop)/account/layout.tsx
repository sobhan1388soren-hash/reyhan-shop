import { Container } from "@/components/layout/container";
import { AccountNav } from "@/components/account/account-nav";
import { LogoutButton } from "@/components/account/logout-button";
import { requireUser, userDisplayName } from "@/lib/auth/dal";
import { formatPhoneForDisplay } from "@/lib/auth/phone";

// Secure check — beyond the optimistic proxy redirect, every account page
// requires a valid session AND an existing active user row.
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="bg-muted/20">
      <Container className="py-8 lg:py-12">
        {/* Mobile header */}
        <div className="mb-4 flex items-center justify-between lg:hidden">
          <h1 className="text-lg font-bold text-foreground">حساب کاربری</h1>
          <span className="text-xs text-muted-foreground">{userDisplayName(user)}</span>
        </div>

        <div className="grid gap-6 lg:grid-cols-[260px_1fr] lg:gap-8">
          {/* Sidebar */}
          <aside className="rounded-xl border bg-card p-3 shadow-card lg:sticky lg:top-24 lg:h-fit lg:p-4">
            <div className="mb-3 hidden items-center gap-3 border-b pb-3 lg:flex">
              <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-base font-bold text-primary">
                {userDisplayName(user).charAt(0)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {userDisplayName(user)}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground" dir="ltr">
                  {formatPhoneForDisplay(user.phone)}
                </p>
              </div>
            </div>
            <AccountNav />
            <div className="mt-1 border-t pt-1">
              <LogoutButton />
            </div>
          </aside>

          {/* Content */}
          <div className="min-w-0">{children}</div>
        </div>
      </Container>
    </div>
  );
}
