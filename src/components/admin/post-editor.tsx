"use client";

import * as React from "react";
import { sanitizeHtml, safeEmbedUrl, safeUrl } from "@/lib/blog/content";
import type { InternalLinkTarget } from "@/lib/blog/post-service";

// PostEditor — lightweight WYSIWYG editor for article content.
//
// Design constraints (why a custom island instead of a dependency):
//   - the content sanitizer (src/lib/blog/content.ts) is the authority for
//     what may be stored/rendered. This editor only ever emits markup that
//     survives the allowlist, so what the admin sees is what gets saved:
//     alignment rides on `data-align` (never inline styles), callouts on
//     `data-callout`, embeds on the allowlisted video hosts
//   - zero runtime dependencies: formatting runs through the browser's
//     built-in editing commands plus a few structured inserts. `execCommand`
//     is deprecated but universally implemented; a full content model is
//     out of scope for this phase
//   - the edited HTML is synced to a hidden `content` input so the normal
//     form submission carries it; the server sanitizes it again on write
//   - preview renders the SANITIZED content in an in-console overlay only —
//     drafts never reach a public URL and are never indexable

type EditorProps = {
  initialContent: string;
  internalTargets: {
    posts: InternalLinkTarget[];
    blogCategories: InternalLinkTarget[];
    products: InternalLinkTarget[];
    productCategories: InternalLinkTarget[];
  };
  contentError?: string;
};

type ToolbarAction = {
  label: string;
  title: string;
  run: () => void;
  icon: React.ReactNode;
};

function exec(command: string, value?: string): void {
  if (typeof document === "undefined") return;
  document.execCommand(command, false, value);
}

/** Closest block ancestor the sanitizer allows `data-align` on. */
const ALIGNABLE = ["P", "H2", "H3", "H4", "LI", "BLOCKQUOTE", "FIGCAPTION", "DIV"];

function blockAncestor(node: Node | null | undefined): HTMLElement | null {
  let current = node instanceof HTMLElement ? node : node?.parentElement ?? null;
  while (current && current.getAttribute) {
    if (ALIGNABLE.includes(current.tagName)) return current;
    current = current.parentElement;
  }
  return null;
}

function focusEditor(ref: React.RefObject<HTMLDivElement | null>) {
  if (ref.current) ref.current.focus();
}

