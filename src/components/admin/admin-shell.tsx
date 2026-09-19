import * as React from "react";
import { AdminSidebar } from "@/components/admin/admin-sidebar";

// AdminShell — desktop rail + mobile header + content column.
// Pure layout; authorization already enforced upstream by requireAdmin().

export function AdminShell({
  role,
  name,
  header,
  children,
}: {
  role: string;
  name: string;
  header?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh bg-muted/20">
      <AdminSidebar role={role} name={name} />
      <div className="flex min-w-0 flex-1 flex-col">
        {header}
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
