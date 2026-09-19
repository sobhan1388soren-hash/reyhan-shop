import { HomeSectionHeading } from "@/components/home/section-heading";
import { PostCard } from "@/components/blog/post-card";
import type { BlogPostCard } from "@/lib/blog/queries";

// HomeBlogSection — the storefront's knowledge center. Only PUBLISHED posts
// reach this component (the public blog queries enforce it); an empty set
// renders nothing. Reuses the existing PostCard so article cards, dates and
// URLs stay identical to /blog.

export function HomeBlogSection({ posts }: { posts: BlogPostCard[] }) {
  if (posts.length === 0) return null;

  return (
    <section aria-labelledby="home-blog-title" className="border-t bg-muted/30 py-10 sm:py-14">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <HomeSectionHeading
          eyebrow="مرکز دانش"
          id="home-blog-title"
          title="مقالات و آموزش‌های تخصصی"
          description="راهنمای انتخاب، نصب و نگهداری تجهیزات تصفیه آب خانگی — نوشته‌های تخصصی ریحان."
          viewAllHref="/blog"
          viewAllLabel="مشاهده همه مقالات"
        />

        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      </div>
    </section>
  );
}
