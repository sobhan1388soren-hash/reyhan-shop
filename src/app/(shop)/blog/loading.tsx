import { Container, Section } from "@/components/layout/container";

// Blog listing skeleton — mirrors the card grid so navigation between the
// blog index, category pages and articles doesn't flash a blank page.
export default function BlogLoading() {
  return (
    <Section className="py-10 sm:py-14">
      <Container>
        <div role="status" aria-label="در حال بارگذاری مقالات">
          <span className="sr-only">در حال بارگذاری مقالات…</span>
          <div className="grid animate-pulse gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="overflow-hidden rounded-xl border bg-card">
                <div className="aspect-[16/10] bg-muted" />
                <div className="space-y-2.5 p-4 sm:p-5">
                  <div className="h-5 w-5/6 rounded bg-muted" />
                  <div className="h-3 w-full rounded bg-muted" />
                  <div className="h-3 w-2/3 rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </Section>
  );
}
