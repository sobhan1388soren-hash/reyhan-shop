import * as React from "react";

// Admin nav icons — inline SVG (no icon lib; build-stable, print-clean)

const cls = "size-4.5 shrink-0";

export function AdminIcon({ name }: { name: string }) {
  switch (name) {
    case "dashboard":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className={cls} fill="none">
          <rect x="4" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
          <rect x="13" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
          <rect x="4" y="13" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
          <rect x="13" y="13" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      );
    case "box":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className={cls} fill="none">
          <path d="M12 3.5 20 8v8l-8 4.5L4 16V8l8-4.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M4 8l8 4.5L20 8M12 12.5V20.5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      );
    case "bag":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className={cls} fill="none">
          <path d="M5 8h14l-1 11.5a1.5 1.5 0 0 1-1.5 1.4h-9A1.5 1.5 0 0 1 6 19.5L5 8Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M9 10V7a3 3 0 0 1 6 0v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case "users":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className={cls} fill="none">
          <circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.6" />
          <path d="M3.5 20c.7-3.1 3-4.8 5.5-4.8s4.8 1.7 5.5 4.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M15.5 5.4a3.2 3.2 0 1 1 2.3 5.9M17 15.6c2 .5 3.4 2 4 4.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case "tag":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className={cls} fill="none">
          <path d="M4 4h7.2a1.5 1.5 0 0 1 1.06.44l7.1 7.1a1.5 1.5 0 0 1 0 2.12l-5.2 5.2a1.5 1.5 0 0 1-2.12 0l-7.1-7.1A1.5 1.5 0 0 1 4 10.6V4Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <circle cx="8.4" cy="8.4" r="1.4" fill="currentColor" />
        </svg>
      );
    case "star":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className={cls} fill="none">
          <path d="m12 3.8 2.5 5.1 5.6.8-4 4 .9 5.6-5-2.7-5 2.7.9-5.6-4-4 5.6-.8L12 3.8Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      );
    case "settings":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className={cls} fill="none">
          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
          <path d="M12 4v2m0 12v2m8-8h-2M6 12H4m13.7-5.7-1.4 1.4M7.7 16.3l-1.4 1.4m0-11.4 1.4 1.4m8.6 8.6 1.4 1.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case "sitemap":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className={cls} fill="none">
          <rect x="9" y="3.5" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1.6" />
          <rect x="3.5" y="16.5" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1.6" />
          <rect x="14.5" y="16.5" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1.6" />
          <path d="M12 7.5v4m0 0H6.5v5M12 11.5h5.5v5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "article":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className={cls} fill="none">
          <rect x="4" y="3.5" width="16" height="17" rx="2" stroke="currentColor" strokeWidth="1.6" />
          <path d="M8 8.5h8M8 12h8M8 15.5h4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case "chat":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className={cls} fill="none">
          <path d="M4.5 6.5A2.5 2.5 0 0 1 7 4h10a2.5 2.5 0 0 1 2.5 2.5v6A2.5 2.5 0 0 1 17 15H9.5L5 18.5V15h-.5A2.5 2.5 0 0 1 4.5 12.5v-6Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M8.5 8.5h7M8.5 11.5h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    default:
      return null;
  }
}
