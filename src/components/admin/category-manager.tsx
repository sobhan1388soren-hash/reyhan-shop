"use client";

import * as React from "react";
import { useActionState } from "react";
import {
  buildCategoryTree,
  collectDescendantIds,
  type CategoryTreeNode,
} from "@/lib/admin/category-rules";
import { categoryStatusLabels, categoryStatusTones, type StatusTone } from "@/lib/admin/labels";
import {
  createCategoryAction,
  updateCategoryAction,
  deleteCategoryAction,
  setCategoryStatusAction,
  type CategoryActionState,
} from "@/app/actions/categories";
import {
  CategoryForm,
  draftFromCategory,
  emptyCategoryDraft,
  type CategoryDraft,
  type CategoryFormState,
  type CategoryFormActions,
} from "./category-form";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { toFaDigits } from "@/lib/catalog/format";
import { cn } from "@/lib/utils";

// CategoryManager — hierarchical tree + side detail/create/edit panel.
// Server-rendered data flows in as props; this client island only manages
// selection/form-mode/expansion (no data fetching, no second validation
// authority — the service rules).
//
// Shared by BOTH category trees (catalog products + blog posts): the caller
// injects its own server actions, item-count accessor and Persian copy.

/** Node contract both admin category services already return. */
export type CategoryManagerNode = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  status: string;
  sortOrder: number;
  level: number;
  parentId: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CategoryManagerActions = CategoryFormActions & {
  setStatus: (prev: CategoryFormState, formData: FormData) => Promise<CategoryFormState>;
  delete: (prev: CategoryFormState, formData: FormData) => Promise<CategoryFormState>;
};

export type CategoryManagerLabels = {
  treeTitle: string;
  rootButton: string;
  emptyTitle: string;
  emptyDescription: string;
  emptyAction: string;
  selectPrompt: string;
  selectPromptHint: string;
  itemsLabel: string;
  itemNoun: string;
  deleteBlockedChildren: string;
  deleteBlockedItems: string;
  editTitle: string;
  addChild: string;
};

/** Persian copy for the product-catalog tree (the historical default). */
export const defaultCategoryManagerLabels: CategoryManagerLabels = {
  treeTitle: "ساختار دسته‌بندی‌ها",
  rootButton: "دسته‌بندی ریشه جدید",
  emptyTitle: "هنوز دسته‌بندی‌ای ساخته نشده است",
  emptyDescription:
    "با «دسته‌بندی ریشه جدید» اولین دسته‌بندی فروشگاه را بسازید. زیردسته‌ها را بعداً از همان‌جا اضافه می‌کنید.",
  emptyAction: "ساخت دسته‌بندی",
  selectPrompt: "یک دسته‌بندی را انتخاب کنید",
  selectPromptHint:
    "روی نام هر دسته‌بندی در فهرست بزنید تا جزئیات و عملیات آن اینجا نمایش داده شود.",
  itemsLabel: "محصولات متصل",
  itemNoun: "محصول",
  deleteBlockedChildren:
    "این دسته‌بندی زیردسته دارد و قابل حذف نیست. ابتدا زیردسته‌ها را منتقل کنید یا همین‌جا غیرفعالش کنید.",
  deleteBlockedItems:
    "محصولاتی به این دسته‌بندی متصل‌اند؛ حذف مجاز نیست. برای پنهان‌کردن از فروشگاه آن را غیرفعال کنید.",
  editTitle: "ویرایش دسته‌بندی",
  addChild: "افزودن زیردسته",
};

const productManagerActions: CategoryManagerActions = {
  create: (prev, formData) => createCategoryAction(prev as CategoryActionState, formData),
  update: (prev, formData) => updateCategoryAction(prev as CategoryActionState, formData),
  setStatus: (prev, formData) => setCategoryStatusAction(prev as CategoryActionState, formData),
  delete: (prev, formData) => deleteCategoryAction(prev as CategoryActionState, formData),
};

// Both category trees share the CategoryStatus enum; the generic node keeps
// status as a string, so index the label/tone maps defensively.
function statusLabel(status: string): string {
  return (categoryStatusLabels as Record<string, string>)[status] ?? status;
}
function statusTone(status: string): StatusTone {
  return (categoryStatusTones as Record<string, StatusTone>)[status] ?? "neutral";
}

type TreeEntry<N extends CategoryManagerNode> = {
  depth: number;
  node: CategoryTreeNode<N>;
};

function flatten<N extends CategoryManagerNode>(
  nodes: CategoryTreeNode<N>[],
  depth: number,
  out: TreeEntry<N>[] = []
): TreeEntry<N>[] {
  for (const node of nodes) {
    out.push({ depth, node });
    if (node.children.length > 0) flatten(node.children, depth + 1, out);
  }
  return out;
}

function PencilIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5" fill="none">
      <path d="M11.2 2.8 13.2 4.8 5.6 12.4 2.8 13.2l.8-2.8 7.6-7.6Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5" fill="none">
      <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className={cn("size-3.5 shrink-0 transition-transform", open ? "rotate-90 rtl:-rotate-90" : "rtl:-rotate-180")}
      fill="none"
    >
      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StatusToggleForm({
  category,
  actions,
}: {
  category: CategoryManagerNode;
  actions: CategoryManagerActions;
}) {
  const [state, action, pending] = useActionState<CategoryFormState, FormData>(
    actions.setStatus,
    {}
  );
  const next = category.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="categoryId" value={category.id} />
      <input type="hidden" name="status" value={next} />
      <button
        type="submit"
        disabled={pending}
        className={cn(
          "inline-flex h-9 items-center rounded-md border border-input px-4 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50",
          next === "INACTIVE" ? "text-foreground" : "text-[var(--reyhan-green-700)]"
        )}
      >
        {next === "INACTIVE" ? "غیرفعال کردن" : "فعال کردن"}
      </button>
      {state.error && <p className="text-xs text-destructive" role="alert">{state.error}</p>}
    </form>
  );
}

function DeleteCategoryForm({
  category,
  blockedReason,
  actions,
}: {
  category: CategoryManagerNode;
  blockedReason: string | null;
  actions: CategoryManagerActions;
}) {
  const [armed, setArmed] = React.useState(false);
  const [state, action, pending] = useActionState<CategoryFormState, FormData>(
    actions.delete,
    {}
  );

  if (blockedReason) {
    return (
      <p className="rounded-md bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700" role="note">
        {blockedReason}
      </p>
    );
  }

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!armed) {
          e.preventDefault();
          setArmed(true);
        }
      }}
      className="space-y-1"
    >
      <input type="hidden" name="categoryId" value={category.id} />
      {armed ? (
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">حذف قطعی باشد؟</span>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-8 items-center rounded-md bg-destructive px-3 text-xs font-semibold text-destructive-foreground transition-colors hover:bg-red-600 disabled:opacity-50"
          >
            تأیید حذف
          </button>
          <button
            type="button"
            onClick={() => setArmed(false)}
            className="inline-flex h-8 items-center rounded-md border border-input px-3 text-xs font-medium transition-colors hover:bg-accent"
          >
            انصراف
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setArmed(true)}
          className="inline-flex h-9 items-center rounded-md border border-destructive/30 px-4 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
        >
          حذف دسته‌بندی
        </button>
      )}
      {state.error && <p className="text-xs text-destructive" role="alert">{state.error}</p>}
      {state.message && <p className="text-xs text-[var(--reyhan-green-700)]" role="status">{state.message}</p>}
    </form>
  );
}

