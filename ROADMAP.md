# REYHAN PROJECT — FINAL MASTER EXPANDED ROADMAP
====================================================

Purpose
-------
This document freezes and expands the remaining roadmap for the Reyhan project (Water Purification Systems E-Commerce).
After this document is adopted, do NOT redesign the roadmap, invent new phases,
renumber phases, skip phases, or create Phase 28.

The remaining roadmap is:

PHASE 20 — PURCHASE FLOW VERIFICATION
PHASE 21 — KAVENEGAR SMS & NOTIFICATION ENGINE
PHASE 22 — UX, CONVERSION & PRODUCTION HARDENING
PHASE 23 — ADVANCED BUSINESS, STORE FEATURES & ADMIN COMPLETION
PHASE 24 — INTEGRATION & E2E TESTING INFRASTRUCTURE
PHASE 25 — PERFORMANCE, CONCURRENCY & RELIABILITY
PHASE 26 — PRODUCTION INFRASTRUCTURE & DEPLOYMENT
PHASE 27 — FINAL RELEASE AUDIT

After Phase 27, the roadmap is COMPLETE.

Any later work is classified only as:
- Bug
- Security Patch
- Maintenance
- Performance Improvement
- New Feature
- Post-release Enhancement


============================================================
PROJECT TECH STACK & SYSTEM CONSTRAINTS
============================================================

- **Framework:** Next.js 16 (App Router), React 19, TypeScript
- **Styling & UI:** Tailwind CSS v4, shadcn/ui, Lucide React
- **Domain:** E-commerce specialized in Water Purification Systems (دستگاه‌ها و فیلترهای تصفیه آب ریحان)
- **Primary Commands:**
  - Type-check: `pnpm type-check` or `npx tsc --noEmit`
  - Linting: `pnpm lint`
  - Unit/Integration Tests: `pnpm test`
  - Production Build: `pnpm build`


============================================================
MASTER EXECUTION RULES
============================================================

The execution cycle for every phase is:

Audit → Implement → Test → Fix → Verify → Commit → Close

A phase is NOT complete because code was written.

A phase is complete only when:
- Implementation is complete.
- Automated tests pass.
- Required manual verification is complete.
- Known blockers are resolved.
- `git diff` is reviewed for unintended changes.
- Documentation and status reports are updated.
- A final verification report exists.

Before modifying code:
1. Inspect the current implementation.
2. Inspect related tests.
3. Inspect database/schema dependencies.
4. Identify existing conventions.
5. State the exact files/components that will be changed.

During implementation:
- Prefer minimal safe changes.
- Reuse existing architecture.
- Do not rewrite stable systems without evidence.
- Do not introduce speculative abstractions.
- Do not change unrelated functionality.
- Do not silently expand scope.

After implementation:
1. Run relevant tests.
2. Run type-check.
3. Run lint.
4. Run build when appropriate.
5. Verify database behavior when applicable.
6. Review git diff.
7. Check for accidental changes.
8. Report remaining issues.

At the beginning of every phase, print:

PHASE: X
OBJECTIVE:
SCOPE:
EXIT CRITERIA:
CURRENT STATUS:

At the end print:

PHASE RESULT:
IMPLEMENTED:
TESTS:
VERIFICATION:
REMAINING ISSUES:
FILES CHANGED:
GIT STATUS:
READY FOR NEXT PHASE: YES/NO


============================================================
MASTER OPENCODE PROMPT
============================================================

You are now operating as the primary lead implementation agent for the Reyhan water purification project.

The project roadmap is now FROZEN.

Do NOT redesign the roadmap.
Do NOT invent new phases or Phase 28.
Do NOT renumber phases.
Do NOT skip phases.
Do NOT declare a phase complete without verification.

Follow the phases and exit criteria in this document exactly.

Start by auditing the current repository against PHASE 20 only.

Do not implement anything until the Phase 20 audit is complete.


============================================================
PHASE 20 — PURCHASE FLOW VERIFICATION
============================================================

