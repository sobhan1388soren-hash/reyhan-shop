// Reyhan Navigation — single source for header, mobile, footer
// Persian UI labels; hrefs/slugs remain stable technical identifiers

export type NavItem = {
  label: string;
  href: string;
  description?: string;
};

export type NavSection = {
  label: string;
  href: string;
  items?: NavItem[];
};

// Top-level navigation — used by Header + MobileNav
export const mainNavigation: NavSection[] = [
  { label: "خانه", href: "/" },
  {
    label: "محصولات",
    href: "/products",
    items: [
      {
        label: "دستگاه‌های تصفیه آب",
        href: "/categories/water-purification-devices",
        description: "سیستم‌های تصفیه آب خانگی",
      },
      {
        label: "فیلترها",
        href: "/categories/filters",
        description: "فیلترهای جایگزین",
      },
      {
        label: "قطعات یدکی",
        href: "/categories/spare-parts",
        description: "قطعات و نگهداری",
      },
      {
        label: "لوازم جانبی",
        href: "/categories/accessories",
        description: "تجهیزات و متعلقات",
      },
    ],
  },
  { label: "وبلاگ", href: "/blog" },
  { label: "تماس با ما", href: "/contact" },
];

// Flat list for sitemap / mobile quick links and for footer product links
export const productNavigation: NavItem[] = [
  { label: "دستگاه‌های تصفیه آب", href: "/categories/water-purification-devices" },
  { label: "فیلترها", href: "/categories/filters" },
  { label: "قطعات یدکی", href: "/categories/spare-parts" },
  { label: "لوازم جانبی", href: "/categories/accessories" },
];

export const supportNavigation: NavItem[] = [
  { label: "وبلاگ", href: "/blog" },
  { label: "تماس با ما", href: "/contact" },
  { label: "درباره ما", href: "/about" },
  { label: "سوالات متداول", href: "/faq" },
];

// Footer columns — reusable, no logic
export const footerNavigation = {
  products: productNavigation,
  support: supportNavigation,
} as const;
