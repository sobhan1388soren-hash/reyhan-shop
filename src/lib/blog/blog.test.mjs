// Unit tests — Phase 15 blog post rules + rich-content sanitizer (pure
// logic, DB-free). Covers:
//   - post input validation/normalization (title/slug fallback, excerpt &
//     SEO caps, cover-image URL policy, status whitelist)
//   - the publish-requires-content rule (drafts may be empty)
//   - related-product id list (de-dup, cap) and category id list
//   - publishedAt stamping semantics
//   - the HTML allowlist rewriter: XSS vectors, scheme rejection, the embed
//     host allowlist, entity round-trip, nesting repair, and the render-time
//     safety pass
//
// Run: npm run test:blog   (node --test with TS type-stripping)

import test from "node:test";
import assert from "node:assert/strict";

import {
  validatePostInput,
  normalizePostSlug,
  normalizeRelatedProductIds,
  normalizePostCategoryIds,
  publishFieldFor,
  parsePostSort,
  evaluatePostDeletion,
  POST_STATUSES,
  POST_SORTS,
  POST_RELATED_PRODUCTS_MAX,
  POST_CATEGORIES_MAX,
  POST_TITLE_MAX,
  POST_CONTENT_MAX,
  POST_ERROR_MESSAGES,
} from "./post-rules.ts";
import {
  sanitizeHtml,
  renderPostContent,
  safeUrl,
  safeEmbedUrl,
  estimateReadingMinutes,
  plainTextFromContent,
} from "./content.ts";

const validInput = {
  title: "راهنمای خرید دستگاه تصفیه آب خانگی",
  slug: "",
  excerpt: "خلاصه کوتاه مقاله.",
  content: "<p>محتوای کامل و واقعی مقاله اینجا نوشته می‌شود.</p>",
  coverImage: "https://example.com/cover.jpg",
  status: "DRAFT",
  seoTitle: "",
  seoDescription: "",
  seoKeywords: "",
  authorId: "",
};

// ── Post input validation ───────────────────────────────────────────────

test("valid draft input normalizes with empty slug falling back to title", () => {
  const result = validatePostInput(validInput);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.title, "راهنمای خرید دستگاه تصفیه آب خانگی");
    assert.equal(result.data.slug, "راهنمای-خرید-دستگاه-تصفیه-آب-خانگی");
    assert.equal(result.data.status, "DRAFT");
    assert.equal(result.data.excerpt, "خلاصه کوتاه مقاله.");
    assert.equal(result.data.coverImage, "https://example.com/cover.jpg");
    assert.equal(result.data.seoTitle, null);
    assert.equal(result.data.authorId, null);
  }
});

test("explicit slug is kept and lowercased", () => {
  const result = validatePostInput({ ...validInput, slug: "Water-Filter-Guide" });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.data.slug, "water-filter-guide");
});

test("explicit but junk slug errors out", () => {
  const result = validatePostInput({ ...validInput, slug: "!!!" });
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.errors.slug);
});

test("empty title is rejected", () => {
  const result = validatePostInput({ ...validInput, title: "   " });
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.errors.title);
});

test("oversized title is rejected", () => {
  const result = validatePostInput({ ...validInput, title: "ا".repeat(POST_TITLE_MAX + 1) });
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.errors.title);
});

test("oversized excerpt is rejected", () => {
  const result = validatePostInput({ ...validInput, excerpt: "ا".repeat(601) });
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.errors.excerpt);
});

test("non-string fields never throw and coerce to safe defaults", () => {
  const result = validatePostInput({
    title: "عنوان تست",
    slug: null,
    excerpt: undefined,
    content: 12345,
    coverImage: {},
    status: [],
    seoTitle: null,
    seoDescription: null,
    seoKeywords: null,
    authorId: null,
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.content, "");
    assert.equal(result.data.coverImage, null);
    assert.equal(result.data.status, "DRAFT");
  }
});

// ── Status handling ─────────────────────────────────────────────────────

