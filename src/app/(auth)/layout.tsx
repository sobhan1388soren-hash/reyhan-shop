import { Container } from "@/components/layout/container";

// Centered auth card shell — simple, focused, trustworthy
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col bg-gradient-to-b from-[var(--reyhan-blue-50)]/60 via-white to-white">
      <Container className="flex flex-1 items-center justify-center py-12 sm:py-16">
        <div className="w-full max-w-md">{children}</div>
      </Container>
    </div>
  );
}