Goal:
Complete and verify the full customer purchase flow in the real/sandbox environment:

OTP login
→ session
→ product selection
→ cart
→ checkout
→ payment gateway (ZarinPal sandbox)
→ callback
→ order/payment status
→ PAID

Requirements:
- Configure a valid SESSION_SECRET (min 32 chars).
- Configure valid ZarinPal sandbox credentials.
- Bootstrap an ADMIN account.
- Seed realistic required water filter/system catalog data.
- Execute the complete purchase flow against the real configured environment.
- Verify database state after every critical step (Cart → Order PENDING → Payment INITIATED → Payment PAID).
- Document every failure and fix it.
- Add integration/E2E coverage for this flow.

First perform a read-only audit.

Inspect:
- authentication / OTP / session
- product / cart / checkout
- order creation / payment engine
- ZarinPal integration / callback / order & payment status transitions
- database schema & existing tests

Report findings before editing code:
1. Current flow
2. Missing configuration
3. Code blockers
4. Database blockers
5. Test blockers
6. Exact files requiring changes
7. Exact verification steps

Exit criteria:
- At least one complete successful purchase exists in sandbox.
- Payment reaches PAID correctly.
- Order reaches the correct final state (e.g. PROCESSING).
- Automated coverage exists for the critical path.


============================================================
PHASE 21 — KAVENEGAR SMS & NOTIFICATION ENGINE
============================================================

Goal:
Finish and verify Kavenegar SMS provider and extend it to support automated customer notifications (OTP, Order status updates, and Price/In-Stock Alerts).

First audit the current SMS implementation:
- `src/lib/auth/sms.ts`
- `src/lib/auth/sms-providers.ts`
- SMS tests & rate limiters

Enhancements & Deliverables:
1. **Core OTP Dispatch:** Verify sending, rate-limiting, timing-safe verification, and pattern matching.
2. **Order Lifecycle Notifications:**
   - SMS on Order Confirmation (`سفارش شما با موفقیت ثبت شد`).
   - SMS on Order Shipping with Postal Tracking Code (`کد رهگیری پستی: X`).
3. **Price Drop & Back-In-Stock Triggers:**
   - Hook SMS notification service to `StockAlert` and `PriceAlert` queues when an out-of-stock water filter becomes available or drops in price.

Verify:
- Successful OTP send & response parsing.
- Network timeouts / provider outage fallback.
- Rate limiting per IP/phone number.
- No sensitive keys or tokens logged in production logs.

Exit criteria:
- SMS engine fully working with unit/integration tests passing.
- Real provider verification successful when API key is present.
- Clean git status.


============================================================
PHASE 22 — UX, CONVERSION & PRODUCTION HARDENING
============================================================

Goal:
Fix all confirmed defects and implement key client-side conversion & UX features (Recently Viewed, Product Comparison, Wishlist sharing, and Security/SEO fixes).

Part A: Defect & Hardening Checklist
- Fallback SESSION_SECRET security check.
- Prevent user enumeration on authentication endpoints.
- Configure proper Content Security Policy (CSP) & Security Headers.
- Replace fragile in-memory rate limiters if necessary.
- Fix product page soft-404 handling.
- Fix OpenGraph (OG) tags, price display, duplicate `<h1>`, and missing `<main>` semantic tags.
- Fix breadcrumb JSON-LD schema mismatches.

Part B: High-Value Client UX Features (Low Cost)
1. **Recently Viewed Products & Resume Shopping ("ادامه خرید"):**
   - Track viewed products in `localStorage`.
   - Display a "Recently Viewed" carousel on product pages and home page.
   - Show a subtle "Resume Shopping" drawer banner for unlogged users with saved carts.
2. **Water Purification Comparison Mode ("مقایسه تخصصی دستگاه‌ها"):**
   - Side-by-side comparison modal/page for 2-3 products.
   - Compare specific technical specs: Number of filtration stages (تعداد مراحل فیلتراسیون), Membrane type (نوع ممبران), Tank capacity (ظرفیت مخزن), Pump power, and Warranty.