test("unknown status value is rejected as a field error", () => {
  const result = validatePostInput({ ...validInput, status: "SCHEDULED" });
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.errors.status);
});

test("POST_STATUSES exposes the schema vocabulary", () => {
  assert.deepEqual([...POST_STATUSES], ["DRAFT", "PUBLISHED", "ARCHIVED"]);
});

test("publishing requires real prose content", () => {
  const empty = validatePostInput({ ...validInput, status: "PUBLISHED", content: "" });
  assert.equal(empty.ok, false);
  if (!empty.ok) assert.ok(empty.errors.content);

  const tagsOnly = validatePostInput({
    ...validInput,
    status: "PUBLISHED",
    content: "<p></p><img src='https://a.b/c.jpg'>",
  });
  assert.equal(tagsOnly.ok, false);
  if (!tagsOnly.ok) assert.ok(tagsOnly.errors.content);
});

test("a draft may be saved with no content at all", () => {
  const result = validatePostInput({ ...validInput, status: "DRAFT", content: "" });
  assert.equal(result.ok, true);
});

// ── Cover image URL policy ──────────────────────────────────────────────

test("cover image accepts http(s) and root-relative paths only", () => {
  const ok = (cover) => validatePostInput({ ...validInput, coverImage: cover }).ok;
  assert.equal(ok("https://cdn.example.com/a.jpg"), true);
  assert.equal(ok("http://cdn.example.com/a.jpg"), true);
  assert.equal(ok("/media/posts/a.jpg"), true);
  assert.equal(ok("javascript:alert(1)"), false);
  assert.equal(ok("//evil.example.com/a.jpg"), false);
  assert.equal(ok("data:image/png;base64,AAA"), false);
});

// ── SEO caps ────────────────────────────────────────────────────────────

test("seo fields are capped and normalized to null when empty", () => {
  const result = validatePostInput({
    ...validInput,
    seoTitle: "عنوان سئو",
    seoDescription: "توضیح سئو",
    seoKeywords: "a, b",
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.seoTitle, "عنوان سئو");
    assert.equal(result.data.seoKeywords, "a, b");
  }

  const tooLong = validatePostInput({
    ...validInput,
    seoDescription: "ا".repeat(401),
    seoKeywords: "ا".repeat(301),
    seoTitle: "ا".repeat(201),
  });
  assert.equal(tooLong.ok, false);
  if (!tooLong.ok) {
    assert.ok(tooLong.errors.seoDescription);
    assert.ok(tooLong.errors.seoKeywords);
    assert.ok(tooLong.errors.seoTitle);
  }
});

test("content length cap is enforced", () => {
  const result = validatePostInput({
    ...validInput,
    content: `<p>${"ا".repeat(POST_CONTENT_MAX)}</p>`,
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.errors.content);
});

// ── Related product ids ─────────────────────────────────────────────────

test("related product ids de-duplicate preserving order and cap", () => {
  const dup = normalizeRelatedProductIds(["b", "a", "b", "c"]);
  assert.equal(dup.ok, false);
  if (!dup.ok) assert.equal(dup.error, "DUPLICATE");

  const ok = normalizeRelatedProductIds(["b", "a", "c"]);
  assert.equal(ok.ok, true);
  if (ok.ok) assert.deepEqual(ok.ids, ["b", "a", "c"]);

  const tooMany = normalizeRelatedProductIds(
    Array.from({ length: POST_RELATED_PRODUCTS_MAX + 1 }, (_, i) => `p${i}`)
  );
  assert.equal(tooMany.ok, false);
  if (!tooMany.ok) assert.equal(tooMany.error, "TOO_MANY");
});

test("related product ids tolerate non-array and dirty input", () => {
  assert.deepEqual(normalizeRelatedProductIds(undefined).ok, true);
  const result = normalizeRelatedProductIds([" x ", "", null, 7, "y"]);
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.ids, ["x", "y"]);
});

// ── Category ids ────────────────────────────────────────────────────────

