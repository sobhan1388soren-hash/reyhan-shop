import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/dal";
import { getAdminPostById, getPostFormContext } from "@/lib/blog/post-service";
import { postStatusLabels, postStatusTones } from "@/lib/admin/labels";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminListErrorState } from "@/components/admin/admin-list";
import { PostForm, draftFromPost } from "@/components/admin/post-form";
import { PostStatusActions } from "@/components/admin/post-status-actions";
import { formatFaDate } from "@/lib/catalog/format";

export const metadata: Metadata = {
  title: "مدیریت مقاله",
};

type PageProps = {
  params: Promise<{ postId: string }>;
};

export default async function EditPostPage({ params }: PageProps) {
  const { postId } = await params;
  await requireAdmin();

  const result = await getAdminPostById(postId);

  if (result.state === "error") {
    return (
      <div>
        <AdminPageHeader title="مدیریت مقاله" />
        <AdminListErrorState onRetryHref="/admin/blog/posts" />
      </div>
    );
  }
  if (result.state === "notFound") notFound();

  const post = result.data;
  const ctx = await getPostFormContext(post.products.map((p) => p.id));
  const hasContent = post.content.replace(/<[^>]*>/g, "").trim().length > 0;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={post.title}
        description={`ایجاد: ${formatFaDate(post.createdAt)} · آخرین به‌روزرسانی: ${formatFaDate(
          post.updatedAt
        )}${post.publishedAt ? ` · انتشار: ${formatFaDate(post.publishedAt)}` : ""}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <AdminStatusBadge tone={postStatusTones[post.status]} className="px-3 py-1 text-xs">
              {postStatusLabels[post.status]}
            </AdminStatusBadge>
            {post.status === "PUBLISHED" && (
              <Link
                href={`/blog/${post.slug}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center rounded-md border border-input bg-background px-4 text-xs font-medium transition-colors hover:bg-accent"
              >
                مشاهده در وبلاگ
              </Link>
            )}
            <Link
              href="/admin/blog/posts"
              className="inline-flex h-9 items-center rounded-md border border-input bg-background px-4 text-xs font-medium transition-colors hover:bg-accent"
            >
              بازگشت
            </Link>
          </div>
        }
      />

      <PostStatusActions postId={post.id} status={post.status} hasContent={hasContent} />

      <PostForm
        mode="edit"
        postId={post.id}
        draft={draftFromPost(post)}
        categories={ctx.categories}
        products={ctx.products}
        authors={ctx.authors}
        relatedSelected={post.products.map((p) => ({ id: p.id, title: p.title, slug: p.slug }))}
        internalTargets={ctx.internalTargets}
      />
    </div>
  );
}
