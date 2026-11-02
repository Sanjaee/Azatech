# AI Usage Disclosure (`AI_USAGE.md`)

In accordance with the assessment guidelines, this document transparently records how AI tools were used during the development of the Azatech Order Management System (Variant C).

---

## 1. AI Tools Used

- **Antigravity (Google DeepMind Coding Agent)** — Used for project scaffolding, Drizzle ORM schema generation, Express module implementation, Next.js App Router BFF proxy & UI implementation, and integration test authoring.

---

## 2. Tasks Assisted by AI

1. **Monorepo & Build Configuration:** Setting up independent `backend/` and `frontend/` TypeScript strict-mode configurations, Tailwind CSS tokens, and Vercel serverless routing (`backend/api/index.ts`, `backend/vercel.json`).
2. **Database Schema & Seeder Authoring:** Translating the 5 required tables (`users`, `products`, `customers`, `orders`, `order_items`) into Drizzle ORM definitions (`backend/src/db/schema/index.ts`) with `NUMERIC(15, 2)` precision, foreign keys, indexes, and `CHECK` constraints, plus the idempotent seeder (`backend/src/db/seed.ts`).
3. **Transactional Order Engine & Variant C Math:** Implementing `calculateVariantCTaxCents` (`backend/src/utils/money.ts`) using exact `BigInt` integer-cent arithmetic and `OrdersService.createOrder` / `payOrder` / `cancelOrder` (`backend/src/modules/orders/orders.service.ts`) with `SELECT ... FOR UPDATE` row locking.
4. **Next.js BFF & shadcn/ui Dashboard:** Building the HttpOnly cookie authentication routes (`frontend/src/app/api/auth/*`), the allowlisted BFF proxy (`frontend/src/app/api/backend/[...path]/route.ts`), and the 6 required dashboard pages.
5. **Automated Integration Test Suite:** Writing the 13 Supertest + Vitest integration tests in `backend/tests/orders.integration.test.ts`.

---

## 3. Representative Prompts Used

1. > *"Create the Drizzle ORM PostgreSQL schema in `backend/src/db/schema/index.ts` for `users`, `products`, `customers`, `orders`, and `order_items` with `NUMERIC(15, 2)` monetary columns, `order_status` enum (`PENDING`, `PAID`, `CANCELLED`), indexes on search/status/date columns, and database `CHECK` constraints ensuring positive prices and non-negative stock."*
2. > *"Implement `OrdersService.createOrder` in `backend/src/modules/orders/orders.service.ts` following Variant C: reject client-submitted financial fields, sort product IDs in ascending order before `SELECT ... FOR UPDATE`, validate stock after locking, compute Variant C 11% PPN rounded up to the nearest Rp100 (`CEILING(subtotal * 0.11 / 100) * 100`), generate `INV-YYYYMMDD-XXXX` order numbers safely under concurrency, snapshot product name/code/price in `order_items`, and roll back completely if any item fails."*
3. > *"Implement a secure Next.js App Router BFF in `frontend/src/app/api/auth/*` and `frontend/src/app/api/backend/[...path]/route.ts` that stores the Express JWT in an `HttpOnly`, `SameSite=Lax` cookie, strips the raw token from browser responses, validates `Origin` and `X-Requested-With` CSRF headers on mutations, and enforces an explicit allowlist of permitted backend paths and HTTP methods."*
4. > *"Write real PostgreSQL integration tests in `backend/tests/orders.integration.test.ts` covering all 6 mandatory scenarios plus concurrent order requests competing for limited stock, duplicate cancellation protection, and historical price snapshot immutability."*

---

## 4. Manual Review, Verification, and Modifications

Every file and business rule was verified against the specification:

- **Variant C PPN Rounding Verification:** Manually verified the integer-cent ceiling formula `(subtotalCents * 11n + 999_999n) / 1_000_000n * 10_000n` against boundary cases:
  - `Rp150,000` $\rightarrow$ `16,500` tax, `166,500` grand total.
  - `Rp150,010` $\rightarrow$ `16,501.10` raw tax $\rightarrow$ `16,600` rounded tax, `166,610` grand total.
- **Row-Level Locking & Rollback Verification:** Verified via `backend/tests/orders.integration.test.ts` that when a multi-item order contains one valid product and one under-stocked product, the valid product's stock remains completely unchanged after the `422` response.
- **Strict TypeScript & Build Verification:** Executed `tsc --noEmit`, `vitest run`, `npm run build` on `backend/`, and `next build` on `frontend/` to confirm zero type errors, zero build errors, and 100% passing integration tests.