test("category ids de-duplicate and cap at POST_CATEGORIES_MAX", () => {
  const ids = normalizePostCategoryIds(["c1", "c1", "c2", null, "  ", 3]);
  assert.deepEqual(ids, ["c1", "c2"]);

  const many = normalizePostCategoryIds(
    Array.from({ length: POST_CATEGORIES_MAX + 2 }, (_, i) => `c${i}`)
  );
  assert.equal(many.length, POST_CATEGORIES_MAX);
});

test("normalizePostSlug mirrors the catalog convention", () => {
  assert.equal(normalizePostSlug("دستگاه تصفیه آب ۶ مرحله‌ای"), "دستگاه-تصفیه-آب-۶-مرحلهای");
  assert.equal(normalizePostSlug("  Water   Filter!!  "), "water-filter");
});

// ── publishedAt semantics ───────────────────────────────────────────────

test("publishFieldFor stamps the first publish and preserves it on re-draft", () => {
  const first = new Date("2024-01-01T00:00:00.000Z");
  assert.equal(publishFieldFor("DRAFT", null), null);
  assert.equal(publishFieldFor("ARCHIVED", first), first);
  const stamped = publishFieldFor("PUBLISHED", null);
  assert.ok(stamped instanceof Date);
  assert.equal(publishFieldFor("DRAFT", stamped), stamped);
  assert.equal(publishFieldFor("PUBLISHED", stamped), stamped);
});

// ── Sort whitelist + deletion guard + error copy ────────────────────────

test("parsePostSort whitelists values and defaults to newest-first", () => {
  assert.equal(parsePostSort("title_asc"), "title_asc");
  assert.equal(parsePostSort("published_desc"), "published_desc");
  assert.equal(parsePostSort(undefined), "published_desc");
  assert.equal(parsePostSort("random()"), "published_desc");
  assert.ok(POST_SORTS.includes("updated_desc"));
});

test("post deletion is always allowed by the pure guard", () => {
  assert.deepEqual(evaluatePostDeletion(), { allowed: true });
});

test("every post error code has Persian copy", () => {
  const codes = [
    "FORBIDDEN", "VALIDATION", "NOT_FOUND", "DUPLICATE_SLUG",
    "INVALID_CATEGORY", "INVALID_PRODUCTS", "INVALID_AUTHOR",
    "PRODUCT_LIMIT", "DB_ERROR",
  ];
  for (const code of codes) {
    assert.equal(typeof POST_ERROR_MESSAGES[code], "string");
    assert.ok(POST_ERROR_MESSAGES[code].length > 0);
  }
});

// ── HTML sanitizer: allowlist enforcement ───────────────────────────────

test("allowlisted structure survives and disallowed tags are dropped (text kept)", () => {
  const out = sanitizeHtml("<h2>تیتر</h2><p>متن <strong>پررنگ</strong> و <em>کج</em>.</p>");
  assert.equal(out, "<h2>تیتر</h2><p>متن <strong>پررنگ</strong> و <em>کج</em>.</p>");
});

test("script and style bodies are removed entirely", () => {
  const out = sanitizeHtml("<p>ok</p><script>alert(1)</script><style>.x{}</style><p>ok2</p>");
  assert.equal(out, "<p>ok</p><p>ok2</p>");
});

test("h1 is not in the allowlist (single H1 belongs to the page)", () => {
  const out = sanitizeHtml("<h1>big</h1><p>x</p>");
  assert.equal(out, "big<p>x</p>");
});

test("inline styles and arbitrary classes are stripped", () => {
  const out = sanitizeHtml('<p style="color:red" class="evil" onclick="alert(1)">متن</p>');
  assert.equal(out, "<p>متن</p>");
});

test("unclosed tags are repaired so output cannot break the page", () => {
  const out = sanitizeHtml("<blockquote><p>unclosed");
  assert.equal(out, "<blockquote><p>unclosed</p></blockquote>");
});

test("stray closing tags are dropped", () => {
  assert.equal(sanitizeHtml("</p>after"), "after");
});