function Icon({ d, size = 16 }: { d: string; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}

const ICONS = {
  bold: "M4 3.5h4.2a2.3 2.3 0 0 1 0 4.6H4zM4 8.1h4.6a2.4 2.4 0 0 1 0 4.8H4z",
  italic: "M6.5 3.5h5M4.5 12.5h5M9.5 3.5l-3 9",
  underline: "M4 3.5v4.2a4 4 0 0 0 8 0V3.5M4 13h8",
  strike: "M3 5.2h10M5.2 3l-.7 2.6M11 13l.8-3M4 8.6c1.6 1.6 6.4 1.6 8-.6",
  h2: "M3 4v8M8 4v8M3 8h5M11 11.5h2.5M11.5 5.5c1.6 0 2.4.9 2.4 2.4 0 1.4-1.1 2.1-2.4 2.1",
  h3: "M3 4v8M8 4v8M3 8h5M11 5.4c1.3-.6 2.6-.1 2.6 1.1 0 1.1-1.3 1.6-2.6 1.1M11 8.4c1.3-.6 2.6-.1 2.6 1.1 0 1.1-1.3 1.6-2.6 1.1",
  paragraph: "M3 4.5h10M3 8h7M3 11.5h10",
  listUl: "M2.5 4h1M2.5 8h1M2.5 12h1M6 4h7.5M6 8h7.5M6 12h7.5",
  listOl: "M3.2 3.6h1.6v3.2M2.6 5.6h2.6M6 4h7.5M3.4 9.2c.9 0 1.4.5 1.4 1.2 0 1-1.4 1.2-1.4 2.1h1.6M6 8h7.5M6 12h7.5",
  quote: "M3 5.5h4.5v4H5.2A2.2 2.2 0 0 1 3 7.3zM9 5.5h4.5v4h-2.3A2.2 2.2 0 0 1 9 7.3zM3 12h10",
  link: "M6.5 9.5a2.5 2.5 0 0 0 3.5 0l2-2a2.5 2.5 0 0 0-3.5-3.5l-1 1M9.5 6.5a2.5 2.5 0 0 0-3.5 0l-2 2a2.5 2.5 0 0 0 3.5 3.5l1-1",
  image: "M2.5 3.5h11v9h-11zM5.5 6.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM12 11 9 7.5 6 11l-1.5-2L2.5 12h11z",
  video: "M2.5 4.5h7v7h-7zM11.5 7l2.5-1.6v5.2L11.5 9z",
  table: "M2.5 3.5h11v9h-11zM2.5 7h11M6.5 7v5.5",
  callout: "M8 2.5l5.5 10h-11zM8 6.4v3M8 11.2v.6",
  hr: "M2.5 8h11",
  undo: "M5 3 2 6l3 3M2 6h6.5a4.5 4.5 0 0 1 0 9H6",
  redo: "M11 3l3 3-3 3M14 6H7.5a4.5 4.5 0 0 0 0 9H10",
  alignStart: "M2.5 4h11M2.5 8h7M2.5 12h9",
  alignCenter: "M2.5 4h11M4.5 8h7M3.5 12h9",
  alignEnd: "M2.5 4h11M6.5 8h7M4.5 12h9",
  eraser: "M3 9.5 6.5 13h7L9 5.5zM6.5 13H4a1.5 1.5 0 0 1 0-3",
  preview: "M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8zM8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  internal: "M3 8.5 6 5.5l3 3M6 5.5v6M13 3.5h-3v3h3z",
};

const HEADINGS: { value: string; label: string }[] = [
  { value: "p", label: "متن" },
  { value: "h2", label: "تیتر ۲" },
  { value: "h3", label: "تیتر ۳" },
  { value: "h4", label: "تیتر ۴" },
];

const CALLOUTS: { value: string; label: string }[] = [
  { value: "info", label: "اطلاع‌رسانی" },
  { value: "success", label: "نکته مثبت" },
  { value: "warning", label: "هشدار" },
  { value: "danger", label: "مهم / خطر" },
];

/** Convert a watch URL (YouTube/Vimeo/Aparat) to its embed URL. */
function toEmbedUrl(url: string): string | null {
  const value = url.trim();
  if (!value) return null;
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    if (host === "youtu.be") {
      const id = parsed.pathname.slice(1);
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
      const id = parsed.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}`;
      if (parsed.pathname.startsWith("/embed/")) return value;
    }
    if (host.endsWith("vimeo.com")) {
      const id = parsed.pathname.split("/").filter(Boolean).pop();
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
    if (host.endsWith("aparat.com")) {
      const id = parsed.pathname.split("/").filter(Boolean).pop();
      return id ? `https://www.aparat.com/video/video/embed/videohash/${id}` : null;
    }
  } catch {
    return null;
  }
  // Already an embed URL the sanitizer will accept.
  return safeEmbedUrl(value);
}

function promptText(message: string, initial: string): string | null {
  if (typeof window === "undefined") return null;
  const value = window.prompt(message, initial);
  return value === null ? null : value;
}

