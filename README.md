# Azatech Order Management System — Variant C

An enterprise-grade, transactional Order Management System (OMS) built for the **Azatech Fullstack Developer Technical Test (Variant C)**.

The system implements a decoupled **Next.js App Router (BFF)** frontend and **Express.js + Drizzle ORM** REST API backend backed by **PostgreSQL** (and **Neon PostgreSQL** for production), featuring strict row-level inventory locking (`SELECT ... FOR UPDATE`), immutable historical price snapshots, and deterministic **Variant C PPN 11%** calculation rounded UP to the nearest Rp100.

---

## 1. Architecture Diagram

```mermaid
flowchart LR
    subgraph Browser["Client Browser (azatech-web.vercel.app)"]
        UI["Next.js App Router UI\n(React + shadcn/ui + TanStack Query)"]
    end

    subgraph BFF["Vercel Project 1: Next.js BFF Server"]
        AuthRoutes["/api/auth/login | logout | me\n(Sets/Reads HttpOnly Cookie)"]
        ProxyRoute["/api/backend/[...path]\n(Allowlisted Proxy + CSRF/Origin Check)"]
    end

    subgraph API["Vercel Project 2: Express.js REST API (azatech-api.vercel.app)"]
        JwtMiddleware["requireAuth JWT Middleware\n(HS256 Verification)"]
        Services["Domain Services\n(Auth / Products / Customers / Orders)"]
    end

    subgraph DB["Neon PostgreSQL / Local PostgreSQL"]
        Tables[("users | products | customers\norders | order_items")]
    end

    UI -- "Same-Origin Fetch + X-Requested-With\n(HttpOnly Cookie: azatech_session)" --> AuthRoutes
    UI -- "Same-Origin Fetch + X-Requested-With\n(HttpOnly Cookie: azatech_session)" --> ProxyRoute
    AuthRoutes -- "Server-to-Server POST /api/auth/login" --> Services
    ProxyRoute -- "Server-to-Server Authorization: Bearer <JWT>" --> JwtMiddleware
    JwtMiddleware --> Services
    Services -- "ACID Transactions + SELECT ... FOR UPDATE" --> Tables
```

---

## 2. Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | Next.js 15 (App Router), React 19, TypeScript (Strict Mode), Tailwind CSS, shadcn/ui, Lucide React, React Hook Form, Zod, TanStack Query |
| **Backend** | Node.js, Express.js, TypeScript (Strict Mode), JWT (`jsonwebtoken`), `bcryptjs`, Zod, Helmet, `express-rate-limit`, Drizzle ORM |
| **Database** | PostgreSQL 16 (Docker Compose) / Neon PostgreSQL (Production), Drizzle Kit Migrations, Idempotent Seeders |
| **Testing** | Vitest, Supertest, Real PostgreSQL / PGlite Engine Integration Tests |
| **Deployment** | Vercel Project 1 (`frontend/`), Vercel Project 2 (`backend/`), Neon PostgreSQL |

---

## 3. Repository Structure

