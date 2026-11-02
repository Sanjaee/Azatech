# Technical & Architectural Decisions (`DECISIONS.md`)

This document answers the four required engineering questions using the actual implementation details, source files, and functions in this repository.

---

## 1. How does the application prevent negative stock during concurrent orders?

### Implementation Strategy: Deterministic Pessimistic Row-Level Locking + Atomic Conditional Decrement + Database CHECK Constraint

Negative stock during concurrent order requests is prevented through three defense-in-depth layers implemented in [`backend/src/modules/orders/orders.service.ts`](backend/src/modules/orders/orders.service.ts) (`OrdersService.createOrder`) and [`backend/src/db/schema/index.ts`](backend/src/db/schema/index.ts):

1. **Deterministic Ascending Lock Ordering (Deadlock Prevention):**
   Inside the `db.transaction(async (tx) => { ... })` block in `OrdersService.createOrder`, all requested `product_id` UUIDs are first sorted lexicographically before acquiring locks:
   ```ts
   const sortedProductIds = [...input.items.map((i) => i.product_id)].sort((a, b) =>
     a.localeCompare(b)
   );

   const lockedProducts = await tx
     .select()
     .from(products)
     .where(inArray(products.id, sortedProductIds))
     .orderBy(asc(products.id))
     .for('update');
   ```
   Because every concurrent transaction locks `products` rows in the exact same ascending UUID order (`ORDER BY id ASC FOR UPDATE`), circular wait conditions (deadlocks) between multi-item orders (`[Product A, Product B]` vs `[Product B, Product A]`) cannot occur.

2. **Post-Lock Stock Validation:**
   When Transaction A and Transaction B concurrently attempt to buy 4 units of a product that has only 5 units in stock, PostgreSQL grants the `FOR UPDATE` row lock to Transaction A first and blocks Transaction B until Transaction A commits or rolls back.
   - Transaction A validates `product.stock >= item.quantity` (`5 >= 4`), inserts the order and snapshots, decrements stock to `1`, and commits.
   - Transaction B then unblocks, reads the freshly committed row state (`stock = 1`), fails the check `product.stock < item.quantity` (`1 < 4`), and throws `ValidationError('Insufficient stock')`, rolling back its transaction completely.

3. **Atomic Conditional Update & PostgreSQL CHECK Constraint:**
   When decrementing inventory in step 16 of `OrdersService.createOrder`, the `UPDATE` statement includes an atomic guard (`WHERE id = $1 AND stock >= $2`):
   ```ts
   const updatedRows = await tx
     .update(products)
     .set({
       stock: sql`${products.stock} - ${item.quantity}`,
       updatedAt: new Date(),
     })
     .where(and(eq(products.id, item.product_id), gte(products.stock, item.quantity)))
     .returning({ id: products.id });
   ```
   Additionally, the `products` table in [`backend/src/db/schema/index.ts`](backend/src/db/schema/index.ts) enforces `CHECK ("products"."stock" >= 0)` (`products_stock_non_negative_chk`) at the storage engine level, making negative inventory impossible even if application code were bypassed.

4. **Verification:**
   This exact race condition is tested in [`backend/tests/orders.integration.test.ts`](backend/tests/orders.integration.test.ts) (`prevents overselling when two concurrent orders compete for limited stock`), where two concurrent `POST /api/orders` requests each order 4 units of a 5-unit product via `Promise.all`; one returns `201 Created`, the other returns `422 Unprocessable Entity`, and final stock is verified to be `1`.

---

## 2. Why was this folder structure and layering selected, and what would change if the application grew?

### Why This Structure Was Selected

The repository uses an independent two-project monorepo (`backend/` and `frontend/`) with domain-modular layering inside `backend/src/modules/{auth,products,customers,orders}`:

- **Independent Deployment Boundary:** Vercel deploys `frontend/` and `backend/` as separate projects on separate domains. Keeping independent `package.json` and `tsconfig.json` files ensures neither project bundles the other's runtime dependencies (e.g., Next.js never bundles `pg` or `bcryptjs`, and Express never bundles React).
- **Clear Separation of Concerns Within Modules:** Each backend domain module is split into:
  - `*.schema.ts`: Zod input validation and strict payload whitelisting (e.g., `createOrderSchema` in `backend/src/modules/orders/orders.schema.ts`).
  - `*.controller.ts`: Thin HTTP adapters that parse inputs and delegate to services using `sendSuccess`.
  - `*.service.ts`: Business rules, financial calculations (`calculateVariantCTaxCents` in `backend/src/utils/money.ts`), and database transaction boundaries (`db.transaction(...)`).
  - `*.routes.ts`: Express router registration and middleware attachment (`requireAuth`, `loginLimiter`).

