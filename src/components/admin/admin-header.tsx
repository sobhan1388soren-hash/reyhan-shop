import Link from "next/link";
import { filterAdminNavForRole, ADMIN_NAVIGATION } from "@/lib/admin/rules";
import { AdminMobileNav } from "@/components/admin/admin-mobile-nav";

// AdminHeader — mobile-only top bar (desktop uses the sidebar rail).
// Nav sections are role-filtered server-side before render.

export function AdminHeader({ role, name }: { role: string; name: string }) {
  const sections = filterAdminNavForRole(ADMIN_NAVIGATION, role);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur lg:hidden">
      <div className="flex h-14 items-center justify-between gap-3 px-4">
        <div className="flex items-center gap-2">
          <AdminMobileNav sections={sections} />
          <Link
            href="/admin"
            className="text-sm font-semibold text-foreground"
            aria-label="داشبورد مدیریت"
          >
            مدیریت ریحان
          </Link>
        </div>
        <span className="inline-flex h-8 max-w-[45%] items-center truncate rounded-full bg-primary/10 px-3 text-xs font-medium text-[var(--reyhan-blue-700)]">
          {name}
        </span>
      </div>
    </header>
  );
}
