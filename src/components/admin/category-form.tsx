"use client";

import * as React from "react";
import { useActionState } from "react";
import {
  createCategoryAction,
  updateCategoryAction,
  type CategoryActionState,
} from "@/app/actions/categories";
import {
  normalizeCategorySlug,
  CATEGORY_NAME_MAX,
  CATEGORY_SLUG_MAX,
  CATEGORY_DESCRIPTION_MAX,
  CATEGORY_SEO_TITLE_MAX,
  CATEGORY_SEO_DESCRIPTION_MAX,
} from "@/lib/admin/category-rules";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// CategoryForm — create/edit form for one category. Server actions are
// authoritative (validateCategoryInput in the service); the HTML constraints
// here are UX only. Slug is auto-derived from the name until the admin
// edits it by hand (same normalization as the server — single system).
//
// The same form serves BOTH category trees (catalog products + blog posts):
// the caller injects its own server actions. The pure validation, hierarchy
// helpers and this UI are shared — one category system, two trees.

/** Minimal action-state contract both category action modules satisfy. */
export type CategoryFormState = {
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
};

export type CategoryFormActions = {
  create: (prev: CategoryFormState, formData: FormData) => Promise<CategoryFormState>;
  update: (prev: CategoryFormState, formData: FormData) => Promise<CategoryFormState>;
};

/** Shape the parent-options list needs (both node types satisfy it). */
export type CategoryOptionNode = {
  id: string;
  name: string;
  level: number;
  parentId: string | null;
};

export type CategoryFormNode = CategoryOptionNode & {
  slug: string;
  description: string | null;
  image: string | null;
  status: string;
  sortOrder: number;
  seoTitle: string | null;
  seoDescription: string | null;
};

const productActions: CategoryFormActions = {
  create: createCategoryAction,
  update: updateCategoryAction,
};

export type CategoryDraft = {
  mode: "create" | "edit";
  categoryId?: string;
  name: string;
  slug: string;
  parentId: string;
  description: string;
  image: string;
  status: string;
  sortOrder: string;
  seoTitle: string;
  seoDescription: string;
};

export const emptyCategoryDraft: CategoryDraft = {
  mode: "create",
  name: "",
  slug: "",
  parentId: "",
  description: "",
  image: "",
  status: "ACTIVE",
  sortOrder: "0",
  seoTitle: "",
  seoDescription: "",
};

export function draftFromCategory<N extends CategoryFormNode>(category: N): CategoryDraft {
  return {
    mode: "edit",
    categoryId: category.id,
    name: category.name,
    slug: category.slug,
    parentId: category.parentId ?? "",
    description: category.description ?? "",
    image: category.image ?? "",
    status: category.status,
    sortOrder: String(category.sortOrder),
    seoTitle: category.seoTitle ?? "",
    seoDescription: category.seoDescription ?? "",
  };
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-destructive">{message}</p>;
}

function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-foreground">
      {children}
    </label>
  );
}

