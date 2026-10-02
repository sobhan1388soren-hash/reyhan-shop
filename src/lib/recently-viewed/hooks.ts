"use client";

import { useEffect, useState } from "react";
import { readRecentSlugs, addRecentSlug } from "@/lib/recently-viewed/storage";

const RECENTLY_VIEWED_CHANGE_EVENT = "reyhan-recent-change";

export function useRecentlyViewed() {
  const [slugs, setSlugs] = useState<string[]>([]);

  useEffect(() => {
    setSlugs(readRecentSlugs());

    function handleChange() {
      setSlugs(readRecentSlugs());
    }
    window.addEventListener(RECENTLY_VIEWED_CHANGE_EVENT, handleChange);
    return () => window.removeEventListener(RECENTLY_VIEWED_CHANGE_EVENT, handleChange);
  }, []);

  function trackProduct(slug: string) {
    addRecentSlug(slug);
    window.dispatchEvent(new Event(RECENTLY_VIEWED_CHANGE_EVENT));
  }

  return { slugs, trackProduct };
}