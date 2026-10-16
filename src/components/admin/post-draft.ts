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

/** Build the editable draft from a loaded admin post detail. */
export function draftFromPost(post: {
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  coverImage: string | null;
  status: string;
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string | null;
  authorId: string | null;
  categories: { id: string }[];
}): PostDraft {
  return {
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt ?? "",
    content: post.content,
    coverImage: post.coverImage ?? "",
    status: post.status,
    seoTitle: post.seoTitle ?? "",
    seoDescription: post.seoDescription ?? "",
    seoKeywords: post.seoKeywords ?? "",
    authorId: post.authorId ?? "",
    categoryIds: post.categories.map((c) => c.id),
  };
}