```text
azatech-technical-test/
├── backend/
│   ├── src/
│   │   ├── config/          # Environment validation (env.ts)
│   │   ├── db/
│   │   │   ├── schema/      # Drizzle PostgreSQL schema & constraints
│   │   │   ├── migrations/  # Generated SQL migrations
│   │   │   ├── migrate.ts   # Explicit migration runner
│   │   │   ├── runtime.ts   # PostgreSQL / PGlite connection manager
│   │   │   ├── seed.ts      # Idempotent database seeder
│   │   │   └── index.ts     # Drizzle pool & DB proxy
│   │   ├── modules/
│   │   │   ├── auth/        # Login & session verification
│   │   │   ├── products/    # Product CRUD, search, pagination
│   │   │   ├── customers/   # Customer listing & creation
│   │   │   └── orders/      # Transactional orders, Variant C PPN, pay/cancel
│   │   ├── middleware/      # JWT auth & centralized error handler
│   │   ├── lib/             # JWT signing & verification
│   │   ├── utils/           # Exact integer-cent money math & error classes
│   │   ├── types/           # Express & response TypeScript definitions
│   │   ├── app.ts           # Express application factory
│   │   └── server.ts        # Local development HTTP entry point
│   ├── tests/               # Supertest + Vitest integration test suites
│   ├── api/index.ts         # Vercel serverless Express entry point
│   ├── drizzle.config.ts
│   ├── vercel.json
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/login/
│   │   │   ├── (dashboard)/dashboard/
│   │   │   ├── (dashboard)/products/
│   │   │   ├── (dashboard)/customers/
│   │   │   ├── (dashboard)/orders/
│   │   │   └── api/
│   │   │       ├── auth/login|logout|me/
│   │   │       └── backend/[...path]/
│   │   ├── components/
│   │   │   ├── ui/          # shadcn/ui components
│   │   │   ├── layout/      # Dashboard shell & providers
│   │   │   ├── products/    # Add/Edit product dialog
│   │   │   ├── customers/   # Add customer dialog
│   │   │   └── orders/      # Status badges
│   │   ├── hooks/           # TanStack Query hooks
│   │   ├── lib/             # BFF cookie helpers, API client, formatters
│   │   ├── types/           # Shared frontend domain types
│   │   └── schemas/         # Zod form validation schemas
│   ├── vercel.json
│   ├── package.json
│   └── .env.example
├── docker-compose.yml
├── README.md
├── DECISIONS.md
├── AI_USAGE.md
└── package.json
```

---

## 4. Local Setup Instructions

### Step 1: Clone & Install Dependencies

```bash
git clone <repository-url>
cd azatech-technical-test
npm run install:all
```

### Step 2: Configure Environment Variables

Copy the example environment files in both `backend/` and `frontend/`:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

#### Backend Environment Variables (`backend/.env`)

| Variable | Description | Default Local Value |
| :--- | :--- | :--- |
| `NODE_ENV` | Runtime environment (`development`, `test`, `production`) | `development` |
| `PORT` | Express API port | `4000` |
| `DATABASE_URL` | Pooled PostgreSQL connection string | `postgresql://azatech:azatech_password@localhost:5432/azatech_oms` |
| `DIRECT_DATABASE_URL` | Direct PostgreSQL connection string for migrations | `postgresql://azatech:azatech_password@localhost:5432/azatech_oms` |
| `JWT_SECRET` | Secret key for signing HS256 JWT tokens (>= 32 chars in prod) | `replace-with-a-strong-random-64-char-secret-in-production` |
| `JWT_EXPIRES_IN` | Token expiration duration | `8h` |
| `CORS_ALLOWED_ORIGINS` | Comma-separated allowlist for direct API CORS | `http://localhost:3000,https://azatech-web.vercel.app` |

#### Frontend Environment Variables (`frontend/.env`)

| Variable | Description | Default Local Value |
| :--- | :--- | :--- |
| `BACKEND_API_URL` | Base URL of the Express API server | `http://localhost:4000` |
| `AUTH_COOKIE_NAME` | Name of the HttpOnly session cookie | `azatech_session` |
| `AUTH_SECRET` | Secret for session/CSRF configuration | `replace-with-a-strong-random-64-char-secret-in-production` |

### Step 3: Start PostgreSQL with Docker Compose

```bash
docker compose up -d
```

> **Note:** If Docker Desktop is unavailable on a local machine, the backend development server (`npm run dev:backend`) and test runner (`npm test`) automatically fall back to an embedded PostgreSQL engine (`@electric-sql/pglite`) executing the exact same Drizzle SQL migrations and seeder.

### Step 4: Run Database Migrations and Seeders

```bash
npm run db:migrate
npm run db:seed
```

The seeder is **idempotent** and safe to run repeatedly. It populates:
- **1 Admin User**
- **15 Produk** (PRD-ELC-001 s/d PRD-BEV-015)
- **10 Pelanggan** (sesuai spesifikasi: 1 admin, minimal 15 produk, dan 10 pelanggan)

### Step 5: Development Admin Credentials

- **Email:** `admin@azatech.id`
- **Password:** `Admin@Azatech2026!`

### Step 6: Start Backend & Frontend

In two separate terminals:

```bash
# Terminal 1: Start Express API on http://localhost:4000
npm run dev:backend

# Terminal 2: Start Next.js Frontend on http://localhost:3000
npm run dev:frontend
```

---

