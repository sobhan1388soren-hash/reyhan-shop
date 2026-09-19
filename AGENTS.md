# reyhan-web

Next.js 16 + React 19 + TypeScript + Tailwind CSS v4 e-commerce project using App Router.

## Stack

- **Next.js 16** — App Router mode. Check `node_modules/next/dist/docs/` for version-specific guidance before implementing unfamiliar APIs.
- **React 19** — strict mode enabled in `tsconfig.json`.
- **TypeScript** — paths: `@/` → `./src/` (configured in `tsconfig.json`).
- **Tailwind CSS v4** — major version; class names and config schema differ from v3.
- **ESLint** — extends `eslint-config-next` (core-vitals + typescript).

## Commands

| Action | Command |
|--------|---------|
| Start dev server | `npm run dev` |
| Build for production | `npm run build` |
| Start production server | `npm run start` |
| Lint | `npm run lint` |
| Type-check | `npm run type-check` |
| All logic tests | `npm run test` |
| Checkout tests | `npm run test:checkout` |
| Payments tests | `npm run test:payments` |
## Tests

- Pure-logic tests via `node --test` + TS type-stripping (no DB, no framework).
- Existing suites: `src/lib/checkout/checkout.test.mjs`, `src/lib/payments/payments.test.mjs`.
- `.mjs` test files must stay pure JS; they import `.ts` modules with explicit `.ts` extensions.
- Runtime imports inside `src/lib/**` testable modules must also use explicit `.ts` extensions (tsconfig has `allowImportingTsExtensions`).

## Project structure

- **App router**: Entrypoints are `src/app/page.tsx` and `src/app/layout.tsx`.
- **TypeScript path aliases**: `@/` prefix maps to `./src/`. Import as `@/components/foo` rather than relative paths.
- **Domain modules**: `src/lib/checkout/**` (Phase 9), `src/lib/payments/**` (Phase 10-A).

## Payments (Phase 10-A + 10-B)

- `src/lib/payments/status.ts` — order/payment status state machines (pure). Only `PENDING` payments may resolve; terminal states are frozen.
- `src/lib/payments/engine.ts` — pure finalization engine against a `FinalizePaymentStore` port; owns idempotency, ownership, and amount invariants.
- `src/lib/payments/flow.ts` — pure Phase 10-B orchestration (`startGatewayPayment`, `handleGatewayCallback`) against a `GatewayFlowStore` port; the callback is never proof of payment — success only after server-side verification with the stored order amount. Ambiguous outcomes (timeout) stay PENDING.
- `src/lib/payments/service.ts` — server-only Prisma adapter + user-scoped queries. Only production entry point for payment state changes (`startUserGatewayPayment`, `handleUserGatewayCallback`, `resolveUserPayment`).
- `src/lib/payments/gateway.ts` — provider-agnostic `PaymentGateway` interface; no provider specifics outside adapters.
- `src/lib/payments/registry.ts` — the only place a concrete provider is chosen (ZarinPal).
- `src/lib/payments/zarinpal.ts` — live ZarinPal v4 REST adapter (request/verify + sandbox hosts + callback param parsing). All ZarinPal knowledge lives here.
- `src/lib/payments/ux.ts` — Persian/RTL UX state copy for gateway flow states.
- Routes: `POST /api/payments/start` (session-scoped, server-derived amount, returns gateway redirect), `GET /api/payments/callback` (ZarinPal return; verifies server-side, redirects to `/payment/result`), `/payment/result` (Persian/RTL result page with retry path).
- Config: `ZARINPAL_MERCHANT_ID`, `ZARINPAL_SANDBOX` (env, server-side only).
- Order creation stays in `src/lib/checkout/order.ts` (atomic); payments never touch inventory or create orders. Retries open NEW payment attempts; terminal rows are never re-opened.
- Deferred: refunds, unverified-transaction reconciliation console.

## Discounts (Phase 12)

