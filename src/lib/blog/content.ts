// Pure, dependency-free HTML sanitizer for blog article content.
//
// Rich content arrives from the admin WYSIWYG editor as an HTML string. It is
// NEVER trusted or rendered as-is: this module rewrites it into a strict
// allowlist subset before it is stored, and again at render time as
// defense-in-depth. Anything not explicitly allowed is dropped (tags are
// dropped but their TEXT content survives; script/style bodies are dropped
// entirely).
//
// Design goals:
//   - no DOM dependency: Node has no DOMParser, so this is a small tokenizer
//     + nesting stack. It is fully unit-testable in a bare `node --test`.
//   - no inline styles and no arbitrary classes: alignment/callouts ride on
//     allowlisted `data-*` attributes that the stylesheet renders, so there is
//     no CSS injection surface at all.
//   - URLs are scheme-checked; `javascript:`, `data:`, `vbscript:`, `file:` and
//     protocol-relative URLs are rejected. Embeds (`<iframe>`) are additionally
//     restricted to a small allowlist of known video hosts.
//   - entity round-trip: input entities are decoded once then re-encoded on
//     output, so output is always well-formed regardless of input quirks.
//
// Public API: sanitizeHtml / renderPostContent (identical, safe HTML).

// ── Element allowlist ────────────────────────────────────────────────────

const ALLOWED_ELEMENTS = new Set([
  // Structure & text
  "p", "br", "hr", "blockquote",
  // Headings — H1 is reserved for the article page itself (single H1 per page)
  "h2", "h3", "h4",
  // Inline
  "strong", "em", "u", "s", "sub", "sup", "mark", "code", "kbd", "span",
  // Lists
  "ul", "ol", "li",
  // Links & media
  "a", "img", "figure", "figcaption", "iframe",
  // Tables
  "table", "thead", "tbody", "tfoot", "tr", "th", "td",
  // Callouts / notes & native FAQ (semantic, AI-friendly)
  "aside", "details", "summary",
]);

// Elements whose TEXT content is code/markup and must be removed wholesale.
const SKIP_CONTENT = new Set([
  "script", "style", "noscript", "template", "svg", "math", "head", "title",
  "object", "embed", "applet", "link", "meta", "base", "form", "input",
  "button", "select", "textarea", "option", "video", "audio", "source",
  "frame", "frameset", "iframe-nonce",
]);

// Elements that never have children (never pushed onto the nesting stack).
const VOID_ELEMENTS = new Set(["br", "hr", "img", "iframe"]);

// ── Attribute policies ───────────────────────────────────────────────────

type AttrPolicy =
  | "text"
  | "url"
  | "embed"
  | "int"
  | { enum: readonly string[] };

interface IntRange {
  min: number;
  max: number;
}

const TEXT_ATTR_MAX = 300;

const REL_ALLOWLIST = [
  "noreferrer", "noopener", "external", "nofollow", "sponsored", "author",
] as const;

const TARGET_ALLOWLIST = ["_blank", "_self"] as const;

const CALLOUT_ALLOWLIST = ["info", "success", "warning", "danger"] as const;
const ALIGN_ALLOWLIST = ["start", "center", "end"] as const;
const LOADING_ALLOWLIST = ["lazy", "eager"] as const;

const ATTR_POLICIES: Record<string, Record<string, AttrPolicy>> = {
  a: {
    href: "url",
    title: "text",
    rel: { enum: REL_ALLOWLIST },
    target: { enum: TARGET_ALLOWLIST },
  },
  img: {
    src: "url",
    alt: "text",
    title: "text",
    loading: { enum: LOADING_ALLOWLIST },
    width: "int",
    height: "int",
  },
  iframe: {
    src: "embed",
    title: "text",
    loading: { enum: LOADING_ALLOWLIST },
    allow: { enum: ["fullscreen", "encrypted-media", "autoplay", "clipboard-write", "picture-in-picture", "web-share"] },
    allowfullscreen: "text",
    referrerpolicy: { enum: ["no-referrer", "no-referrer-when-downgrade", "strict-origin-when-cross-origin"] },
  },
  ol: { start: "int", type: { enum: ["1", "a", "A", "i", "I"] } },
  td: { colspan: "int", rowspan: "int" },
  th: { colspan: "int", rowspan: "int" },
  aside: { "data-callout": { enum: CALLOUT_ALLOWLIST } },
  details: { open: "text" },
};

