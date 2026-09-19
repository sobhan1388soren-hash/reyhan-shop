"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

// Suppresses public-site chrome (header/footer) on admin routes.
// The admin console renders its own shell; authorization is enforced
// server-side regardless of this presentational toggle.
export function PublicChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return null;
  return <>{children}</>;
}
