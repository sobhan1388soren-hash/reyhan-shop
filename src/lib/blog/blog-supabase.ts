import supabase from "@/lib/supabase";
import type { BlogPostCard } from "./queries";

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  if (!supabase) return fallback;
  try {
    return await fn();
  } catch (e) {
    console.error("[blog.supabase] query failed; returning fallback:", e);
    return fallback;
  }
}

export async function getFeaturedPosts(take = 4): Promise<BlogPostCard[]> {
  return safe(async () => {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from("posts")
      .select(`
        id, title, slug, excerpt, coverImage, publishedAt, status, content,
        author:users(displayName),
        categories:post_category_relations(postCategory:post_categories(id, name, slug))
      `)
      .eq("status", "PUBLISHED")
      .not("publishedAt", "is", null)
      .order("publishedAt", { ascending: false })
      .limit(take);

    if (error || !data) return [];

    return (data as unknown as Array<{
      id: string;
      title: string;
      slug: string;
      excerpt?: string;
      content?: string;
      coverImage?: string;
      publishedAt?: string;
      author?: { displayName?: string };
      categories: Array<{ postCategory: { id: string; name: string; slug: string } }>;
    }>).map((post) => {
      const text = post.content ?? post.excerpt ?? "";
      const readingMinutes = Math.max(1, Math.ceil(text.replace(/\s/g, "").length / 500));
      return {
        id: post.id,
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt ?? null,
        coverImage: post.coverImage ?? null,
        publishedAt: post.publishedAt ? new Date(post.publishedAt) : null,
        readingMinutes,
        categories: post.categories?.map((c) => c.postCategory) ?? [],
        authorName: post.author?.displayName ?? null,
      };
    });
  }, []);
}

export async function getPostBySlug(slug: string) {
  return safe(async () => {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from("posts")
      .select(`
        id, title, slug, excerpt, content, coverImage, publishedAt, status,
        seoTitle, seoDescription, seoKeywords,
        author:users(id, displayName),
        categories:post_category_relations(postCategory:post_categories(id, name, slug))
      `)
      .eq("slug", slug)
      .single();

    if (error || !data) return null;

    const post = data as Record<string, unknown>;
    return {
      id: post.id as string,
      title: post.title as string,
      slug: post.slug as string,
      excerpt: post.excerpt as string | null,
      content: post.content as string,
      coverImage: post.coverImage as string | null,
      publishedAt: post.publishedAt ? new Date(post.publishedAt as string) : null,
      status: post.status as string,
      seoTitle: post.seoTitle as string | null,
      seoDescription: post.seoDescription as string | null,
      seoKeywords: post.seoKeywords as string | null,
      author: post.author as { id: string; displayName: string } | null,
      categories: (
        post.categories as Array<{ postCategory: { id: string; name: string; slug: string } }>
      )?.map((c) => c.postCategory),
    };
  }, null);
}

export async function getPublishedPosts(page = 1, pageSize = 12, categorySlug?: string) {
  return safe(async () => {
    if (!supabase) return { data: [], total: 0 };
    let query = supabase
      .from("posts")
      .select(
        `
        id, title, slug, excerpt, coverImage, publishedAt,
        author:users(displayName),
        categories:post_category_relations(postCategory:post_categories(id, name, slug))
      `,
        { count: "exact" }
      )
      .eq("status", "PUBLISHED")
      .not("publishedAt", "is", null)
      .order("publishedAt", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (categorySlug) {
      const { data: catData } = await supabase
        .from("post_categories")
        .select("id")
        .eq("slug", categorySlug)
        .single();

      if (catData) {
        query = query.eq(
          "post_category_relations.postCategoryId",
          catData.id
        );
      }
    }

    const { data, error, count } = await query;

    if (error || !data) return { data: [], total: 0 };

    return {
      data: (data as unknown as Array<{
        id: string;
        title: string;
        slug: string;
        excerpt?: string;
        content?: string;
        coverImage?: string;
        publishedAt?: string;
        author?: { displayName?: string };
        categories: Array<{ postCategory: { id: string; name: string; slug: string } }>;
      }>).map((post) => {
        const text = post.content ?? post.excerpt ?? "";
        const readingMinutes = Math.max(1, Math.ceil(text.replace(/\s/g, "").length / 500));
        return {
          id: post.id,
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt ?? null,
          coverImage: post.coverImage ?? null,
          publishedAt: post.publishedAt ? new Date(post.publishedAt) : null,
          readingMinutes,
          categories: post.categories?.map((c) => c.postCategory) ?? [],
          authorName: post.author?.displayName ?? null,
        };
      }),
      total: count ?? 0,
    };
  }, { data: [], total: 0 });
}