test("comments, CDATA and processing instructions are dropped", () => {
  const out = sanitizeHtml("<p>a</p><!-- secret --><?php echo 1; ?><p>b</p>");
  assert.equal(out, "<p>a</p><p>b</p>");
});

test("non-string and empty input yield empty string without throwing", () => {
  assert.equal(sanitizeHtml(""), "");
  assert.equal(sanitizeHtml(undefined), "");
  assert.equal(sanitizeHtml(null), "");
  assert.equal(sanitizeHtml(42), "");
});

// ── Sanitizer: attribute + URL policy ───────────────────────────────────

test("link hrefs are scheme-checked", () => {
  assert.equal(
    sanitizeHtml('<a href="https://ok.example.com/x">good</a>'),
    '<a href="https://ok.example.com/x">good</a>'
  );
  assert.equal(sanitizeHtml('<a href="/internal">good</a>'), '<a href="/internal">good</a>');
  assert.equal(sanitizeHtml('<a href="#anchor">good</a>'), '<a href="#anchor">good</a>');
  assert.equal(sanitizeHtml('<a href="mailto:a@b.com">good</a>'), '<a href="mailto:a@b.com">good</a>');
  // Disallowed scheme drops the href ATTRIBUTE; the allowlisted <a> and its
  // text survive (the tag itself is harmless without a destination).
  assert.equal(sanitizeHtml('<a href="javascript:alert(1)">bad</a>'), "<a>bad</a>");
  assert.equal(sanitizeHtml('<a href="//evil.example.com">bad</a>'), "<a>bad</a>");
  assert.equal(sanitizeHtml('<a href="data:text/html,x">bad</a>'), "<a>bad</a>");
});

test("target/rel are enum-allowlisted (exact match only)", () => {
  assert.equal(
    sanitizeHtml('<a href="https://a.b" target="_blank" rel="noreferrer">x</a>'),
    '<a href="https://a.b" target="_blank" rel="noreferrer">x</a>'
  );
  // A multi-token rel is not an exact allowlist member, so it is dropped.
  assert.equal(
    sanitizeHtml('<a href="https://a.b" target="_blank" rel="noreferrer noopener">x</a>'),
    '<a href="https://a.b" target="_blank">x</a>'
  );
  assert.equal(
    sanitizeHtml('<a href="https://a.b" target="_self" rel="preload">x</a>'),
    '<a href="https://a.b" target="_self">x</a>'
  );
});

test("image src is a URL and alt/title survive with caps", () => {
  assert.equal(
    sanitizeHtml('<img src="https://a.b/c.jpg" alt="توصیف" loading="lazy">'),
    '<img src="https://a.b/c.jpg" alt="توصیف" loading="lazy">'
  );
  // Disallowed src drops the attribute; the allowlisted (void) <img> remains.
  assert.equal(sanitizeHtml('<img src="javascript:alert(1)">'), "<img>");
  assert.equal(sanitizeHtml('<img src="https://a.b/c.jpg" width="abc">'), '<img src="https://a.b/c.jpg">');
  assert.equal(
    sanitizeHtml('<img src="https://a.b/c.jpg" width="4000">'),
    '<img src="https://a.b/c.jpg" width="4000">'
  );
  assert.equal(sanitizeHtml('<img src="https://a.b/c.jpg" width="4001">'), '<img src="https://a.b/c.jpg">');
});

test("iframes are restricted to the video-host allowlist over https", () => {
  // iframe is void (no closing tag is emitted, matching HTML semantics).
  assert.equal(
    sanitizeHtml('<iframe src="https://www.youtube.com/embed/abc"></iframe>'),
    '<iframe src="https://www.youtube.com/embed/abc">'
  );
  assert.equal(
    sanitizeHtml('<iframe src="https://player.vimeo.com/video/123"></iframe>'),
    '<iframe src="https://player.vimeo.com/video/123">'
  );
  assert.equal(sanitizeHtml('<iframe src="https://evil.example.com/embed/x"></iframe>'), "<iframe>");
  assert.equal(sanitizeHtml('<iframe src="http://www.youtube.com/embed/abc"></iframe>'), "<iframe>");
  assert.equal(sanitizeHtml('<iframe src="javascript:alert(1)"></iframe>'), "<iframe>");
});