- `src/lib/discounts/rules.ts` — pure discount domain: rule validation (active status, start/end dates, minimum order amount, global/per-user usage limits), amount calculation (percentage with optional max cap, fixed clamped to subtotal, free shipping), `evaluateDiscountForCart` against a `DiscountEvaluateStore` port, and `consumeDiscountForPaidOrder` against a `DiscountConsumeStore` port. All eligibility/amount decisions are server-side; client input never reaches these functions beyond the already-normalized code.
- `src/lib/discounts/service.ts` — server-only Prisma adapter + `evaluateDiscountForCheckout` (the only production entry point used by checkout), `consumeDiscountUsageInTx` (usage consumption inside the payment-success transaction; unique `[discountId, orderId]` + guarded `usedCount` increment make it race-safe and idempotent), and Phase 13–14 admin integration points (`createDiscount`, `updateDiscount`, `setDiscountActive`, `getDiscountUsage` — role-enforced server-side, no admin UI in this phase).
- `src/lib/checkout/discount.ts` — pure code input handling: `normalizeDiscountCode` (trim/collapse/64-cap), case-insensitive lookup key, `resolveSubmittedDiscountCode` (more than one code → `DISCOUNT_STACK_MESSAGE` stack rejection). The old `evaluateDiscountCode` placeholder was removed.
- `src/lib/checkout/totals.ts` — `computeCheckoutTotals` accepts `freeShipping`; free shipping zeroes the effective shipping cost, product discounts never discount shipping, discount can never exceed the subtotal.
- Order integration: `Order` carries durable discount snapshots (`discountId`, `discountCodeSnapshot`, `discountTypeSnapshot`, `discountValueSnapshot`) so historical orders never depend on the mutable `Discount` row; totals from final validation are the single source of truth for `subtotal/shippingCost/discountAmount/totalAmount`.
- Usage lifecycle: applying a code in checkout consumes NOTHING; usage is consumed only inside `applyPaymentSuccess` (payments/service) when the payment+order success transition commits. Failed/pending/abandoned payments never consume usage. Duplicate successes are idempotent no-ops.
- Checkout UI (`checkout-view.tsx` + `checkout-summary.tsx`): enter/apply/remove a code, applied-code chip, server-derived discount amount, free-shipping notice, Persian rejection copy from `DISCOUNT_REJECT_MESSAGES`, automatic re-application when the cart changes. The applied code rides the submit form as `discountCode` (single normalized value; the server collects all fields and rejects stacking).
- Schema: `DiscountType` gained `FREE_SHIPPING`; `Discount.maxDiscountAmount` added; `Order` gained the snapshot fields; `DiscountUsage` gained `@@unique([discountId, orderId])`.
- Tests: `src/lib/discounts/discounts.test.mjs` (`npm run test:discounts`); checkout tests updated for the new input handling + free-shipping totals.

## Admin (Phase 13)

- Single authentication system: the admin console reuses the existing Mobile + OTP flow and signed session cookie (`src/lib/auth/**`). No second auth system exists.
- `src/lib/admin/rules.ts` — pure, DB-free authorization: `ADMIN_CAPABLE_ROLES` (ADMIN, STAFF) and `USER_MANAGEMENT_ROLES` (ADMIN only) allow-lists, `evaluateAdminAccess` (deny-by-default: `UNAUTHENTICATED` / `INACTIVE` / `NOT_ADMIN`), `filterAdminNavForRole`, `ADMIN_NAVIGATION`, `ADMIN_ACCESS_MESSAGES` (Persian copy). Unknown/forged role strings are always denied.
- `src/lib/admin/dal.ts` — server-only: `getAdminAccess` / `requireAdmin` / `isAdminSession`. Authorization is ALWAYS resolved from the DATABASE user row via the existing auth DAL (`getCurrentUser`); session role claims are never trusted for admin access.
- Route protection is two-layer: layout-level `requireAdmin()` in `src/app/(admin)/layout.tsx` (authoritative) plus the optimistic first filter in `src/proxy.ts` (matcher now includes `/admin`).
- UI: `src/components/admin/**` — `AdminShell`, `AdminSidebar`, `AdminHeader`, `AdminMobileNav`, `AdminNavigation`, `AdminPageHeader`, `AdminEmptyState`, `AdminIcon`. Persian/RTL, logical properties, responsive (desktop rail ↔ mobile drawer). Nav sections are role-filtered server-side before render.
- Public chrome is suppressed on `/admin` via `src/components/layout/public-chrome.tsx` inside `SiteShell`; public-site pages are unaffected.
- Dashboard (`src/app/(admin)/admin/page.tsx`) — foundation only, real empty states, no fake metrics; product/category/discount/review CRUD modules are Phase 14 (those nav items render disabled "به‌زودی"). Orders and customers are now READ-ONLY live (Phase 14-A).
- Metadata: admin layout sets `robots: { index: false, follow: false, nocache: true }`.
- Tests: `src/lib/admin/admin.test.mjs` (`npm run test:admin`, also in `npm test`).