## 5. Running Automated Tests

Run the integration test suite in `backend/tests/orders.integration.test.ts`:

```bash
npm test
```

The test suite runs against a real SQL engine with full Drizzle migrations and verifies:
1. **Mandatory #1:** Successful transactional order creation and stock deduction.
2. **Mandatory #2:** Insufficient stock on any item causes complete transaction rollback (no partial stock deduction).
3. **Mandatory #3:** Order cancellation (`PENDING → CANCELLED` and `PAID → CANCELLED`) restores product stock atomically.
4. **Mandatory #4:** Invalid status transitions (`PAID → PAID`, `CANCELLED → CANCELLED`, `CANCELLED → PAID`) return `HTTP 409`.
5. **Mandatory #5:** Variant C VAT (PPN 11%) calculation and rounding up to nearest Rp100 (`Rp150,000 → Rp16,500`, `Rp150,010 → Rp16,600`).
6. **Mandatory #6:** Protected endpoints reject requests without a valid JWT (`HTTP 401`).
7. **Additional Scenarios:** Invalid login credentials (`401`), tampered JWT rejection (`401`), `product_code` uniqueness (`409`), product pagination & search, historical price snapshot immutability after product price updates, concurrent order competition for limited stock (preventing negative stock), non-existent customer (`404`), and rejection of client-injected financial fields (`422`).

---

## 6. API Endpoint Documentation

All endpoints except `POST /api/auth/login` and `GET /api/health` require `Authorization: Bearer <JWT>`.

| Method | Endpoint | Description | Auth | Status Codes |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Authenticate user & return signed JWT | Public | `200`, `401`, `422`, `429` |
| `GET` | `/api/auth/me` | Retrieve current authenticated user profile | Bearer JWT | `200`, `401` |
| `GET` | `/api/products` | List products (`?page=1&per_page=10&search=...`) | Bearer JWT | `200`, `401` |
| `POST` | `/api/products` | Create product (`product_code` unique, `price > 0`, `stock >= 0`) | Bearer JWT | `201`, `401`, `409`, `422` |
| `PUT` | `/api/products/:id` | Update product details, price, or stock | Bearer JWT | `200`, `401`, `404`, `409`, `422` |
| `GET` | `/api/customers` | List customers (`?page=1&per_page=20&search=...`) | Bearer JWT | `200`, `401` |
| `POST` | `/api/customers` | Create customer (`name`, optional `email`, `phone`, `address`) | Bearer JWT | `201`, `401`, `422` |
| `POST` | `/api/orders` | Create transactional order from `customer_id` & `items` | Bearer JWT | `201`, `401`, `404`, `422` |
| `GET` | `/api/orders` | List orders (`?page=1&per_page=10&status=...&start_date=...&end_date=...`) | Bearer JWT | `200`, `401`, `422` |
| `GET` | `/api/orders/:id` | Get full order details with customer & historical item snapshots | Bearer JWT | `200`, `401`, `404` |
| `PATCH` | `/api/orders/:id/pay` | Transition order `PENDING → PAID` | Bearer JWT | `200`, `401`, `404`, `409` |
| `PATCH` | `/api/orders/:id/cancel` | Transition `PENDING/PAID → CANCELLED` & restore stock | Bearer JWT | `200`, `401`, `404`, `409` |

---

## 7. `POST /api/orders` Execution Flow & Variant C VAT Calculation

### Order Creation Transaction Flow (`backend/src/modules/orders/orders.service.ts`)

The client is strictly restricted to submitting:
```json
{
  "customer_id": "uuid",
  "items": [
    { "product_id": "uuid", "quantity": 2 }
  ]
}
```
Any attempt to pass `unit_price`, `subtotal`, `tax_amount`, `grand_total`, or `order_number` is rejected by `.strict()` Zod validation with `HTTP 422`.