3. **Wishlist with Shareable Link ("لیست علاقه‌مندی / لیست هدیه"):**
   - Enable wishlist saving without mandatory registration (via UUID/localStorage sync).
   - Generate shareable public links (`/wishlist/share/[id]`).

Exit criteria:
- Defect Matrix generated:
  ISSUE | SEVERITY | ROOT CAUSE | FIX | TEST | STATUS
- All security, SEO, and client UX features functional with tests.
- `pnpm lint` and `pnpm type-check` pass with zero errors.


============================================================
PHASE 23 — ADVANCED BUSINESS, STORE FEATURES & ADMIN COMPLETION
============================================================

Goal:
Implement high-converting e-commerce features tailored for the Water Purification domain, and complete all missing admin management workflows.

Part A: Specialized Business & Store Features
1. **Product Price History Chart ("نمودار تاریخچه قیمت"):**
   - Utilize existing `ProductPriceHistory` DB model.
   - Add a lightweight visual chart (e.g. Recharts or SVG component) on the product details page showing price evolution over time.
2. **Price Drop & Back-In-Stock Alert Subscriptions ("بهم خبر بده"):**
   - Add "Notify Me" modal on out-of-stock items or for price drop alerts (collecting phone number / email).
3. **Interactive Water Purification Selection Quiz ("کوییز هوشمند انتخاب دستگاه تصفیه آب"):**
   - Interactive step-by-step wizard (e.g., 1. Water Source/TDS, 2. Family Size, 3. Installation Type: Under-sink / Desktop, 4. Budget).
   - Returns personalized product recommendations with "Add Recommended Set to Cart" action.
4. **Digital Gift Cards ("کارت هدیه دیجیتال"):**
   - Custom amount generation, unique gift code generation, and redeemable balance at checkout.
5. **Checkout Enhancements (Gift Wrapping & Free Sample Selector):**
   - **Gift Wrapping & Invoice Note:** Add checkout option for gift wrapping or custom message printing on invoice.
   - **Free Sample/Bonus Selector ("نمونه رایگان"):** Allow customers to pick 1 free bonus item (e.g. TDS test strip, extra filter wrench, or replacement fitting) on orders above a configurable total.
6. **Visual Order Tracking Timeline ("ردیف زمانی و نقشه وضعیت سفارش"):**
   - Dynamic timeline UI: `Order Placed` → `Payment Verified` → `Warehouse Packaging` → `Dispatched` → `Delivered` + Postal tracking link.
7. **Product Journey & Authenticity Stamp ("شناسنامه و سرنوشت محصول"):**
   - Display/Generate QR code on invoice/product page showing assembly date, membrane test status, and technician quality stamp.
8. **Pre-Order System ("پیش‌سفارش"):**
   - Allow pre-orders for out-of-stock imported filtration systems with estimated delivery dates.

Part B: Admin & Business Completion
- Admin payment management & refund handling.
- Customer order cancellation & admin override.
- Discount scopes (PRODUCT, CATEGORY, COUPON) & deletion logic.
- Review & Q&A moderation workflow (Approve / Reject / Delete).
- Inventory reservation and automatic release logic on expired checkouts.

Exit criteria:
- All new store features integrated cleanly into UI and DB schema.
- Admin dashboard fully equipped to manage alerts, quizzes, pre-orders, and gift cards.
- Authorization enforced across all admin actions.


============================================================
PHASE 24 — INTEGRATION & E2E TESTING INFRASTRUCTURE
============================================================

Goal:
Establish comprehensive integration and E2E automated test suites covering all customer and admin journeys.

Coverage Requirements:
1. OTP login and session persistence.
2. Water filter selection quiz → product page → price history view.
3. Cart operations, free sample selection, and gift wrapping option.
4. Checkout flow → ZarinPal initiation → callback execution → status update to `PAID`.
5. Order tracking timeline verification.
6. Price drop / Back-in-stock notification subscription tests.
7. Admin dashboard authorization & discount/review management.

