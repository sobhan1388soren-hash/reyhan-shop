import Link from "next/link";
import { filterAdminNavForRole, ADMIN_NAVIGATION } from "@/lib/admin/rules";
import { LogoutButton } from "@/components/account/logout-button";
import { AdminNavigation } from "@/components/admin/admin-navigation";
import { SITE_NAME } from "@/lib/constants";

// AdminSidebar — desktop rail. Sections are role-filtered SERVER-side
// from the DB-resolved role; the client never supplies authorization.

export function AdminSidebar({ role, name }: { role: string; name: string }) {
  const sections = filterAdminNavForRole(ADMIN_NAVIGATION, role);

  return (
    <aside className="sticky top-0 hidden h-svh w-64 shrink-0 flex-col border-e bg-card lg:flex">
      <div className="flex h-16 shrink-0 items-center gap-2.5 border-b px-5">
        <Link
          href="/admin"
          className="flex items-center gap-2.5"
          aria-label={`${SITE_NAME} — داشبورد مدیریت`}
        >
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none">
              <path
                d="M12 3.2C12 3.2 7.2 8.2 7.2 12.2C7.2 14.9 9.35 17.05 12 17.05C14.65 17.05 16.8 14.9 16.8 12.2C16.8 8.2 12 3.2 12 3.2Z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-foreground">
            {SITE_NAME}
            <span className="ms-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-[var(--reyhan-blue-700)]">
              مدیریت
            </span>
          </span>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <AdminNavigation sections={sections} />
      </div>

      <div className="shrink-0 border-t p-3">
        <div className="mb-1 flex items-center gap-2.5 rounded-lg px-3 py-2">
          <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
            {name.charAt(0)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{name}</p>
            <p className="text-[11px] text-muted-foreground">
              {role === "ADMIN" ? "مدیر کل" : "کارشناس پشتیبانی"}
            </p>
          </div>
        </div>
        <div className="border-t pt-1">
          <LogoutButton />
        </div>
      </div>
    </aside>
  );
}
