"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import {
  createPostAction,
  updatePostAction,
  type PostActionState,
} from "@/app/actions/blog-posts";
import {
  POST_TITLE_MAX,
  POST_SLUG_MAX,
  POST_EXCERPT_MAX,
  POST_SEO_TITLE_MAX,
  POST_SEO_DESCRIPTION_MAX,
  POST_SEO_KEYWORDS_MAX,
  POST_COVER_IMAGE_MAX,
  POST_RELATED_PRODUCTS_MAX,
  POST_STATUSES,
  normalizePostSlug,
} from "@/lib/blog/post-rules";
import { postStatusLabels } from "@/lib/admin/labels";
import type { AdminPostCategoryNode, PostAuthorOption } from "@/lib/blog/category-service";
import type { PostProductOption, InternalLinkTarget } from "@/lib/blog/post-service";
import { Input } from "@/components/ui/input";
import {
  AdminField,
  AdminFieldError,
  AdminFormSection,
  AdminFormFeedback,
  AdminSubmitButton,
  adminSelectClass,
  adminTextareaClass,
} from "@/components/admin/admin-form";
import { PostEditor } from "@/components/admin/post-editor";
import {
  PostRelatedProducts,
  type SelectedProduct,
} from "@/components/admin/post-related-products";
import { buildCategoryTree, type CategoryTreeNode } from "@/lib/admin/category-rules";
import { cn } from "@/lib/utils";

// PostForm — create/edit an article. Server-side validation is
// authoritative (validatePostInput in the pure rules + relation checks in
// the service); HTML constraints here are UX only. On a successful CREATE
// the browser moves to the edit URL so the admin keeps editing the saved
// post instead of re-submitting a duplicate.

export type PostDraft = {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string;
  status: string;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  authorId: string;
  categoryIds: string[];
};

export function emptyPostDraft(): PostDraft {
  return {
    title: "",
    slug: "",
    excerpt: "",
    content: "",
    coverImage: "",
    status: "DRAFT",
    seoTitle: "",
    seoDescription: "",
    seoKeywords: "",
    authorId: "",
    categoryIds: [],
  };
}

type FlatCategory = { depth: number; node: CategoryTreeNode<AdminPostCategoryNode> };

function flattenCategories(
  nodes: CategoryTreeNode<AdminPostCategoryNode>[],
  depth: number,
  out: FlatCategory[] = []
): FlatCategory[] {
  for (const node of nodes) {
    out.push({ depth, node });
    if (node.children.length > 0) flattenCategories(node.children, depth + 1, out);
  }
  return out;
}

