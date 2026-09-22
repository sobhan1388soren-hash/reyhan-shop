// JsonLd — server component that renders one or more structured-data objects
// as `<script type="application/ld+json">` elements. Phase 17 SEO foundation.
//
// Rendering exactly one element per graph keeps payloads deduplicated: pages
// pass the graphs they own (homepage: Organization + WebSite; product page:
// Product + BreadcrumbList; article: Article + BreadcrumbList). Values are
// serialized with `serializeJsonLd`, which escapes `<` so no stored string
// can terminate the script element.

import { serializeJsonLd } from "@/lib/seo/json-ld";

type JsonLdGraph = Record<string, unknown>;

/**
 * Flatten + de-null a graph list (builders may return null when the page has
 * no visible hierarchy, e.g. an empty breadcrumb). Keeps call sites typed and
 * guarantees no empty `<script>` element is ever rendered.
 */
export function compactGraphs(
  data: JsonLdGraph | JsonLdGraph[] | (JsonLdGraph | null)[] | null
): JsonLdGraph[] {
  if (!data) return [];
  const list = Array.isArray(data) ? data : [data];
  return list.filter((graph): graph is JsonLdGraph => graph !== null);
}

export function JsonLd({
  data,
  id,
}: {
  data:
    | JsonLdGraph
    | JsonLdGraph[]
    | (JsonLdGraph | null)[]
    | (JsonLdGraph | null)[]
    | null;
  id?: string;
}) {
  const graphs = compactGraphs(data);
  return (
    <>
      {graphs.map((graph, index) => (
        <script
          key={id ? `${id}-${index}` : index}
          type="application/ld+json"
          // serializeJsonLd escapes `<` so the payload cannot break out.
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(graph) }}
        />
      ))}
    </>
  );
}
