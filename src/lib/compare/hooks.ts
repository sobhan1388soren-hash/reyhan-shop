"use client";

import { useEffect, useState, useCallback } from "react";
import {
  readCompareSlugs,
  addCompareSlug,
  removeCompareSlug,
  clearCompare,
  isInCompare,
  COMPARE_STORAGE_KEY,
} from "@/lib/compare/storage";

export function useCompare() {
  const [slugs, setSlugs] = useState<string[]>([]);

  useEffect(() => {
    setSlugs(readCompareSlugs());

    function handleChange() {
      setSlugs(readCompareSlugs());
    }
    window.addEventListener(COMPARE_STORAGE_KEY + "-change", handleChange);
    return () => window.removeEventListener(COMPARE_STORAGE_KEY + "-change", handleChange);
  }, []);

  const dispatchChange = useCallback(() => {
    window.dispatchEvent(new Event(COMPARE_STORAGE_KEY + "-change"));
  }, []);

  function add(slug: string) {
    const result = addCompareSlug(slug);
    dispatchChange();
    return result;
  }

  function remove(slug: string) {
    const updated = removeCompareSlug(slug);
    setSlugs(updated);
    dispatchChange();
  }

  function clear() {
    clearCompare();
    setSlugs([]);
    dispatchChange();
  }

  function checkInCompare(slug: string) {
    return isInCompare(slug);
  }

  return { slugs, add, remove, clear, checkInCompare };
}