export function PostForm({
  mode,
  postId,
  draft,
  categories,
  products,
  authors,
  relatedSelected,
  internalTargets,
}: {
  mode: "create" | "edit";
  postId?: string;
  draft: PostDraft;
  categories: AdminPostCategoryNode[];
  products: PostProductOption[];
  authors: PostAuthorOption[];
  relatedSelected: SelectedProduct[];
  internalTargets: {
    posts: InternalLinkTarget[];
    blogCategories: InternalLinkTarget[];
    products: InternalLinkTarget[];
    productCategories: InternalLinkTarget[];
  };
}) {
  const isEdit = mode === "edit";
  const router = useRouter();
  const [state, action, pending] = useActionState<PostActionState, FormData>(
    isEdit ? updatePostAction : createPostAction,
    {}
  );

  const [title, setTitle] = React.useState(draft.title);
  const [slug, setSlug] = React.useState(draft.slug);
  const [slugTouched, setSlugTouched] = React.useState(isEdit && Boolean(draft.slug));
  const [checkedCategories, setCheckedCategories] = React.useState<Set<string>>(
    () => new Set(draft.categoryIds)
  );

  const effectiveSlug = slugTouched ? slug : normalizePostSlug(title);
  const flatCategories = React.useMemo(
    () => flattenCategories(buildCategoryTree(categories), 0),
    [categories]
  );

  // After a successful create, switch to the edit URL for the new post.
  React.useEffect(() => {
    if (!isEdit && state.postId) {
      router.replace(`/admin/blog/posts/${state.postId}`);
    }
  }, [isEdit, state.postId, router]);

  const toggleCategory = (id: string) => {
    setCheckedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <form action={action} className="space-y-6">
      {isEdit && <input type="hidden" name="postId" value={postId} />}

      <AdminFormSection
        title="مقاله"
        description="عنوان، خلاصه و محتوای اصلی مقاله. پیش‌نویس در هر حالتی ذخیره می‌شود؛ برای انتشار باید محتوای واقعی داشته باشد."
      >
        <AdminField id="p-title" label="عنوان مقاله" error={state.fieldErrors?.title}>
          <Input
            id="p-title"
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={POST_TITLE_MAX}
            placeholder="مثلاً: نحوه تعویض فیلتر تصفیه آب خانگی"
            required
          />
        </AdminField>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <AdminField
            id="p-slug"
            label="اسلاگ"
            hint="(اختیاری — از عنوان ساخته می‌شود)"
            error={state.fieldErrors?.slug}
          >
            <Input
              id="p-slug"
              name="slug"
              dir="ltr"
              className="text-start"
              value={effectiveSlug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              maxLength={POST_SLUG_MAX}
              placeholder="water-filter-guide"
            />
          </AdminField>
          <AdminField
            id="p-cover"
            label="تصویر کاور"
            hint="(URL — آپلود فایل در این فاز فعال نیست)"
            error={state.fieldErrors?.coverImage}
          >
            <Input
              id="p-cover"
              name="coverImage"
              type="url"
              dir="ltr"
              className="text-start"
              defaultValue={draft.coverImage}
              maxLength={POST_COVER_IMAGE_MAX}
              placeholder="https://…"
            />
          </AdminField>
        </div>

        <AdminField
          id="p-excerpt"
          label="خلاصه مقاله"
          hint="(اختیاری — برای کارت‌ها و توضیح متا)"
          error={state.fieldErrors?.excerpt}
          className="mt-4"
        >
          <textarea
            id="p-excerpt"
            name="excerpt"
            rows={3}
            maxLength={POST_EXCERPT_MAX}
            className={adminTextareaClass}
            defaultValue={draft.excerpt}
            placeholder="یک یا دو جمله درباره محتوای مقاله."
          />
        </AdminField>

        <div className="mt-6">
          <p className="mb-1.5 text-sm font-medium text-foreground">محتوای مقاله</p>
          <PostEditor
            initialContent={draft.content}
            internalTargets={internalTargets}
            contentError={state.fieldErrors?.content}
          />
        </div>
      </AdminFormSection>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <AdminFormSection title="دسته‌بندی‌ها" description="یک تا چند دسته‌بندی برای این مقاله انتخاب کنید.">
            {flatCategories.length === 0 ? (
              <p className="rounded-lg border border-dashed bg-muted/20 px-3 py-6 text-center text-xs leading-6 text-muted-foreground">
                هنوز دسته‌بندی مقاله‌ای ساخته نشده است. می‌توانید بدون دسته‌بندی ذخیره کنید یا
                ابتدا از بخش «دسته‌بندی مقالات» بسازید.
              </p>
            ) : (
              <div className="max-h-64 overflow-auto rounded-lg border bg-background">
                <ul className="divide-y">
                  {flatCategories.map(({ depth, node }) => {
                    const checked = checkedCategories.has(node.id);
                    return (
                      <li key={node.id}>
                        <label
                          className="flex cursor-pointer items-center gap-2.5 px-3 py-2.5 text-sm transition-colors hover:bg-accent/40"
                          style={{ paddingInlineStart: `${0.75 + depth * 1.1}rem` }}
                        >
                          <input
                            type="checkbox"
                            name="categoryId"
                            value={node.id}
                            checked={checked}
                            onChange={() => toggleCategory(node.id)}
                            className="size-4 accent-[var(--reyhan-blue-600)]"
                          />
                          <span className="min-w-0 truncate text-foreground">{node.name}</span>
                          {node.status !== "ACTIVE" && (
                            <span className="shrink-0 text-[11px] text-muted-foreground">(غیرفعال)</span>
                          )}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            <AdminFieldError message={state.fieldErrors?.categoryIds} />
          </AdminFormSection>

          <AdminFormSection
            title="محصولات مرتبط"
            description="محصولات واقعی فروشگاه را به‌صورت دستی و به ترتیب دلخواه به این مقاله متصل کنید."
          >
            <PostRelatedProducts
              selected={relatedSelected}
              options={products}
              limit={POST_RELATED_PRODUCTS_MAX}
              error={state.fieldErrors?.products}
            />
          </AdminFormSection>

          <AdminFormSection
            title="سئو (اختیاری)"
            description="در صورت خالی بودن، از عنوان و خلاصه مقاله استفاده می‌شود."
          >
            <div className="space-y-4">
              <AdminField
                id="p-seo-title"
                label="عنوان سئو"
                error={state.fieldErrors?.seoTitle}
              >
                <Input
                  id="p-seo-title"
                  name="seoTitle"
                  maxLength={POST_SEO_TITLE_MAX}
                  placeholder={title || "همان عنوان مقاله"}
                  defaultValue={draft.seoTitle}
                />
              </AdminField>
              <AdminField
                id="p-seo-desc"
                label="توضیح سئو (meta description)"
                error={state.fieldErrors?.seoDescription}
              >
                <textarea
                  id="p-seo-desc"
                  name="seoDescription"
                  rows={2}
                  maxLength={POST_SEO_DESCRIPTION_MAX}
                  className={adminTextareaClass}
                  defaultValue={draft.seoDescription}
                />
              </AdminField>
              <AdminField
                id="p-seo-keywords"
                label="کلمات کلیدی"
                hint="(با کاما جدا کنید)"
                error={state.fieldErrors?.seoKeywords}
              >
                <Input
                  id="p-seo-keywords"
                  name="seoKeywords"
                  maxLength={POST_SEO_KEYWORDS_MAX}
                  dir="ltr"
                  className="text-start"
                  defaultValue={draft.seoKeywords}
                  placeholder="water filter, تصفیه آب"
                />
              </AdminField>
            </div>
          </AdminFormSection>
        </div>

        <div className="space-y-6">
          <AdminFormSection title="انتشار">
            <AdminField id="p-status" label="وضعیت" error={state.fieldErrors?.status}>
              <select
                id="p-status"
                name="status"
                defaultValue={draft.status}
                className={adminSelectClass}
              >
                {POST_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {postStatusLabels[status]}
                  </option>
                ))}
              </select>
            </AdminField>
            <AdminField
              id="p-author"
              label="نویسنده"
              hint="(اختیاری)"
              error={state.fieldErrors?.authorId}
              className="mt-4"
            >
              <select
                id="p-author"
                name="authorId"
                defaultValue={draft.authorId}
                className={adminSelectClass}
              >
                <option value="">— انتخاب نویسنده —</option>
                {authors.map((author) => (
                  <option key={author.id} value={author.id}>
                    {author.name}
                  </option>
                ))}
              </select>
            </AdminField>
            <p className="mt-4 rounded-md bg-muted/40 px-3 py-2 text-xs leading-6 text-muted-foreground">
              انتشار نیازمند محتوای واقعی است؛ پیش‌نویس و بایگانی در هر حالتی ذخیره می‌شوند.
            </p>
          </AdminFormSection>

          <AdminFormFeedback message={state.message} error={state.error} />

          <div className="flex flex-wrap items-center gap-3">
            <AdminSubmitButton pending={pending}>
              {pending ? "در حال ذخیره..." : isEdit ? "ذخیره تغییرات" : "ذخیره مقاله"}
            </AdminSubmitButton>
            <button
              type="button"
              onClick={() => router.push("/admin/blog/posts")}
              className={cn(
                "inline-flex h-10 items-center justify-center rounded-md border border-input px-5 text-sm font-medium transition-colors hover:bg-accent"
              )}
            >
              بازگشت به فهرست
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
