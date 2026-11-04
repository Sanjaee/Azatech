# Pengungkapan Penggunaan AI (`AI_USAGE.md`)

Sesuai dengan panduan penilaian teknis **Azatech Fullstack Developer Technical Test (Varian C: Order Management System)**, dokumen ini mencatat secara transparan dan jujur seluruh penggunaan perangkat bantu kecerdasan buatan (*AI tools*) selama pengerjaan proyek ini.

---

## 1. Perangkat Bantu AI yang Digunakan

- **Antigravity (Google DeepMind Coding Agent)** — Digunakan sebagai asisten pemrograman berpasangan (*pair programmer*) untuk *scaffolding* monorepo, pembuatan skema Drizzle ORM, implementasi modul Express REST API, pembuatan antarmuka Next.js App Router (BFF proxy & dashboard UI), serta penyusunan skenario automated integration test.

---

## 2. Bagian Proyek yang Dibantu oleh AI

1. **Konfigurasi Monorepo & Lingkungan Build:**
   Menyiapkan konfigurasi TypeScript *strict-mode* terpisah untuk `backend/` dan `frontend/`, penyesuaian token Tailwind CSS, serta integrasi Vercel serverless routing (`backend/api/index.ts`, `backend/vercel.json`) dan Dockerfile multi-stage.
2. **Skema Database & Seeder Idempoten:**
   Menerjemahkan 5 tabel utama (`users`, `products`, `customers`, `orders`, `order_items`) ditambah 2 tabel sistem (`order_counters`, `order_idempotency`) ke dalam Drizzle ORM ([`backend/src/db/schema/index.ts`](backend/src/db/schema/index.ts)) lengkap dengan presisi `NUMERIC(15, 2)`, relasi foreign key, indeks pencarian, dan *database constraint* `CHECK (price > 0)` dan `CHECK (stock >= 0)`.
3. **Logika Transaksional & Formula Varian C:**
   Menyusun fungsi `calculateVariantCTaxCents` ([`backend/src/utils/money.ts`](backend/src/utils/money.ts)) menggunakan kalkulasi integer-cent rupiah (*Ceiling Rounding* PPN 11% ke kelipatan Rp 100 terdekat) serta transaksi ACID pada `OrdersService.createOrder`, `payOrder`, dan `cancelOrder` dengan *pessimistic row-level locking* (`SELECT ... FOR UPDATE`).
4. **Next.js Backend-For-Frontend (BFF) & Komponen Dashboard UI:**
   Membangun session handler HttpOnly cookie ([`frontend/src/app/api/auth/*`](frontend/src/app/api/auth/)), proxy aman dengan proteksi CSRF ([`frontend/src/app/api/backend/[...path]/route.ts`](frontend/src/app/api/backend/[...path]/route.ts)), serta halaman antarmuka pengguna: Login, Daftar Produk, Buat Order (form interaktif), dan Riwayat/Detail Order.
5. **Penyusunan Integration Test Suite:**
   Menyusun 20 skenario pengujian integrasi Supertest + Vitest ([`backend/tests/orders.integration.test.ts`](backend/tests/orders.integration.test.ts)) yang memvalidasi seluruh ketentuan teknis langsung ke database PostgreSQL nyata.

---

## 3. Contoh Prompt Utama yang Digunakan (*Disalin Apa Adanya*)

Berikut adalah 4 contoh representatif prompt utama yang diberikan selama pengerjaan:

1. **Prompt Pembuatan Skema Database & Validasi Zod:**
   > *"Create the Drizzle ORM PostgreSQL schema in `backend/src/db/schema/index.ts` for `users`, `products`, `customers`, `orders`, and `order_items` with `NUMERIC(15, 2)` monetary columns, `order_status` enum (`PENDING`, `PAID`, `CANCELLED`), indexes on search/status/date columns, and database `CHECK` constraints ensuring positive prices and non-negative stock."*