test("callouts ride on the data-callout enum only", () => {
  assert.equal(
    sanitizeHtml('<aside data-callout="warning"><p>هشدار</p></aside>'),
    '<aside data-callout="warning"><p>هشدار</p></aside>'
  );
  assert.equal(sanitizeHtml('<aside data-callout="evil"><p>x</p></aside>'), "<aside><p>x</p></aside>");
});

test("alignment rides on data-align for allowlisted blocks only", () => {
  assert.equal(
    sanitizeHtml('<p data-align="center">وسط</p>'),
    '<p data-align="center">وسط</p>'
  );
  assert.equal(sanitizeHtml('<p data-align="full">x</p>'), "<p>x</p>");
  assert.equal(sanitizeHtml('<span data-align="center">x</span>'), "<span>x</span>");
});

test("table colspan/rowspan are clamped to sane ranges", () => {
  assert.equal(
    sanitizeHtml('<table><tbody><tr><td colspan="2">x</td></tr></tbody></table>'),
    '<table><tbody><tr><td colspan="2">x</td></tr></tbody></table>'
  );
  assert.equal(
    sanitizeHtml('<table><tbody><tr><td colspan="99">x</td></tr></tbody></table>'),
    '<table><tbody><tr><td>x</td></tr></tbody></table>'
  );
});

test("entities round-trip safely", () => {
  assert.equal(sanitizeHtml("<p>a &amp; b &lt;c&gt;</p>"), "<p>a &amp; b &lt;c&gt;</p>");
  assert.equal(sanitizeHtml("<p>&quot;quoted&quot;</p>"), '<p>"quoted"</p>');
  assert.equal(sanitizeHtml("<p>&nbsp;</p>"), "<p> </p>");
});

test("duplicate attributes keep only the first occurrence", () => {
  assert.equal(
    sanitizeHtml('<a href="https://a.b" href="javascript:alert(1)">x</a>'),
    '<a href="https://a.b">x</a>'
  );
});

test("nesting is balanced across mixed lists", () => {
  const out = sanitizeHtml("<ul><li>one<ul><li>two</li></ul></li></ul>");
  assert.equal(out, "<ul><li>one<ul><li>two</li></ul></li></ul>");
});

// ── Sanitizer: render-time pass + helpers ───────────────────────────────

test("renderPostContent re-applies the allowlist to stored content", () => {
  assert.equal(renderPostContent("<p>ok</p><script>x</script>"), "<p>ok</p>");
  assert.equal(renderPostContent(null), "");
});

test("safeUrl/exported primitives behave", () => {
  assert.equal(safeUrl("https://a.b/x"), "https://a.b/x");
  assert.equal(safeUrl("javascript:x"), null);
  assert.equal(safeEmbedUrl("https://www.youtube.com/embed/a"), "https://www.youtube.com/embed/a");
  assert.equal(safeEmbedUrl("https://a.b/x"), null);
});

test("estimateReadingMinutes counts words and floors at one", () => {
  assert.equal(estimateReadingMinutes(""), 0);
  assert.equal(estimateReadingMinutes("<p>یک دو سه</p>"), 1);
  const long = `<p>${Array.from({ length: 400 }, () => "کلمه").join(" ")}</p>`;
  assert.equal(estimateReadingMinutes(long), 2);
});

test("plainTextFromContent strips tags and ellipsizes", () => {
  assert.equal(plainTextFromContent("<p>سلام <strong>دنیا</strong></p>"), "سلام دنیا");
  const long = `<p>${"متن آزمایشی ".repeat(40)}</p>`;
  const out = plainTextFromContent(long, 30);
  assert.ok(out.length <= 31);
  assert.ok(out.endsWith("…"));
});