1. Validate `customer_id` and non-empty `items` with positive integer quantities (`quantity > 0`).
2. Reject duplicate `product_id` entries across `items`.
3. Begin a PostgreSQL `db.transaction(async (tx) => { ... })`.
4. Verify `customer_id` exists in `customers`.
5. Sort all requested `product_id`s in ascending lexicographical order and acquire row-level locks via `SELECT ... FROM products WHERE id IN (...) ORDER BY id ASC FOR UPDATE`.
6. Verify every requested `product_id` exists.
7. Verify `product.stock >= item.quantity` for every item. If any item has insufficient stock, throw `ValidationError (422)` with item-indexed field errors (`items.<index>.quantity`) and roll back the entire transaction.
8. Compute each item's `subtotal = unit_price * quantity` and the order `subtotal` using exact integer-cent `BigInt` arithmetic.
9. Compute **Variant C VAT (11% PPN)**:
   $$\text{tax\_amount} = \lceil \text{subtotal} \times 0.11 / 100 \rceil \times 100$$
   $$\text{grand\_total} = \text{subtotal} + \text{tax\_amount}$$
   - **Example 1:** Subtotal `Rp150,000` $\rightarrow$ Raw tax `Rp16,500` $\rightarrow$ Rounded tax `Rp16,500` $\rightarrow$ Grand total `Rp166,500`.
   - **Example 2:** Subtotal `Rp150,010` $\rightarrow$ Raw tax `Rp16,501.10` $\rightarrow$ Rounded tax `Rp16,600` $\rightarrow$ Grand total `Rp166,610`.
10. Acquire a transaction-scoped advisory lock (`pg_advisory_xact_lock`) for the current date `YYYYMMDD` and generate the next sequential `INV-YYYYMMDD-XXXX` invoice number.
11. Insert the `orders` row (`status = 'PENDING'`).
12. Insert `order_items` rows with immutable snapshots (`product_name`, `product_code`, `unit_price`, `quantity`, `subtotal`).
13. Decrement `products.stock` atomically for each item.
14. Commit the transaction.

---

## 8. Cross-Domain BFF Authentication & Vercel Deployment Instructions

### Authentication Flow Across Separate Domains

Because `https://azatech-web.vercel.app` (Frontend) and `https://azatech-api.vercel.app` (Backend) reside on separate Vercel domains, browser-based cross-origin cookies would be blocked by modern third-party cookie restrictions.

1. The browser submits credentials to `POST https://azatech-web.vercel.app/api/auth/login` with header `X-Requested-With: Azatech-BFF`.
2. The Next.js Route Handler validates Origin/CSRF headers and forwards credentials server-to-server to `POST https://azatech-api.vercel.app/api/auth/login`.
3. Express verifies the user's `bcrypt` password hash in PostgreSQL and returns a signed HS256 JWT.
4. The Next.js Route Handler sets the JWT in a first-party cookie (`azatech_session`) on `azatech-web.vercel.app` with:
   - `HttpOnly: true`
   - `Secure: true` (in production)
   - `SameSite: Lax`
   - `Path: /`
   - `Max-Age: 28800` (8 hours)
5. The raw JWT is stripped from the JSON response body so client-side JavaScript never sees or stores the token.
6. All subsequent client requests target `/api/backend/<resource>` on the frontend domain.
7. The Next.js proxy route (`frontend/src/app/api/backend/[...path]/route.ts`) checks an explicit path+method allowlist, reads `azatech_session` on the server, and forwards the request to Express with `Authorization: Bearer <JWT>`.
8. Express independently verifies the JWT signature and expiration on every protected endpoint.

### Deploying to Neon PostgreSQL & Vercel

1. **Provision Neon PostgreSQL:**
   - Create a Neon project and copy both the **Pooled** connection string (`DATABASE_URL`) and **Direct** connection string (`DIRECT_DATABASE_URL`).
   - Run migrations and seeders against Neon from your workstation:
     ```bash
     cd backend
     DATABASE_URL="<neon-pooled-url>" DIRECT_DATABASE_URL="<neon-direct-url>" npm run db:migrate
     DATABASE_URL="<neon-pooled-url>" SEED_ADMIN_PASSWORD="<strong-prod-password>" npm run db:seed
     ```
2. **Deploy Vercel Project 2 — Backend (`azatech-api`):**
   - Import repository in Vercel, set **Root Directory** to `backend`.
   - Configure environment variables:
     - `DATABASE_URL=<neon-pooled-connection-string>`
     - `DIRECT_DATABASE_URL=<neon-direct-connection-string>`
     - `JWT_SECRET=<64-char-random-hex-secret>`
     - `JWT_EXPIRES_IN=8h`
     - `NODE_ENV=production`
     - `CORS_ALLOWED_ORIGINS=https://azatech-web.vercel.app`
   - Deploy and verify `https://azatech-api.vercel.app/api/health`.
