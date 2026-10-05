import { Container, Section } from "@/components/layout/container";

// Products listing skeleton — shown during navigation while the server
// re-queries the catalog (filters/sort/search/pagination). Mirrors the
// listing layout (sidebar + grid) so the swap-in doesn't shift the page.
export default function ProductsLoading() {
  return (
    <Section className="bg-gradient-to-b from-white via-[#f6fafc] to-[#eef3f6] py-12 sm:py-16 lg:py-20">
      <Container>
        <div
          role="status"
          aria-label="در حال بارگذاری محصولات"
          className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[280px_1fr]"
        >
          <span className="sr-only">در حال بارگذاری محصولات…</span>
          <div className="hidden space-y-6 lg:block" aria-hidden="true">
            <div className="h-11 rounded-md skeleton-ice" />
            <div className="h-10 rounded-md skeleton-ice" />
            <div className="h-64 rounded-xl border border-slate-200/60 bg-white/70 p-4 backdrop-blur-md">
              <div className="h-4 w-1/2 rounded skeleton-ice" />
              <div className="mt-4 space-y-2.5">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-9 rounded-md skeleton-ice" />
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-6" aria-hidden="true">
            <div className="h-4 w-40 rounded skeleton-ice" />
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="overflow-hidden rounded-xl border border-slate-200/60 bg-white/70 backdrop-blur-md">
                  <div className="aspect-[4/3] skeleton-ice" />
                  <div className="space-y-2.5 p-4">
                    <div className="h-4 w-3/4 rounded skeleton-ice" />
                    <div className="h-3 w-1/2 rounded skeleton-ice" />
                    <div className="h-5 w-1/3 rounded skeleton-ice" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
