import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/dal";
import { userDisplayName } from "@/lib/auth/dal";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminHeader } from "@/components/admin/admin-header";

// Admin layout-level protection: every /admin page runs requireAdmin(),
// which resolves the role from the DATABASE user row (never session
// claims) and is deny-by-default. The proxy hop is only optimistic.

export const metadata: Metadata = {
  title: {
    default: "پنل مدیریت",
    template: "%s | پنل مدیریت ریحان",
  },
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdmin();
  const name = userDisplayName(user);

  return (
    <AdminShell role={user.adminRole} name={name} header={<AdminHeader role={user.adminRole} name={name} />}>
      {children}
    </AdminShell>
  );
}