3. **Deploy Vercel Project 1 — Frontend (`azatech-web`):**
   - Import repository in Vercel, set **Root Directory** to `frontend`.
   - Configure environment variables:
     - `BACKEND_API_URL=https://azatech-api.vercel.app`
     - `AUTH_COOKIE_NAME=azatech_session`
     - `AUTH_SECRET=<64-char-random-hex-secret>`
   - Deploy and log in at `https://azatech-web.vercel.app/login`.


---

## 9. Final Review Gate Audit Table

| Requirement | Status | How It Was Tested | Evidence | Remaining Issue |
| :--- | :--- | :--- | :--- | :--- |
| **Authentication (JWT + BFF HttpOnly)** | Implemented | Automated integration tests & live Vercel login test via `POST /api/auth/login` | `tests/orders.integration.test.ts` lines 58-95, live response at `https://azatech-web.vercel.app/login` setting `azatech_session` | None |
| **Protected API Endpoints (HTTP 401)** | Implemented | Supertest requests without token and with tampered token | `tests/orders.integration.test.ts` lines 59-81 (HTTP 401 verified) | None |
| **Product CRUD, Pagination & Search** | Implemented | Supertest GET with query params `page`, `per_page`, `search` | `tests/orders.integration.test.ts` lines 128-140 | None |
| **Product Code Uniqueness (HTTP 409)** | Implemented | Supertest duplicate product creation | `tests/orders.integration.test.ts` lines 102-126 (HTTP 409 verified) | None |
| **Transactional Order Creation** | Implemented | Supertest `POST /api/orders` against real PostgreSQL | `tests/orders.integration.test.ts` lines 191-240 | None |
| **Row-Level Locking (`SELECT FOR UPDATE`)** | Implemented | Two concurrent orders (`Promise.all`) requesting 4 units of 5 available | `tests/orders.integration.test.ts` lines 360-401 (exactly 1 succeeds, 1 fails with 422, final stock = 1) | None |
| **Historical Price Snapshot** | Implemented | Mutating product price in DB after order creation; reading order detail | `tests/orders.integration.test.ts` lines 230-240 (snapshot price preserved) | None |
| **Variant C VAT (11% Ceil to Rp 100)** | Implemented | Unit assertions on `calculateVariantCTax` & order placement with Rp155,450 | `tests/orders.integration.test.ts` lines 158-189 (155,450 subtotal -> 17,100 tax -> 172,550 total) | None |
| **Daily Counter Order Numbering** | Implemented | 5 concurrent order submissions via `Promise.all` | `tests/orders.integration.test.ts` lines 403-439 (5 unique `INV-YYYYMMDD-XXXX` generated) | None |
| **Stock Restoration on Cancel** | Implemented | `PATCH /api/orders/:id/cancel` from PENDING and PAID | `tests/orders.integration.test.ts` lines 268-305 (stock fully restored) | None |
| **Simultaneous Cancellation Safety** | Implemented | Two concurrent cancel requests via `Promise.all` | `tests/orders.integration.test.ts` lines 441-477 (one 200, one 409; stock restored once) | None |
| **Invalid Status Transitions (HTTP 409)** | Implemented | `PAID->PAID`, `CANCELLED->CANCELLED`, `CANCELLED->PAID` transitions | `tests/orders.integration.test.ts` lines 307-356 (HTTP 409 returned) | None |
| **Optional Idempotency-Key** | Implemented | Replaying same payload with same key returns original order; modified payload returns 409 | `tests/orders.integration.test.ts` lines 479-536 (201 repeat, 409 mismatch verified) | None |
| **Docker Compose 3-Service Topology** | Implemented | `docker-compose.yml` declaring `postgres`, `backend`, `frontend` with healthchecks | `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile` | None |
| **Production Vercel Deployments** | Implemented | Deployed both independent projects using Vercel CLI | Backend: `https://azatech-api.vercel.app`, Frontend: `https://azatech-web.vercel.app` | None |