// Elements that may carry a text-alignment hint rendered by the stylesheet.
const ALIGNABLE = new Set(["p", "h2", "h3", "h4", "li", "blockquote", "figcaption", "div"]);
const ALIGN_POLICY: AttrPolicy = { enum: ALIGN_ALLOWLIST };

function attrPolicyFor(tag: string, name: string): AttrPolicy | undefined {
  if (name === "data-align" && ALIGNABLE.has(tag)) return ALIGN_POLICY;
  return ATTR_POLICIES[tag]?.[name];
}

const INT_RANGES: Record<string, IntRange> = {
  width: { min: 1, max: 4000 },
  height: { min: 1, max: 4000 },
  colspan: { min: 1, max: 20 },
  rowspan: { min: 1, max: 20 },
  start: { min: 1, max: 9999 },
};

// ── URL safety ───────────────────────────────────────────────────────────

const FORBIDDEN_SCHEMES = /^(javascript|vbscript|data|file|about|blob|filesystem):/i;
const SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Accept http(s) absolute URLs, root-relative paths, in-page anchors,
 * relative paths and mailto/tel/sms. Rejects every other scheme, plus
 * protocol-relative URLs (`//host`) which can smuggle foreign origins.
 */
export function safeUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (/[\u0000-\u001f\u007f]/.test(value)) return null;
  if (FORBIDDEN_SCHEMES.test(value)) return null;
  if (/^(mailto|tel|sms):/i.test(value)) return value;
  if (value.startsWith("#")) return value;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  // Protocol-relative is rejected explicitly (no scheme, but starts with //).
  if (value.startsWith("//")) return null;
  if (!SCHEME_PATTERN.test(value)) return value; // plain relative reference
  if (/^https?:\/\//i.test(value)) return value;
  return null;
}

/**
 * `<iframe>` sources are restricted to a small allowlist of well-known video
 * hosts over HTTPS. Everything else (including all `javascript:`/`data:`) is
 * refused, so an embed can never become a script vector.
 */
export function safeEmbedUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (!/^https:\/\//i.test(value)) return null;
  let host = "";
  let pathname = "";
  try {
    const parsed = new URL(value);
    host = parsed.hostname.toLowerCase();
    pathname = parsed.pathname.toLowerCase();
  } catch {
    return null;
  }
  if (pathname.includes("..")) return null;
  if ((host === "www.youtube.com" || host === "youtube.com" || host === "www.youtube-nocookie.com" || host.endsWith(".youtube.com")) &&
      pathname.startsWith("/embed/")) {
    return value;
  }
  if (host === "player.vimeo.com" || (host.endsWith(".vimeo.com") && pathname.startsWith("/video/"))) {
    return value;
  }
  if (host.endsWith(".aparat.com") && pathname.startsWith("/video/")) {
    return value;
  }
  return null;
}

// ── Entity round-trip ────────────────────────────────────────────────────

const NAMED_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

function decodeEntities(input: string): string {
  return input.replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/gi, (whole, name: string) => {
    return NAMED_ENTITIES[`&${name.toLowerCase()};`] ?? whole;
  });
}

