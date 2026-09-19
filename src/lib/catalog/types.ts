// Catalog foundation — Persian-ready, RTL-safe types
// No fake data, only structure

export type AvailabilityState =
  | "in_stock"
  | "low_stock"
  | "out_of_stock"
  | "unavailable"; // draft/archived/no active variant

export type PriceRange = {
  min: number | null; // Rial
  max: number | null;
  compareAtMin?: number | null;
};

export type CatalogImage = {
  url: string;
  alt: string | null;
};

export type CatalogCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  parentId: string | null;
  level: number;
  status: string;
  sortOrder: number;
  children?: CatalogCategory[];
  productCount?: number;
  createdAt?: Date;
  updatedAt?: Date;
};

export type CatalogVariant = {
  id: string;
  title: string;
  sku: string;
  price: number;
  compareAtPrice: number | null;
  isActive: boolean;
  isDefault: boolean;
  inventory: {
    quantity: number;
    reservedQuantity: number;
    lowStockThreshold: number;
  } | null;
};

export type CatalogSpecification = {
  key: string;
  value: string;
  sortOrder: number;
};

export type CatalogProduct = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  shortDescription: string | null;
  status: string; // ProductStatus
  isFeatured: boolean;
  categories: { id: string; name: string; slug: string }[];
  variants: CatalogVariant[];
  specifications: CatalogSpecification[];
  images: CatalogImage[];
  availability: AvailabilityState;
  priceRange: PriceRange;
  createdAt: Date;
  updatedAt: Date;
};

// Query params — extensible, URL-sync
export type CatalogSortOption =
  | "newest"
  | "oldest"
  | "price_asc"
  | "price_desc"
  | "title_asc"
  | "title_desc";

export type CatalogSearchParams = {
  q?: string; // search term — UTF-8, Persian safe
  category?: string; // slug for direct filter
  categoryPath?: string[]; // hierarchy path segments
  page?: number;
  pageSize?: number;
  sort?: CatalogSortOption;
  minPrice?: number; // Rial
  maxPrice?: number;
  availability?: AvailabilityState[];
  specs?: Record<string, string[]>; // key -> values, extensible from ProductSpecification
  inStock?: boolean; // quick filter
};

export type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

export type PaginatedResult<T> = {
  data: T[];
  meta: PaginationMeta;
};

export type FilterOption = {
  key: string; // spec key or "price" / "availability"
  label: string;
  values: { value: string; label: string; count?: number }[];
};

// Used to build dynamic filter UI from DB specs
export type CatalogFiltersState = {
  specs: Record<string, string[]>;
  priceRange: { min?: number; max?: number };
  availability: AvailabilityState[];
};
