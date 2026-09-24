import { Container } from "@/components/layout/container";

// Product detail skeleton — the detail page fans out to ~7 parallel
// queries (product, related, ancestors, reviews, questions, posts, session),
// so navigation shows this instead of a blank page.
export default function ProductDetailLoading() {
  return (
    <Container className="py-6 pb-24 lg:pb-10">
      <div role="status" aria-label="در حال بارگذاری محصول">
        <span className="sr-only">در حال بارگذاری محصول…</span>
        <div className="animate-pulse" aria-hidden="true">
          <div className="h-3.5 w-56 rounded bg-muted" />
          <div className="mt-4 grid gap-8 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <div className="aspect-square rounded-lg bg-muted sm:aspect-[4/3]" />
            </div>
            <div className="space-y-4 lg:col-span-5">
              <div className="h-8 w-3/4 rounded bg-muted" />
              <div className="h-4 w-1/3 rounded bg-muted" />
              <div className="rounded-xl border bg-card p-5">
                <div className="h-4 w-1/4 rounded bg-muted" />
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div className="h-16 rounded-lg bg-muted" />
                  <div className="h-16 rounded-lg bg-muted" />
                </div>
                <div className="mt-4 h-12 rounded-md bg-muted" />
              </div>
            </div>
          </div>
          <div className="mt-8 h-40 rounded-xl border bg-card" />
        </div>
      </div>
    </Container>
  );
}