export function CategoryForm({
  draft: initialDraft,
  allCategories,
  onCancel,
  onSaved,
  actions = productActions,
}: {
  draft: CategoryDraft;
  /** All categories (for parent options; self/descendants are excluded here for UX; the server re-checks). */
  allCategories: CategoryOptionNode[];
  onCancel: () => void;
  onSaved: () => void;
  /** Injected server actions (catalog or blog). Defaults to the catalog actions. */
  actions?: CategoryFormActions;
}) {
  const isEdit = initialDraft.mode === "edit";
  const [state, action, pending] = useActionState<CategoryFormState, FormData>(
    isEdit ? actions.update : actions.create,
    {}
  );

  const [name, setName] = React.useState(initialDraft.name);
  const [slug, setSlug] = React.useState(initialDraft.slug);
  const [slugTouched, setSlugTouched] = React.useState(isEdit && Boolean(initialDraft.slug));

  const effectiveSlug = slugTouched ? slug : normalizeCategorySlug(name);

  // Parent options: exclude the edited category and its descendants (UX
  // only — validateParentAssignment in the service is authoritative).
  const parentOptions = React.useMemo(() => {
    const excluded = new Set<string>();
    if (isEdit && initialDraft.categoryId) {
      excluded.add(initialDraft.categoryId);
      const queue = [initialDraft.categoryId];
      while (queue.length) {
        const parent = queue.shift()!;
        for (const c of allCategories) {
          if (c.parentId === parent && !excluded.has(c.id)) {
            excluded.add(c.id);
            queue.push(c.id);
          }
        }
      }
    }
    return allCategories.filter((c) => !excluded.has(c.id));
  }, [allCategories, isEdit, initialDraft.categoryId]);

  const justSaved = state.message != null && !pending;
  React.useEffect(() => {
    if (justSaved) {
      onSaved();
      const timer = setTimeout(() => onCancel(), 500);
      return () => clearTimeout(timer);
    }
  }, [justSaved, onCancel, onSaved]);

  return (
    <form action={action} className="space-y-4">
      {isEdit && <input type="hidden" name="categoryId" value={initialDraft.categoryId} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="c-name">نام دسته‌بندی</Label>
          <Input
            id="c-name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={CATEGORY_NAME_MAX}
            required
          />
          <FieldError message={state.fieldErrors?.name} />
        </div>
        <div>
          <Label htmlFor="c-slug">
            اسلاگ (نشانی آدرس){" "}
            <span className="font-normal text-muted-foreground">(اختیاری — از نام ساخته می‌شود)</span>
          </Label>
          <Input
            id="c-slug"
            name="slug"
            dir="ltr"
            className="text-start"
            value={effectiveSlug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
            maxLength={CATEGORY_SLUG_MAX}
            placeholder="water-filter-parts"
          />
          <FieldError message={state.fieldErrors?.slug} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <Label htmlFor="c-parent">دسته‌بندی والد</Label>
          <select
            id="c-parent"
            name="parentId"
            defaultValue={initialDraft.parentId}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">— بدون والد (ریشه) —</option>
            {parentOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {`${"— ".repeat(Math.min(c.level, 5))}${c.name}`}
              </option>
            ))}
          </select>
          <FieldError message={state.fieldErrors?.parentId} />
        </div>
        <div>
          <Label htmlFor="c-sort">ترتیب نمایش</Label>
          <Input
            id="c-sort"
            name="sortOrder"
            inputMode="numeric"
            dir="ltr"
            className="text-center"
            defaultValue={initialDraft.sortOrder}
          />
          <FieldError message={state.fieldErrors?.sortOrder} />
        </div>
      </div>

      <div>
        <Label htmlFor="c-status">وضعیت</Label>
        <select
          id="c-status"
          name="status"
          defaultValue={initialDraft.status}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-56"
        >
          <option value="ACTIVE">فعال (نمایش در فروشگاه)</option>
          <option value="INACTIVE">غیرفعال (پنهان از فروشگاه)</option>
        </select>
      </div>

      <div>
        <Label htmlFor="c-desc">توضیح کوتاه</Label>
        <textarea
          id="c-desc"
          name="description"
          rows={3}
          maxLength={CATEGORY_DESCRIPTION_MAX}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          defaultValue={initialDraft.description}
        />
        <FieldError message={state.fieldErrors?.description} />
      </div>

      <div>
        <Label htmlFor="c-image">
          آدرس تصویر <span className="font-normal text-muted-foreground">(URL — آپلود فایل در این فاز فعال نیست)</span>
        </Label>
        <Input
          id="c-image"
          name="image"
          type="url"
          dir="ltr"
          className="text-start"
          placeholder="https://…"
          defaultValue={initialDraft.image}
        />
        <FieldError message={state.fieldErrors?.image} />
      </div>

      <fieldset className="rounded-lg border border-dashed p-4">
        <legend className="px-1 text-xs font-semibold text-muted-foreground">سئو (اختیاری)</legend>
        <div className="space-y-4">
          <div>
            <Label htmlFor="c-seo-title">عنوان سئو</Label>
            <Input
              id="c-seo-title"
              name="seoTitle"
              maxLength={CATEGORY_SEO_TITLE_MAX}
              placeholder={name || "همان نام دسته‌بندی"}
              defaultValue={initialDraft.seoTitle}
            />
            <FieldError message={state.fieldErrors?.seoTitle} />
          </div>
          <div>
            <Label htmlFor="c-seo-desc">توضیح سئو (meta description)</Label>
            <Input
              id="c-seo-desc"
              name="seoDescription"
              maxLength={CATEGORY_SEO_DESCRIPTION_MAX}
              defaultValue={initialDraft.seoDescription}
            />
            <FieldError message={state.fieldErrors?.seoDescription} />
          </div>
        </div>
      </fieldset>

      {state.message && (
        <p
          className="rounded-md bg-[var(--reyhan-green-50)] px-3 py-2 text-sm text-[var(--reyhan-green-700)]"
          role="status"
        >
          {state.message}
        </p>
      )}
      {state.error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-[var(--reyhan-blue-700)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "در حال ذخیره…" : isEdit ? "ذخیره تغییرات" : "ثبت دسته‌بندی"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className={cn(
            "inline-flex h-10 items-center justify-center rounded-md border border-input px-5 text-sm font-medium transition-colors hover:bg-accent"
          )}
        >
          انصراف
        </button>
      </div>
    </form>
  );
}