## Admin Management (Phase 14-A — read-only orders & customers)

- Shared admin list foundation (pure, DB-free): `src/lib/admin/list.ts` — `parseAdminListPage` (fixed `ADMIN_PAGE_SIZE=20`, reuses catalog pagination), `parseAdminSearchTerm` (trim/collapse/64-cap), `parseEnumFilter` / `parseSortOption` (whitelist-only; forged values are dropped, never forwarded raw to Prisma), `firstParam`.
- Status vocabulary: `src/lib/admin/labels.ts` — tone maps (`StatusTone`: neutral/info/success/warning/danger) built ONLY on real schema enums (OrderStatus, PaymentStatus, UserStatus, UserRole, DiscountType); Persian user role/status labels; `discountTypeLabel` (total + null fallback). Filter option lists derive from these maps in `src/lib/admin/options.ts` (schema-enum values only).
- Reusable server-rendered admin UI (`src/components/admin/**`): `AdminListToolbar`, `AdminTable` (desktop; `secondary` columns hide below xl), `AdminCardList` (deliberate mobile card presentation), `AdminListFooter` (count + prev/next via `buildListHref`, preserving active filters), `AdminRowActions`, `AdminListErrorState`, `AdminStatusBadge` (single tone vocabulary), `AdminSearchField` + `AdminSelectFilter` (URL-state GET only; no client data-table dependency). `AdminPageHeader.title` accepts ReactNode.
- Read queries: `src/lib/admin/queries.ts` — server-only, explicitly READ-ONLY (no mutations anywhere in 14-A): `getAdminOrders` / `getAdminOrderById` / `getAdminUsers` / `getAdminUserById`. DB failures return `{ state: "error" }` so admin pages never disguise an outage as an empty state. Payment details expose only display-safe facts (no gateway `meta` JSON).
- Routes: `/admin/orders` (+ `/admin/orders/[orderId]`) and `/admin/users` (+ `/admin/users/[userId]`), both under the existing `(admin)` layout gate; every page calls `requireAdmin()` first. Users section is ADMIN-only (existing `USER_MANAGEMENT_ROLES`); orders are ADMIN+STAFF. Nav entries enabled in `ADMIN_NAVIGATION` now that routes exist; unbuilt modules stay disabled.
- Deferred to later sub-phases: order status changes/cancellation/refunds, user blocking/role mutation, product/category/inventory/price/image management, discount & moderation UI, secondary "more" action menus (none exist yet — 14-A has no mutations).

## Admin Categories (Phase 14-B — category management CRUD)