2. **Prompt Mesin Transaksi Order & Logika Varian C:**
   > *"Implement `OrdersService.createOrder` in `backend/src/modules/orders/orders.service.ts` following Variant C: reject client-submitted financial fields, sort product IDs in ascending order before `SELECT ... FOR UPDATE`, validate stock after locking, compute Variant C 11% PPN rounded up to the nearest Rp100 (`CEILING(subtotal * 0.11 / 100) * 100`), generate `INV-YYYYMMDD-XXXX` order numbers safely under concurrency, snapshot product name/code/price in `order_items`, and roll back completely if any item fails."*

3. **Prompt Keamanan BFF Next.js & Cookie HttpOnly:**
   > *"Implement a secure Next.js App Router BFF in `frontend/src/app/api/auth/*` and `frontend/src/app/api/backend/[...path]/route.ts` that stores the Express JWT in an `HttpOnly`, `SameSite=Lax` cookie, strips the raw token from browser responses, validates `Origin` and `X-Requested-With` CSRF headers on mutations, and enforces an explicit allowlist of permitted backend paths and HTTP methods."*

4. **Prompt Automated Integration Test:**
   > *"Write real PostgreSQL integration tests in `backend/tests/orders.integration.test.ts` covering all 6 mandatory scenarios plus concurrent order requests competing for limited stock, duplicate cancellation protection, and historical price snapshot immutability."*

---

## 4. Bagian Kode yang Ditulis, Ditinjau, dan Diubah Sendiri

Setiap berkas kode dan aturan bisnis diuji, ditinjau secara mendalam (*code review*), dan disesuaikan langsung dengan spesifikasi dokumen Azatech:

1. **Verifikasi Manual Rumus Pembulatan PPN Varian C:**
   Menguji secara manual akurasi rumus integer *ceiling division* `(subtotalCents * 11n + 999_999n) / 1_000_000n * 10_000n` terhadap angka-angka kasus batas:
   - Subtotal `Rp 150.000` $\rightarrow$ PPN `Rp 16.500`, Grand Total `Rp 166.500`.
   - Subtotal `Rp 150.010` $\rightarrow$ PPN mentah `Rp 16.501,10` $\rightarrow$ dibulatkan ke atas menjadi `Rp 16.600`, Grand Total `Rp 166.610`.
   - Subtotal `Rp 155.450` $\rightarrow$ PPN mentah `Rp 17.099,50` $\rightarrow$ dibulatkan ke atas menjadi `Rp 17.100`, Grand Total `Rp 172.550`.
2. **Penyempurnaan Penanganan Concurrency & Idempotency Key:**
   Menambahkan implementasi tabel `order_counters` dengan atomik `INSERT ON CONFLICT DO UPDATE RETURNING` berbasis zona waktu `Asia/Jakarta`, serta penanganan `Idempotency-Key` dengan hashing SHA-256 payload untuk mencegah pesanan ganda saat koneksi jaringan tidak stabil.
3. **Perbaikan Masalah Filter Tanggal (Date-Only Edge Case):**
   Memperbaiki bug query pada `listOrders` di mana format tanggal `YYYY-MM-DD` dari kalender frontend terpotong pada jam `00:00:00`, dinormalisasi agar mencakup hingga akhir hari (`23:59:59.999`).
4. **Penyelarasan Tampilan UI Line Items:**
   Menata ulang grid input pada form pembuatan pesanan (`frontend/src/app/(dashboard)/orders/new/page.tsx`) agar kolom *Product*, *Quantity*, *Item Subtotal*, dan tombol *Delete* sejajar presisi secara horizontal (`items-end`, tinggi seragam `h-10`), dan memisahkan badge harga/stok produk ke baris informasi di bawahnya.
5. **Verifikasi Penuh Build & Test Suite:**
   Menjalankan `npm run typecheck`, `npm run build`, `npm run test` di lokal dan Docker Compose untuk memastikan 0 kesalahan TypeScript, 0 kesalahan build, dan 20 dari 20 tes integrasi lulus 100%.