### What Would Change If the Application Grew

1. **Shared Workspace Types Package (`packages/contracts`):** If the system expanded to 15+ modules, duplicating Zod schemas and TypeScript interfaces between `backend/src/modules/*` and `frontend/src/types/index.ts` would introduce drift. We would extract a shared workspace package or OpenAPI codegen pipeline.
2. **Dedicated Repository / Data-Access Layer:** Currently, Drizzle ORM queries live inside `*.service.ts` (`ProductsService`, `OrdersService`). As query complexity grows (e.g., multi-warehouse stock allocation, credit limits, reporting), extracting `*.repository.ts` classes that accept a transaction handle (`tx`) would decouple domain orchestration from SQL syntax.
3. **Outbox Pattern for Side Effects:** When order payment or cancellation needs to trigger external side effects (sending invoice emails, notifying ERP/shipping webhooks), we would add a `transactional_outbox` table written inside the same `db.transaction` in `OrdersService.createOrder` / `payOrder` / `cancelOrder` and processed asynchronously by a background worker.

---

## 3. Describe one real bug encountered and how it was discovered and fixed.

### Bug: Date-Only Filter Strings Excluding Same-Day Orders in `GET /api/orders`

- **Where It Occurred:** [`backend/src/modules/orders/orders.service.ts`](backend/src/modules/orders/orders.service.ts) in `OrdersService.listOrders`.
- **How It Was Discovered:** When filtering orders by date range using `YYYY-MM-DD` query strings from the frontend calendar picker (e.g., `?start_date=2026-11-02&end_date=2026-11-02`), `new Date('2026-11-02')` parses to `2026-11-02T00:00:00.000Z` (midnight). Using `lte(orders.createdAt, new Date(end_date))` caused any order created after `00:00:00.000` on `end_date` to be excluded from the results when the user selected today's date as both `start_date` and `end_date`.
- **How It Was Fixed:** In `OrdersService.listOrders` (`backend/src/modules/orders/orders.service.ts`), date-only strings (`length <= 10`) are normalized so `start_date` starts at `00:00:00.000` local time and `end_date` extends to the end of the day (`23:59:59.999`):
  ```ts
  if (start_date) {
    const start = new Date(start_date);
    if (start_date.length <= 10) {
      start.setHours(0, 0, 0, 0);
    }
    conditions.push(gte(orders.createdAt, start));
  }

  if (end_date) {
    const end = new Date(end_date);
    if (end_date.length <= 10) {
      end.setHours(23, 59, 59, 999);
    }
    conditions.push(lte(orders.createdAt, end));
  }
  ```

---

## 4. Identify unfinished or weak areas and explain the next improvement.

1. **Stateless JWT Revocation / Refresh Token Rotation:**
   - *Current State:* `POST /api/auth/logout` (`frontend/src/app/api/auth/logout/route.ts`) clears the `azatech_session` HttpOnly cookie on the Next.js BFF domain, immediately ending browser access. However, the underlying Express JWT (`backend/src/lib/jwt.ts`) remains cryptographically valid until `JWT_EXPIRES_IN` (`8h`) elapses.
   - *Next Improvement:* Issue short-lived access tokens (`15m`) paired with a database-backed `refresh_tokens` table (storing a token family hash and `revoked_at` timestamp) so sessions can be revoked server-side immediately on password change or logout.
2. **Serverless Rate Limiting Storage:**
   - *Current State:* Login rate limiting in [`backend/src/modules/auth/auth.routes.ts`](backend/src/modules/auth/auth.routes.ts) uses `express-rate-limit` with its default store, which is per-instance in Vercel serverless functions.
   - *Next Improvement:* Back the rate limiter with Upstash Redis or a PostgreSQL rate-limit bucket table so brute-force counters are shared across all serverless cold starts.
3. **Audit Trail for Inventory & Status Changes:**
   - *Current State:* `products.stock` is updated in-place during `ProductsService.update`, `OrdersService.createOrder`, and `OrdersService.cancelOrder`.
   - *Next Improvement:* Introduce an immutable `inventory_movements` ledger table recording every stock delta (`+` / `-`), actor `user_id`, reason (`INITIAL_SEED`, `MANUAL_ADJUSTMENT`, `ORDER_CREATED`, `ORDER_CANCELLED`), and reference `order_id`.