- `src/lib/admin/category-rules.ts` — pure, DB-free category domain: `validateCategoryInput` (name/slug/status/sortOrder/image URL/SEO caps + Persian/Arabic-digit tolerant `parseStrictInt`/`toLatinDigits`), `normalizeCategorySlug` (mirrors catalog `slugify`; empty slug falls back to the name, junk explicit slug errors), `collectDescendantIds`/`validateParentAssignment` (SELF/DESCENDANT/UNKNOWN_PARENT cycle prevention), `recomputeSubtreeLevels`, `buildCategoryTree`, conservative `evaluateCategoryDeletion` (blocked by children or product associations), stable `CategoryErrorCode` + Persian `CATEGORY_ERROR_MESSAGES`.
- `src/lib/admin/category-service.ts` — server-only Prisma adapter: `getAdminCategoryTree` (ALL statuses + product-association counts via one groupBy; DB failure → `{ state: "error" }`), `createCategory`/`updateCategory`/`setCategoryStatus`/`deleteCategory` — each re-checks the actor with the existing `isAdminCapableRole` allow-list, validates through the pure rules, prevents cycles inside the write transaction, maintains `level` consistency on create + reparent (subtree recompute), and maps P2002/P2025 to DUPLICATE_SLUG/NOT_FOUND (no raw DB errors, no fake data). `slug` uniqueness is the DB constraint; deletion respects the schema's `onDelete: Restrict` via the pre-guard.
- Server actions: `src/app/actions/categories.ts` — every action starts with `requireAdminForAction()` (DB-row role, deny-by-default) before the service; result messages are Persian; `revalidateCategories()` revalidates `/admin/categories` + the public `/categories` and `/products` pages.
- UI: `src/app/(admin)/admin/categories/page.tsx` (server: requireAdmin + tree fetch) + `src/components/admin/category-manager.tsx` (client island: selection/form-mode/collapse only — never authorization or validation authority) and `category-form.tsx` (`useActionState` create/edit form; auto-slug from name until hand-edited; self/descendant parent options excluded as UX hint only). Tree view = flattened depth-sorted list with collapse chevrons, per-node add-child/edit icon actions; detail panel shows parent, order, child/descendant counts, product count, description, image URL, SEO; status toggle + two-step delete confirmation (destructive action). Mobile stacks tree over detail.
- Images are URL-only in this phase (no upload/storage infra). `sortOrder` is the manual sibling order; public catalog ordering (`sortOrder asc, name asc`) unchanged.
- Nav: `/admin/categories` enabled (`sitemap` icon, ADMIN+STAFF); products/discounts/reviews/settings stay disabled.
- Tests: `src/lib/admin/categories.test.mjs` (`npm run test:categories`, also in `npm test`) — validation, slug/digit normalization, self/descendant/unknown parent rejection, subtree levels, delete guard, role allow-list, error-copy completeness.

## ESLint

- Config in `eslint.config.mjs` extends `eslint-config-next` (core-vitals + typescript).
- Ignores: `.next/`, `out/`, `build/`, `next-env.d.ts`.
- Do not remove the Next.js overrides without understanding the impact.

## Next.js 16 guidance

The existing framework-generated block is preserved at the top of this file (`<!-- BEGIN:nextjs-agent-rules -->`). It documents breaking changes and directs agents to inspect `node_modules/next/dist/docs/`. **Do not remove or weaken this block.**

## Tailwind CSS v4

- This project uses Tailwind CSS v4 (`^4` in `package.json`).
- Class names, config schema, and JIT utilities may differ from v3.
- Always verify generated CSS if styles look unexpected.
- PostCSS config is in `postcss.config.mjs`.

## Blog / Content (Phase 15)