export function PostEditor({ initialContent, internalTargets, contentError }: EditorProps) {
  const editorRef = React.useRef<HTMLDivElement | null>(null);
  const hiddenRef = React.useRef<HTMLTextAreaElement | null>(null);
  const [isEmpty, setIsEmpty] = React.useState(initialContent.trim().length === 0);
  const [showInternalLinks, setShowInternalLinks] = React.useState(false);
  const [showPreview, setShowPreview] = React.useState(false);
  const [previewHtml, setPreviewHtml] = React.useState("");
  const [linkFilter, setLinkFilter] = React.useState("");

  // Keep the hidden submission field in sync (uncontrolled editable area).
  const syncHidden = React.useCallback(() => {
    const html = editorRef.current?.innerHTML ?? "";
    if (hiddenRef.current) hiddenRef.current.value = html;
    const text = editorRef.current?.textContent?.trim() ?? "";
    setIsEmpty(text.length === 0);
  }, []);

  React.useEffect(() => {
    if (hiddenRef.current) hiddenRef.current.value = initialContent;
  }, [initialContent]);

  const run = React.useCallback(
    (fn: () => void) => {
      focusEditor(editorRef);
      fn();
      syncHidden();
    },
    [syncHidden]
  );

  const setBlock = (tag: string) =>
    run(() => exec("formatBlock", tag === "p" ? "p" : tag));

  const setAlign = (align: "start" | "center" | "end") =>
    run(() => {
      const selection = typeof window !== "undefined" ? window.getSelection() : null;
      if (!selection || selection.rangeCount === 0) return;
      const block = blockAncestor(selection.getRangeAt(0).commonAncestorContainer);
      if (!block) return;
      if (align === "start") block.removeAttribute("data-align");
      else block.setAttribute("data-align", align);
    });

  const insertHtml = (html: string) =>
    run(() => {
      exec("insertHTML", html);
    });

  const insertLink = () =>
    run(() => {
      const url = promptText("نشانی لینک را وارد کنید (https:// یا /path):", "https://");
      if (!url) return;
      const safe = safeUrl(url);
      if (!safe) return;
      const selection = typeof window !== "undefined" ? window.getSelection() : null;
      const text = selection && selection.toString().trim()
        ? selection.toString().trim()
        : promptText("متن لینک را وارد کنید:", safe) ?? safe;
      insertHtml(
        `<a href="${safe}" rel="noreferrer noopener"${safe.startsWith("http") ? ' target="_blank"' : ""}>${text.replace(/</g, "&lt;")}</a>`
      );
    });

  const insertImage = () =>
    run(() => {
      const src = promptText("نشانی تصویر را وارد کنید (https://...):", "https://");
      if (!src) return;
      const safe = safeUrl(src);
      if (!safe || !safe.startsWith("http")) return;
      const alt = promptText("متن جایگزین تصویر (توصیف کوتاه — برای سئو و دسترس‌پذیری):", "") ?? "";
      insertHtml(
        `<figure><img src="${safe}" alt="${alt.replace(/"/g, "")}" loading="lazy"><figcaption>${alt.replace(/</g, "&lt;")}</figcaption></figure>`
      );
    });

  const insertVideo = () =>
    run(() => {
      const url = promptText("نشانی ویدیو (یوتیوب، آپارات، ویمئو):", "https://www.youtube.com/watch?v=");
      if (!url) return;
      const embed = toEmbedUrl(url);
      if (!embed) return;
      const title = promptText("عنوان ویدیو:", "ویدیو") ?? "ویدیو";
      insertHtml(
        `<iframe src="${embed}" title="${title.replace(/"/g, "")}" allowfullscreen loading="lazy" allow="fullscreen; encrypted-media; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin"></iframe>`
      );
    });

  const insertTable = () =>
    run(() => {
      insertHtml(
        '<table><thead><tr><th>ستون ۱</th><th>ستون ۲</th></tr></thead><tbody><tr><td>سلول</td><td>سلول</td></tr><tr><td>سلول</td><td>سلول</td></tr></tbody></table>'
      );
    });

  const insertCallout = (kind: string) =>
    run(() => {
      insertHtml(
        `<aside data-callout="${kind}"><p>متن یادداشت را اینجا بنویسید…</p></aside>`
      );
    });

  const insertHr = () => run(() => exec("insertHorizontalRule"));

  const insertInternalLink = (target: InternalLinkTarget) =>
    run(() => {
      insertHtml(
        `<a href="${target.href}">${target.title.replace(/</g, "&lt;")}</a>`
      );
      setShowInternalLinks(false);
      setLinkFilter("");
    });

  const openPreview = () => {
    const html = editorRef.current?.innerHTML ?? "";
    // Sanitize even here: an unsaved draft has never been through the
    // server pass, so the preview must never render raw markup.
    setPreviewHtml(sanitizeHtml(html));
    setShowPreview(true);
  };

  const allTargets = React.useMemo(() => {
    const filter = linkFilter.trim().toLowerCase();
    const groups: { label: string; items: InternalLinkTarget[] }[] = [
      { label: "مقالات", items: internalTargets.posts },
      { label: "دسته‌بندی مقالات", items: internalTargets.blogCategories },
      { label: "محصولات", items: internalTargets.products },
      { label: "دسته‌بندی محصولات", items: internalTargets.productCategories },
    ];
    if (!filter) return groups;
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter((i) => i.title.toLowerCase().includes(filter)),
      }))
      .filter((g) => g.items.length > 0);
  }, [internalTargets, linkFilter]);

  const groups: ToolbarAction[][] = React.useMemo(
    () => [
      [
        { label: "متن", title: "پاراگراف", run: () => setBlock("p"), icon: <Icon d={ICONS.paragraph} /> },
        { label: "تیتر ۲", title: "تیتر دوم", run: () => setBlock("h2"), icon: <span className="text-xs font-bold">H2</span> },
        { label: "تیتر ۳", title: "تیتر سوم", run: () => setBlock("h3"), icon: <span className="text-xs font-bold">H3</span> },
        { label: "تیتر ۴", title: "تیتر چهارم", run: () => setBlock("h4"), icon: <span className="text-xs font-bold">H4</span> },
      ],
      [
        { label: "درشت", title: "بولد", run: () => run(() => exec("bold")), icon: <Icon d={ICONS.bold} /> },
        { label: "کج", title: "ایتالیک", run: () => run(() => exec("italic")), icon: <Icon d={ICONS.italic} /> },
        { label: "زیرخط", title: "آندرلاین", run: () => run(() => exec("underline")), icon: <Icon d={ICONS.underline} /> },
        { label: "خط‌خورده", title: "حذف شده", run: () => run(() => exec("strikeThrough")), icon: <Icon d={ICONS.strike} /> },
      ],
      [
        { label: "لیست نقطه‌ای", title: "فهرست بدون شماره", run: () => run(() => exec("insertUnorderedList")), icon: <Icon d={ICONS.listUl} /> },
        { label: "لیست شماره‌دار", title: "فهرست شماره‌دار", run: () => run(() => exec("insertOrderedList")), icon: <Icon d={ICONS.listOl} /> },
        { label: "نقل‌قول", title: "بلاک‌کوت", run: () => setBlock("blockquote"), icon: <Icon d={ICONS.quote} /> },
        { label: "جداکننده", title: "خط افقی", run: insertHr, icon: <Icon d={ICONS.hr} /> },
      ],
      [
        { label: "راست‌چین", title: "تراز راست", run: () => setAlign("end"), icon: <Icon d={ICONS.alignEnd} /> },
        { label: "وسط‌چین", title: "تراز مرکز", run: () => setAlign("center"), icon: <Icon d={ICONS.alignCenter} /> },
        { label: "چپ‌چین", title: "تراز پیش‌فرض", run: () => setAlign("start"), icon: <Icon d={ICONS.alignStart} /> },
      ],
      [
        { label: "لینک", title: "درج لینک", run: insertLink, icon: <Icon d={ICONS.link} /> },
        { label: "لینک داخلی", title: "لینک به محتوای سایت", run: () => { focusEditor(editorRef); setShowInternalLinks((v) => !v); }, icon: <Icon d={ICONS.internal} /> },
        { label: "تصویر", title: "درج تصویر", run: insertImage, icon: <Icon d={ICONS.image} /> },
        { label: "ویدیو", title: "درج ویدیو (یوتیوب/آپارات)", run: insertVideo, icon: <Icon d={ICONS.video} /> },
        { label: "جدول", title: "درج جدول", run: insertTable, icon: <Icon d={ICONS.table} /> },
        { label: "یادداشت", title: "درج کالاوت", run: () => insertCallout("info"), icon: <Icon d={ICONS.callout} /> },
      ],
      [
        { label: "بازگشت", title: "Undo", run: () => run(() => exec("undo")), icon: <Icon d={ICONS.undo} /> },
        { label: "جلو", title: "Redo", run: () => run(() => exec("redo")), icon: <Icon d={ICONS.redo} /> },
        { label: "پاک‌سازی", title: "حذف قالب‌بندی", run: () => run(() => exec("removeFormat")), icon: <Icon d={ICONS.eraser} /> },
        { label: "پیش‌نمایش", title: "پیش‌نمایش مقاله", run: openPreview, icon: <Icon d={ICONS.preview} /> },
      ],
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [internalTargets]
  );

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-card">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b bg-muted/20 p-2">
        {/* eslint-disable-next-line react-hooks/refs -- the action closures read
            the editor ref lazily, on user click; they never run during render. */}
        {groups.map((group, gi) => (
          <React.Fragment key={gi}>
            {gi > 0 && <span aria-hidden="true" className="mx-1 h-6 w-px bg-border" />}
            {group.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={action.run}
                title={action.title}
                aria-label={action.title}
                className="inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-md px-2 text-foreground/80 transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {action.icon}
                <span className="sr-only">{action.label}</span>
              </button>
            ))}
          </React.Fragment>
        ))}
      </div>

      {/* Internal-link picker */}
      {showInternalLinks && (
        <div className="border-b bg-popover p-3">
          <div className="mx-auto max-w-2xl">
            <input
              type="search"
              value={linkFilter}
              onChange={(e) => setLinkFilter(e.target.value)}
              placeholder="جستجوی مقاله، محصول یا دسته‌بندی…"
              className="mb-2 h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="جستجوی هدف لینک داخلی"
            />
            {allTargets.length === 0 ? (
              <p className="py-3 text-center text-xs text-muted-foreground">
                نتیجه‌ای یافت نشد.
              </p>
            ) : (
              <div className="max-h-56 overflow-auto rounded-md border bg-background">
                {allTargets.map((group) => (
                  <div key={group.label}>
                    <p className="border-b bg-muted/40 px-3 py-1.5 text-[11px] font-semibold text-muted-foreground">
                      {group.label}
                    </p>
                    <ul>
                      {group.items.map((item) => (
                        <li key={item.href}>
                          <button
                            type="button"
                            onClick={() => insertInternalLink(item)}
                            className="flex w-full items-center justify-between gap-3 px-3 py-2 text-start text-sm transition-colors hover:bg-accent"
                          >
                            <span className="min-w-0 truncate text-foreground">{item.title}</span>
                            <span className="shrink-0 text-[11px] text-muted-foreground" dir="ltr">
                              {item.href}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowInternalLinks(false);
                  setLinkFilter("");
                }}
                className="inline-flex h-8 items-center rounded-md border border-input px-3 text-xs font-medium transition-colors hover:bg-accent"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Editable surface */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        role="textbox"
        aria-multiline="true"
        aria-label="محتوای مقاله"
        onInput={syncHidden}
        onBlur={syncHidden}
        className="prose-rtl mx-auto min-h-72 w-full max-w-3xl px-5 py-6 text-sm leading-8 text-foreground focus-visible:outline-none sm:px-8"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(initialContent) }}
      />

      {isEmpty && (
        <p className="px-5 pb-4 text-center text-xs text-muted-foreground sm:px-8">
          شروع به نوشتن کنید… پیش‌نویس را می‌توانید در هر حالتی ذخیره کنید؛ انتشار نیازمند محتوای واقعی است.
        </p>
      )}

      {contentError && (
        <p className="border-t bg-destructive/5 px-5 py-2 text-xs text-destructive" role="alert">
          {contentError}
        </p>
      )}

      <textarea ref={hiddenRef} name="content" className="hidden" aria-hidden="true" readOnly />

      {/* In-console preview (never a public route) */}
      {showPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="پیش‌نمایش مقاله"
        >
          <div className="flex h-auto max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-background shadow-lg">
            <div className="flex items-center justify-between border-b bg-muted/20 px-4 py-3">
              <p className="text-sm font-semibold text-foreground">پیش‌نمایش مقاله</p>
              <button
                type="button"
                onClick={() => setShowPreview(false)}
                className="inline-flex h-8 items-center rounded-md border border-input px-3 text-xs font-medium transition-colors hover:bg-accent"
              >
                بستن پیش‌نمایش
              </button>
            </div>
            <div className="overflow-auto">
              <article
                className="prose-rtl mx-auto w-full max-w-2xl px-6 py-8"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