function encodeText(input: string): string {
  return input.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function encodeAttr(input: string): string {
  return input.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

// ── Tokenizer ────────────────────────────────────────────────────────────

type Attr = { name: string; value: string };

type Token =
  | { type: "text"; value: string }
  | { type: "open"; tag: string; attrs: Attr[]; selfClosing: boolean }
  | { type: "close"; tag: string };

const START_TAG = /^<([a-zA-Z][a-zA-Z0-9:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/;
const END_TAG = /^<\/\s*([a-zA-Z][a-zA-Z0-9:-]*)[^>]*>/;
const ATTR_PATTERN = /([a-zA-Z_:][a-zA-Z0-9_:.-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>`]+)))?/g;

function parseAttributes(source: string): Attr[] {
  const out: Attr[] = [];
  ATTR_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ATTR_PATTERN.exec(source)) !== null) {
    out.push({
      name: match[1].toLowerCase(),
      value: decodeEntities(match[2] ?? match[3] ?? match[4] ?? ""),
    });
  }
  return out;
}

function tokenize(html: string): Token[] {
  const tokens: Token[] = [];
  const length = html.length;
  let i = 0;
  while (i < length) {
    const char = html[i];
    if (char !== "<") {
      const next = html.indexOf("<", i);
      const text = next === -1 ? html.slice(i) : html.slice(i, next);
      tokens.push({ type: "text", value: text });
      i = next === -1 ? length : next;
      continue;
    }
    // Comments, declarations, CDATA and processing instructions are dropped.
    if (html.startsWith("<!--", i)) {
      const end = html.indexOf("-->", i + 4);
      i = end === -1 ? length : end + 3;
      continue;
    }
    if (html.startsWith("<![CDATA[", i)) {
      const end = html.indexOf("]]>", i + 9);
      i = end === -1 ? length : end + 3;
      continue;
    }
    if (html.startsWith("<!", i) || html.startsWith("<?", i)) {
      const end = html.indexOf(">", i);
      i = end === -1 ? length : end + 1;
      continue;
    }
    if (html.startsWith("</", i)) {
      const match = END_TAG.exec(html.slice(i));
      if (match) {
        tokens.push({ type: "close", tag: match[1].toLowerCase() });
        i += match[0].length;
        continue;
      }
      i += 1; // stray '<' — treat as text
      tokens.push({ type: "text", value: "<" });
      continue;
    }
    const match = START_TAG.exec(html.slice(i));
    if (match) {
      const inner = match[2];
      tokens.push({
        type: "open",
        tag: match[1].toLowerCase(),
        attrs: parseAttributes(inner),
        selfClosing: inner.trimEnd().endsWith("/"),
      });
      i += match[0].length;
      continue;
    }
    i += 1;
    tokens.push({ type: "text", value: "<" });
  }
  return tokens;
}

/** Remove `<script>`-like elements together with their inner text. */
function stripSkippable(tokens: Token[]): Token[] {
  const out: Token[] = [];
  let skipping: string | null = null;
  for (const token of tokens) {
    if (skipping !== null) {
      if (token.type === "close" && token.tag === skipping) skipping = null;
      continue;
    }
    if (token.type === "open" && SKIP_CONTENT.has(token.tag)) {
      if (!token.selfClosing && !VOID_ELEMENTS.has(token.tag)) skipping = token.tag;
      continue;
    }
    out.push(token);
  }
  return out;
}

// ── Emission ─────────────────────────────────────────────────────────────

function clampInt(raw: string, range: IntRange): string | null {
  if (!/^\d+$/.test(raw.trim())) return null;
  const value = Number.parseInt(raw.trim(), 10);
  if (!Number.isSafeInteger(value)) return null;
  if (value < range.min || value > range.max) return null;
  return String(value);
}

function filterAttribute(tag: string, attr: Attr): string | null {
  const policy = attrPolicyFor(tag, attr.name);
  if (!policy) return null;
  if (policy === "text") {
    const value = attr.value.slice(0, TEXT_ATTR_MAX);
    return value ? `${attr.name}="${encodeAttr(value)}"` : null;
  }
  if (policy === "url") {
    const value = safeUrl(attr.value);
    return value === null ? null : `${attr.name}="${encodeAttr(value)}"`;
  }
  if (policy === "embed") {
    const value = safeEmbedUrl(attr.value);
    return value === null ? null : `${attr.name}="${encodeAttr(value)}"`;
  }
  if (policy === "int") {
    const range = INT_RANGES[attr.name];
    if (!range) return null;
    const value = clampInt(attr.value, range);
    return value === null ? null : `${attr.name}="${value}"`;
  }
  // enum allowlist — exact, case-sensitive match only
  if ((policy.enum as readonly string[]).includes(attr.value)) {
    return `${attr.name}="${encodeAttr(attr.value)}"`;
  }
  return null;
}

function emitOpenTag(token: Extract<Token, { type: "open" }>): string | null {
  if (!ALLOWED_ELEMENTS.has(token.tag)) return null;
  const kept: string[] = [];
  const seen = new Set<string>();
  for (const attr of token.attrs) {
    if (seen.has(attr.name)) continue; // first occurrence wins
    const emitted = filterAttribute(token.tag, attr);
    if (emitted) {
      kept.push(emitted);
      seen.add(attr.name);
    }
  }
  const attrs = kept.length > 0 ? ` ${kept.join(" ")}` : "";
  return `<${token.tag}${attrs}>`;
}

// ── Public API ───────────────────────────────────────────────────────────

/**
 * Rewrite untrusted article HTML into the safe allowlist subset.
 * Always returns a string (possibly empty); never throws.
 */
export function sanitizeHtml(input: string): string {
  if (typeof input !== "string" || input.length === 0) return "";
  const tokens = stripSkippable(tokenize(input));
  const out: string[] = [];
  const stack: string[] = [];
  for (const token of tokens) {
    if (token.type === "text") {
      const text = encodeText(decodeEntities(token.value));
      if (text) out.push(text);
      continue;
    }
    if (token.type === "close") {
      const index = stack.lastIndexOf(token.tag);
      if (index === -1) continue; // closing a tag that was never opened
      for (let j = stack.length - 1; j >= index; j--) {
        out.push(`</${stack[j]}>`);
      }
      stack.length = index;
      continue;
    }
    const emitted = emitOpenTag(token);
    if (emitted === null) continue; // disallowed element: drop tag, keep text
    out.push(emitted);
    if (token.selfClosing || VOID_ELEMENTS.has(token.tag)) continue;
    stack.push(token.tag);
  }
  // Close anything still open so output can never break the surrounding page.
  for (let j = stack.length - 1; j >= 0; j--) {
    out.push(`</${stack[j]}>`);
  }
  return out.join("");
}

/**
 * Render-time safety pass. Stored content was already sanitized on write;
 * this re-runs the same allowlist so a compromised or legacy row can never
 * reach the page untreated. Cheap and pure.
 */
export function renderPostContent(stored: string | null | undefined): string {
  return sanitizeHtml(stored ?? "");
}

/**
 * Rough Persian/English reading-time estimate from sanitized HTML.
 * Counts word-ish tokens; used only for display, never for logic.
 */
export function estimateReadingMinutes(stored: string | null | undefined): number {
  const text = (stored ?? "").replace(/<[^>]*>/g, " ");
  const words = text.split(/\s+/).filter((w) => w.length > 0).length;
  if (words === 0) return 0;
  return Math.max(1, Math.round(words / 200));
}

/**
 * Extract a plain-text excerpt from sanitized content (for metadata/Open
 * Graph style fallbacks). Collapses whitespace; never renders HTML.
 */
export function plainTextFromContent(stored: string | null | undefined, max = 160): string {
  const text = (stored ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  const sliced = text.slice(0, max);
  const space = sliced.lastIndexOf(" ");
  return `${space > 20 ? sliced.slice(0, space) : sliced}…`;
}
