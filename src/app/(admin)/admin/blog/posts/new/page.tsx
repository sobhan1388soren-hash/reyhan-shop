import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/dal";
import { getPostFormContext } from "@/lib/blog/post-service";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { PostForm, emptyPostDraft } from "@/components/admin/post-form";

export const metadata: Metadata = {
  title: "مقاله جدید",
};

export default async function NewPostPage() {
  await requireAdmin();
  const ctx = await getPostFormContext();

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="مقاله جدید"
        description="یک مقاله تخصصی برای مرکز دانش ریحان بنویسید. پیش‌نویس در هر حالتی ذخیره می‌شود؛ انتشار نیازمند محتوای واقعی است."
      />
      <PostForm
        mode="create"
        draft={emptyPostDraft()}
        categories={ctx.categories}
        products={ctx.products}
        authors={ctx.authors}
        relatedSelected={[]}
        internalTargets={ctx.internalTargets}
      />
    </div>
  );
}