export function CategoryManager<N extends CategoryManagerNode>({
  categories,
  getCount,
  actions = productManagerActions,
  labels: labelOverrides,
}: {
  categories: N[];
  /** Direct-item count for a node (products for the catalog tree, posts for the blog tree). */
  getCount: (node: N) => number;
  /** Injected server actions for this tree (defaults to the catalog actions). */
  actions?: CategoryManagerActions;
  /** Persian copy overrides (defaults to the catalog copy). */
  labels?: Partial<CategoryManagerLabels>;
}) {
  const labels = { ...defaultCategoryManagerLabels, ...labelOverrides };
  const tree = React.useMemo(() => buildCategoryTree(categories), [categories]);
  const byId = React.useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [mode, setMode] = React.useState<"view" | "create" | "edit">("view");
  const [draft, setDraft] = React.useState<CategoryDraft>(emptyCategoryDraft);
  const [formKey, setFormKey] = React.useState(0);
  const [collapsed, setCollapsed] = React.useState<Set<string>>(() => new Set());

  const flatAll = React.useMemo(() => flatten(tree, 0), [tree]);
  const flat = React.useMemo(() => {
    // Depth-sorted walk: a collapsed node hides everything deeper until
    // the tree returns to its own depth.
    const out: TreeEntry<N>[] = [];
    let skipDepth = Number.POSITIVE_INFINITY;
    for (const entry of flatAll) {
      if (entry.depth > skipDepth) continue;
      skipDepth = Number.POSITIVE_INFINITY;
      out.push(entry);
      if (collapsed.has(entry.node.id) && entry.node.children.length > 0) {
        skipDepth = entry.depth;
      }
    }
    return out;
  }, [flatAll, collapsed]);

  const selected = selectedId ? byId.get(selectedId) ?? null : null;

  const openCreate = (parentId: string | null) => {
    setDraft({ ...emptyCategoryDraft, parentId: parentId ?? "" });
    setMode("create");
    setFormKey((k) => k + 1);
    if (parentId) setSelectedId(parentId);
  };

  const openEdit = (category: N) => {
    setDraft(draftFromCategory(category));
    setMode("edit");
    setFormKey((k) => k + 1);
    setSelectedId(category.id);
  };

  const closeForm = () => {
    setMode("view");
    setDraft(emptyCategoryDraft);
  };

  const toggleCollapsed = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const childCounts = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of categories) {
      if (c.parentId) counts.set(c.parentId, (counts.get(c.parentId) ?? 0) + 1);
    }
    return counts;
  }, [categories]);

  const deleteBlockReason = React.useMemo(() => {
    if (!selected) return null;
    if ((childCounts.get(selected.id) ?? 0) > 0) return labels.deleteBlockedChildren;
    if (getCount(selected) > 0) return labels.deleteBlockedItems;
    return null;
  }, [selected, childCounts, labels, getCount]);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      {/* Tree column */}
      <div className="min-w-0 overflow-hidden rounded-xl border bg-card shadow-card">
        <div className="flex items-center justify-between gap-3 border-b bg-muted/20 p-4">
          <p className="text-sm font-semibold text-foreground">{labels.treeTitle}</p>
          <button
            type="button"
            onClick={() => openCreate(null)}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-[var(--reyhan-blue-700)]"
          >
            <PlusIcon />
            {labels.rootButton}
          </button>
        </div>

        {flat.length === 0 ? (
          <div className="p-6">
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card px-6 py-12 text-center">
              <p className="text-sm font-semibold text-foreground">{labels.emptyTitle}</p>
              <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
                {labels.emptyDescription}
              </p>
              <button
                type="button"
                onClick={() => openCreate(null)}
                className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-[var(--reyhan-blue-700)]"
              >
                <PlusIcon />
                {labels.emptyAction}
              </button>
            </div>
          </div>
        ) : (
          <ul aria-label="درخت دسته‌بندی‌ها" className="divide-y">
            {flat.map(({ depth, node }) => {
              const hasChildren = node.children.length > 0;
              const isCollapsed = collapsed.has(node.id);
              const isSelected = selectedId === node.id;
              return (
                <li key={node.id}>
                  <div
                    className={cn(
                      "flex items-center gap-1 p-2 transition-colors hover:bg-accent/40",
                      isSelected && "bg-[var(--reyhan-blue-50)]/60"
                    )}
                    style={{ paddingInlineStart: `${0.5 + depth * 1.25}rem` }}
                  >
                    {hasChildren ? (
                      <button
                        type="button"
                        onClick={() => toggleCollapsed(node.id)}
                        aria-label={isCollapsed ? `باز کردن زیردسته‌های ${node.name}` : `بستن زیردسته‌های ${node.name}`}
                        aria-expanded={!isCollapsed}
                        className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <ChevronIcon open={!isCollapsed} />
                      </button>
                    ) : (
                      <span aria-hidden="true" className="inline-flex size-7 shrink-0 items-center justify-center text-muted-foreground/40">
                        •
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(node.id);
                        if (mode !== "view") closeForm();
                      }}
                      className="min-w-0 flex-1 rounded-md px-1 py-1 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-current={isSelected ? "true" : undefined}
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="min-w-0 truncate text-sm font-medium text-foreground">{node.name}</span>
                        {node.status !== "ACTIVE" && (
                          <AdminStatusBadge tone={statusTone(node.status)}>
                            {statusLabel(node.status)}
                          </AdminStatusBadge>
                        )}
                        {getCount(node) > 0 && (
                          <span className="text-[11px] tabular-nums text-muted-foreground">
                            {toFaDigits(getCount(node))} {labels.itemNoun}
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-muted-foreground" dir="ltr">
                        /{node.slug}
                      </span>
                    </button>

                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openCreate(node.id)}
                        title="افزودن زیردسته"
                        aria-label={`افزودن زیردسته برای ${node.name}`}
                        className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <PlusIcon />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(node)}
                        title="ویرایش"
                        aria-label={`ویرایش ${node.name}`}
                        className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <PencilIcon />
                      </button>
                    </div>
                  </div>
                  {hasChildren && isCollapsed && (
                    <p className="pb-2 text-[11px] text-muted-foreground" style={{ paddingInlineStart: `${1.75 + depth * 1.25}rem` }}>
                      {toFaDigits(node.children.length)} زیردسته پنهان
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Detail / form column */}
      <div className="min-w-0 space-y-6">
        {mode === "create" || mode === "edit" ? (
          <div className="rounded-xl border bg-card p-5 shadow-card sm:p-6">
            <h2 className="mb-4 text-base font-semibold text-foreground">
              {mode === "edit"
                ? labels.editTitle
                : draft.parentId && byId.get(draft.parentId)
                  ? `افزودن زیردسته برای «${byId.get(draft.parentId)!.name}»`
                  : labels.rootButton}
            </h2>
            <CategoryForm
              key={`${mode}-${formKey}`}
              draft={draft}
              allCategories={categories}
              onCancel={closeForm}
              onSaved={closeForm}
              actions={actions}
            />
          </div>
        ) : selected ? (
          (() => {
            const parent = selected.parentId ? byId.get(selected.parentId) : null;
            const directChildren = childCounts.get(selected.id) ?? 0;
            const totalDescendants = collectDescendantIds(categories, selected.id).size;
            return (
              <div className="rounded-xl border bg-card p-5 shadow-card sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-bold text-foreground">{selected.name}</h2>
                    <p className="mt-0.5 text-xs text-muted-foreground" dir="ltr">
                      /{selected.slug}
                    </p>
                  </div>
                  <AdminStatusBadge tone={statusTone(selected.status)} className="px-3 py-1 text-xs">
                    {statusLabel(selected.status)}
                  </AdminStatusBadge>
                </div>

                <dl className="mt-5 space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-muted-foreground">والد</dt>
                    <dd className="min-w-0 truncate font-medium text-foreground">
                      {parent ? parent.name : "— (ریشه)"}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-muted-foreground">ترتیب نمایش</dt>
                    <dd className="tabular-nums font-medium text-foreground">{toFaDigits(selected.sortOrder)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-muted-foreground">زیردسته‌ها</dt>
                    <dd className="tabular-nums font-medium text-foreground">
                      {directChildren === 0
                        ? "بدون زیردسته"
                        : `${toFaDigits(directChildren)} مستقیم${totalDescendants > directChildren ? ` · ${toFaDigits(totalDescendants)} کل زیرمجموعه` : ""}`}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-muted-foreground">{labels.itemsLabel}</dt>
                    <dd className="tabular-nums font-medium text-foreground">{toFaDigits(getCount(selected))}</dd>
                  </div>
                  {selected.description && (
                    <div>
                      <dt className="text-muted-foreground">توضیح کوتاه</dt>
                      <dd className="mt-1 rounded-lg bg-muted/40 px-3 py-2 leading-6 text-foreground">
                        {selected.description}
                      </dd>
                    </div>
                  )}
                  {selected.image && (
                    <div className="flex items-center justify-between gap-4">
                      <dt className="shrink-0 text-muted-foreground">تصویر</dt>
                      <dd className="min-w-0 truncate text-xs" dir="ltr" title={selected.image}>
                        {selected.image}
                      </dd>
                    </div>
                  )}
                  {(selected.seoTitle || selected.seoDescription) && (
                    <div>
                      <dt className="text-muted-foreground">سئو</dt>
                      <dd className="mt-1 space-y-1 rounded-lg bg-muted/40 px-3 py-2 text-xs leading-6">
                        {selected.seoTitle && <p className="font-medium text-foreground">{selected.seoTitle}</p>}
                        {selected.seoDescription && (
                          <p className="text-muted-foreground">{selected.seoDescription}</p>
                        )}
                      </dd>
                    </div>
                  )}
                </dl>

                <div className="mt-6 space-y-3 border-t pt-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(selected)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-[var(--reyhan-blue-700)]"
                    >
                      <PencilIcon />
                      {labels.editTitle}
                    </button>
                    <button
                      type="button"
                      onClick={() => openCreate(selected.id)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-background px-4 text-xs font-medium transition-colors hover:bg-accent"
                    >
                      <PlusIcon />
                      {labels.addChild}
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <StatusToggleForm category={selected} actions={actions} />
                    <DeleteCategoryForm
                      category={selected}
                      blockedReason={deleteBlockReason}
                      actions={actions}
                    />
                  </div>
                </div>
              </div>
            );
          })()
        ) : (
          <div className="flex h-full min-h-40 flex-col items-center justify-center rounded-xl border border-dashed bg-card p-6 text-center">
            <p className="text-sm font-semibold text-foreground">{labels.selectPrompt}</p>
            <p className="mt-1 max-w-xs text-sm leading-6 text-muted-foreground">
              {labels.selectPromptHint}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