Run and verify the complete test matrix:
- Unit tests
- Integration tests
- E2E tests (Playwright/Cypress)
- Type-check (`pnpm type-check`)
- Lint (`pnpm lint`)
- Build (`pnpm build`)

Exit criteria:
- Critical path automated and passing consistently.
- Test report generated with 0 failures on critical paths.


============================================================
PHASE 25 — PERFORMANCE, CONCURRENCY & RELIABILITY
============================================================

Goal:
Optimize database queries, guarantee transactional safety, and audit system reliability under load.

Audit & Refactor Checklist:
1. **Query Optimization:** Eliminate N+1 queries in catalog listing, category filters, and price history fetches.
2. **Concurrency & Race Conditions:** Ensure order placement and inventory deduction use strict DB transactions (`$transaction`).
3. **Idempotency:** Ensure payment callbacks are strictly idempotent (prevent duplicate order fulfillment on multiple webhook hits).
4. **Media & Image Optimization:** Optimize water system/filter product imagery using `next/image` with WebP/AVIF formats.

Exit criteria:
- Zero race conditions on stock deduction during concurrent checkouts.
- Callback processing proven idempotent.
- Clean performance metrics.


============================================================
PHASE 26 — PRODUCTION INFRASTRUCTURE & DEPLOYMENT
============================================================

Goal:
Prepare deployment configurations, environment documentation, logging, and disaster recovery procedures.

Deliverables:
1. Complete `.env.example` with all keys documented (`SESSION_SECRET`, `ZARINPAL_MERCHANT_ID`, `KAVENEGAR_API_KEY`, DB URLs, etc.).
2. Database migration scripts and backup/restore verification procedure.
3. Structured logging and error monitoring setup.
4. Production security headers and `/api/health` health check endpoint.
5. Operational Deployment Checklist:
   `CONFIGURATION` | `DATABASE` | `SECURITY` | `DEPLOYMENT` | `BACKUP` | `RESTORE` | `MONITORING` | `LOGGING` | `ROLLBACK`

Exit criteria:
- Reproducible production build (`pnpm build`).
- Clear backup, restore, and rollback documentation.


============================================================
PHASE 27 — FINAL RELEASE AUDIT
============================================================

Goal:
Execute final release verification across the entire platform.

Checklist:
1. Execute full test suite (`pnpm test`, `type-check`, `lint`, `build`).
2. Verify clean git repository state (no dead code, no debug logs, no hardcoded secrets).
3. Perform end-to-end manual walkthrough of the master user journey:
   `Quiz / Catalog` → `Product Page (Price History)` → `Cart (Free Sample)` → `Checkout (Gift Wrap)` → `Payment` → `Callback` → `PAID` → `Tracking Timeline` → `Admin Operations`.

Produce FINAL RELEASE REPORT:
1. SYSTEM STATUS
2. TEST STATUS
3. SECURITY STATUS
4. PAYMENT STATUS
5. SMS STATUS
6. DATABASE STATUS
7. DEPLOYMENT STATUS
8. BACKUP/RECOVERY STATUS
9. KNOWN ISSUES
10. RELEASE BLOCKERS

Explicitly declare at conclusion:

PHASE 27 COMPLETE
ROADMAP COMPLETE
NO PHASE 28


============================================================
FINAL ROADMAP SUMMARY
============================================================

F20 Purchase Flow Verification
  ↓
F21 Kavenegar SMS & Notification Engine
  ↓
F22 UX, Conversion & Production Hardening
  ↓
F23 Advanced Business, Store Features & Admin Completion
  ↓
F24 Integration & E2E Testing Infrastructure
  ↓
F25 Performance, Concurrency & Reliability
  ↓
F26 Production Infrastructure & Deployment
  ↓
F27 Final Release Audit
  ↓
PROJECT COMPLETE

No Phase 28.