import * as React from "react";
import { cn } from "@/lib/utils";
import { Container, Section } from "@/components/layout/container";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { PublicChrome } from "@/components/layout/public-chrome";
import { CartDrawer } from "@/components/cart/cart-drawer";

// Reusable shell — ensures sticky header + footer layout, flex column.
// Public chrome is suppressed on /admin (admin pages render AdminShell).
// CartDrawer mounts once here so every page can open the slide-over sheet.
export function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicChrome>
        <Header />
      </PublicChrome>
      <div className="flex flex-1 flex-col">{children}</div>
      <PublicChrome>
        <Footer />
      </PublicChrome>
      <CartDrawer />
    </div>
  );
}

// Page wrapper — constrained container with vertical rhythm
export function PageContainer({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <Container className={cn("py-8 sm:py-10 lg:py-12", className)} {...props} />;
}

// Main content landmark — for a11y
export function Main({
  className,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  return <main className={cn("flex-1", className)} {...props} />;
}

// Sub-exports for ergonomic imports
export { Container, Section, Header, Footer };