- Schema: `PostCategory` (hierarchical blog categories: parent/children, `level`, `status`, `image`, `seoTitle/seoDescription`), `Post` (title/slug/excerpt/rich `content`/`coverImage`/`status`/SEO fields/`authorId`/`publishedAt`), `PostCategoryRelation` and `PostProductRelation` (composite-PK link tables, both `onDelete: Cascade`). Back-relations `blogPosts` (User) and `blogPosts` (Product) exist. No schema changes beyond the two approved additions.
- `src/lib/blog/content.ts` — pure, dependency-free HTML allowlist sanitizer (the security authority for rich content). No DOM needed: tokenizer + nesting stack, fully unit-testable. Drops disallowed tags but keeps their text; removes `<script>`/`<style>` bodies entirely; no inline styles or arbitrary classes (alignment rides on allowlisted `data-align`, callouts on `data-callout`); URLs scheme-checked (`javascript:`/`data:`/`vbscript:`/`file:` and protocol-relative rejected); `<iframe>` embeds restricted to an HTTPS video-host allowlist (YouTube/Vimeo/Aparat). Content is sanitized on WRITE inside the pure rules and re-sanitized at READ (`renderPostContent`) — defense-in-depth; nothing unsanitized is ever stored or rendered.
- `src/lib/blog/post-rules.ts` — pure post domain: field limits, `POST_STATUSES` (DRAFT/PUBLISHED/ARCHIVED), `POST_SORTS`, `PostInputRaw` (`unknown` at the edges), `validatePostInput` (title/slug-fallback/excerpt/content/cover-URL-policy/status/SEO caps), publish gating (PUBLISHED requires real prose; drafts may be saved at any completeness), related-product id list (de-dup + cap), category id list, `publishFieldFor` (first publish stamps `publishedAt`, preserved on re-draft), sort whitelist, `PostErrorCode` + Persian copy.
- `src/lib/blog/category-rules.ts` — re-exports the shared catalog category validation/hierarchy primitives (one validation system, two category trees); only the deletion-guard vocabulary and Persian copy are blog-specific (children or attached posts block deletion).
- `src/lib/blog/category-service.ts` / `post-service.ts` — server-only Prisma adapters mirroring the catalog/admin conventions: actor resolved server-side + `isAdminCapableRole` re-check, raw form values never reach Prisma, category/product/author ids re-verified against real rows inside the write transaction, `level` consistency maintained, DB failures map to stable machine codes (no raw DB errors, no fake data). `getPostFormContext` is the single round-trip feeding the create/edit pages.
- Server actions: `src/app/actions/blog-categories.ts`, `src/app/actions/blog-posts.ts` — every action starts with `requireAdminForAction()`; revalidates `/admin/blog/*`, `/blog`, `/blog/category` and `/products`.
- Admin UI: `/admin/blog/posts` (list: search/status/category filters, sort, status badges, mobile cards), `/admin/blog/posts/new` + `/admin/blog/posts/[postId]` (create/edit), `/admin/blog/categories` (reuses the shared `CategoryManager` with blog copy). `post-form.tsx` (`useActionState`, auto-slug, category checkbox tree, SEO section, status/author), `post-editor.tsx` (lightweight WYSIWYG: headings, bold/italic/underline/strike, lists, blockquote, HR, alignment, links, internal-link picker to real posts/blog-categories/products/product-categories, image, video embed, table, callout, undo/redo, remove-format, and an in-console preview that also sanitizes), `post-related-products.tsx` (manual, ordered, searchable selection of REAL products; no recommendation engine), `post-status-actions.tsx` (publish/archive/draft + two-step delete). Nav entries live under the "محتوا" section of `ADMIN_NAVIGATION`.
- Public blog: `/blog` (hero, featured strip, sidebar category tree, paginated grid), `/blog/category/[categorySlug]`, `/blog/[postSlug]` (breadcrumb, H1, author/date/reading-time, cover image, sanitized prose, related products, related posts). Only PUBLISHED posts and ACTIVE categories are public — `src/lib/blog/queries.ts` enforces it and degrades to empty results on DB failure (never fake content). Draft preview is console-only.
- Article styling: `.prose-rtl` in `src/app/globals.css` renders the sanitizer's allowlist subset with logical (RTL-safe) properties; `data-align`/`data-callout` are the only presentation hooks (no CSS injection surface).
- Images are URL-only (no upload/storage infra). Related products are real catalog rows only.
- Tests: `src/lib/blog/blog.test.mjs` (`npm run test:blog`, also in `npm test`) — post validation, publish gating, id-list normalization, slug/date/sort rules, error-copy completeness, and 20+ sanitizer cases (XSS vectors, schemes, embed allowlist, entity round-trip, nesting repair).

## Preserve existing architecture

- Do not make architectural decisions (ORM, database, authentication, payment, storage, hosting, deployment) without approval.
- Do not remove or rewrite existing application files.
- Do not install packages or modify `package.json` unless required for the task at hand.
- Changes should be incremental and scoped.

## Inspect before modifying

- Read existing files before modifying to understand the current patterns.
- Check `node_modules/next/dist/docs/` for Next.js API guidance before implementing unfamiliar features.
- Review `tsconfig.json`, `eslint.config.mjs`, and `postcss.config.mjs` to confirm conventions before making changes.

## Skills

- Relevant `.cline/skills` guidance should be inspected and followed when applicable, especially for UI styling, brand/visual identity, UI/UX, design tokens, and typography/font guidance.
- Do not copy entire skill contents into this file.

## Important

- This file was created during repository discovery for the Reyhan e-commerce project.
- It reflects the confirmed stack: Next.js 16, React 19, TypeScript, Tailwind CSS v4, App Router.
- No application code was changed during creation.
- No dependencies were installed.
- The existing `.next/` build cache and `node_modules/` are preserved as-is.