# Keputusan Teknis & Arsitektur (`DECISIONS.md`)

Dokumen ini menjawab 4 pertanyaan rekayasa perangkat lunak wajib dari panduan **Technical Test Azatech (Varian C: Order Management System)** secara lugas, transparan, dan mengacu langsung pada kode sumber serta implementasi nyata di repositori ini.

---

## 1. Bagaimana Anda mencegah stok minus saat dua order masuk bersamaan?

### Strategi Implementasi: *Deterministic Pessimistic Row-Level Locking* + *Atomic Conditional Decrement* + *Database CHECK Constraint*

Pencegahan stok minus saat terjadi lonjakan order secara bersamaan (*high concurrency race condition*) ditangani melalui 3 lapisan perlindungan (*defense-in-depth*) pada file [`backend/src/modules/orders/orders.service.ts`](backend/src/modules/orders/orders.service.ts) (fungsi `OrdersService.createOrder`) dan skema database [`backend/src/db/schema/index.ts`](backend/src/db/schema/index.ts):

1. **Pengurutan Kunci Deterministik (Pencegahan Deadlock):**
   Di dalam blok transaksi `db.transaction(async (tx) => { ... })` pada `OrdersService.createOrder`, seluruh ID produk (`product_id`) yang dipesan diurutkan secara alfabetis (ascending) sebelum proses penguncian baris dilakukan:
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
   Karena setiap transaksi yang berjalan bersamaan mengunci baris produk dengan urutan ID yang selalu sama (`ORDER BY id ASC FOR UPDATE`), kondisi *circular wait* (deadlock) antara order multi-item (misal `[Produk A, Produk B]` vs `[Produk B, Produk A]`) tidak akan pernah terjadi.

2. **Validasi Stok Setelah Baris Terkunci (*Post-Lock Validation*):**
   Ketika Transaksi A dan Transaksi B secara simultan mencoba membeli 4 unit dari produk yang stoknya hanya tersisa 5:
   - PostgreSQL memberikan kunci baris (`FOR UPDATE`) ke Transaksi A terlebih dahulu, sementara Transaksi B ditahan (*blocked/queued*).
   - Transaksi A memeriksa kondisi `product.stock >= item.quantity` (`5 >= 4`), berhasil membuat order, memotong stok menjadi `1`, lalu melakukan `COMMIT`.
   - Transaksi B baru terlepas dari antrean dan membaca data produk yang baru saja di-commit (`stock = 1`). Pengecekan `product.stock < item.quantity` (`1 < 4`) gagal, sehingga sistem melempar `ValidationError('Stok tidak mencukupi')` dan membatalkan (*ROLLBACK*) seluruh transaksi secara utuh.

3. **Pengurangan Atomik Bersyarat & PostgreSQL CHECK Constraint:**
   Saat memotong stok produk di langkah ke-16 `OrdersService.createOrder`, perintah SQL `UPDATE` diberi klausul pengaman atomik (`WHERE id = $1 AND stock >= $2`):
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
   Selain itu, tabel `products` pada [`backend/src/db/schema/index.ts`](backend/src/db/schema/index.ts) memiliki aturan `CHECK ("products"."stock" >= 0)` (`products_stock_non_negative_chk`) langsung di level database engine PostgreSQL, sehingga stok negatif secara fisik mustahil terjadi meskipun kode aplikasi di-bypass.

4. **Verifikasi Pengujian Otomatis:**
   Skenario balapan (*race condition*) ini dibuktikan pada file pengujian [`backend/tests/orders.integration.test.ts`](backend/tests/orders.integration.test.ts) pada bagian:
   `Anti-Overselling (Pessimistic Lock): Mencegah stok minus saat dua order masuk bersamaan berebut sisa stok`.
   Dua request `POST /api/orders` masing-masing meminta 4 unit barang dari produk bersisa 5 secara serentak (`Promise.all`); tepat 1 transaksi sukses (`HTTP 201`) dan 1 transaksi ditolak (`HTTP 422`), dengan sisa stok akhir terbukti tepat bernilai `1`.

---

## 2. Mengapa struktur folder dan lapisan kode Anda seperti ini, dan apa yang akan Anda ubah jika aplikasi membesar?

### Alasan Pemilihan Struktur Saat Ini

Repositori ini menerapkan arsitektur *two-project monorepo* mandiri (`backend/` dan `frontend/`) dengan pembagian modular berbasis domain di dalam [`backend/src/modules/{auth,products,customers,orders}`](backend/src/modules/):

- **Batas Deployment yang Independen:** Backend Express dan Frontend Next.js di-deploy sebagai dua layanan terpisah dengan `package.json` dan `tsconfig.json` masing-masing. Hal ini mencegah dependensi runtime bercampur (misalnya Next.js tidak akan mem-bundle library Node `pg` atau `bcryptjs`, dan Express tidak mem-bundle dependensi React).
- **Pemisahan Tanggung Jawab (*Separation of Concerns*):** Tiap modul backend dibagi menjadi:
  - `*.schema.ts`: Skema validasi Zod yang ketat (*whitelisting payload* aman, membuang properti berbahaya dari request).
  - `*.controller.ts`: Adapter HTTP ramping yang mem-parsing input dan mengembalikan response terstandarisasi (`sendSuccess`).
  - `*.service.ts`: Pusat aturan bisnis, formula finansial (`calculateVariantCTaxCents` di [`backend/src/utils/money.ts`](backend/src/utils/money.ts)), dan batasan transaksi database (`db.transaction`).
  - `*.routes.ts`: Pendaftaran router Express dan pemasangan middleware keamanan (`requireAuth`, `loginLimiter`).

### Apa yang Akan Diubah Jika Aplikasi Membesar (*Scalability*)

1. **Shared Contracts Package (`packages/contracts`):** Jika modul berkembang menjadi belasan atau puluhan, antarmuka TypeScript dan Zod schema yang saat ini ada di backend dan frontend akan diekstrak menjadi satu package monorepo bersama (`npm workspace`) atau di-generate otomatis via OpenAPI/Swagger untuk mencegah inkonsistensi tipe data.
2. **Lapisan Akses Data / Repository Pattern:** Saat ini kueri Drizzle ORM dijalankan langsung di dalam `*.service.ts`. Jika logika kueri semakin rumit (misal alokasi stok multi-gudang, limit kredit pelanggan, pencatatan jurnal akuntansi), pembuatan file `*.repository.ts` yang menerima objek transaksi (`tx`) akan memisahkan orkestrasi bisnis murni dari sintaks SQL.
3. **Pola Transaksional Outbox & Message Broker:** Jika status pembayaran (`PAID`) atau pembatalan (`CANCELLED`) harus memicu integrasi pihak ketiga (email invoice, push notification, webhook logistik/ERP), kita akan menambahkan tabel `transactional_outbox` yang ditulis di transaksi yang sama, lalu diproses secara asinkron oleh background worker (misal menggunakan BullMQ/Redis atau Kafka) agar tidak memperlambat respon HTTP pengguna.

---

## 3. Satu bug atau masalah nyata yang ditemui saat pengerjaan, dan bagaimana cara menemukannya.

### Masalah: Filter Rentang Tanggal `YYYY-MM-DD` Mengabaikan Order di Hari yang Sama pada `GET /api/orders`

- **Lokasi Terjadinya:** [`backend/src/modules/orders/orders.service.ts`](backend/src/modules/orders/orders.service.ts) pada fungsi `OrdersService.listOrders`.
- **Bagaimana Ditemukan:** Saat menguji filter order di frontend dengan memasukkan tanggal hari ini pada `start_date` dan `end_date` (misal `?start_date=2026-11-02&end_date=2026-11-02`), daftar order yang baru saja dibuat hari itu tidak muncul sama sekali. Setelah ditelusuri, `new Date('2026-11-02')` secara default diubah ke `2026-11-02T00:00:00.000Z` (tengah malam). Penggunaan operator kueri SQL `lte(orders.createdAt, new Date(end_date))` membuat seluruh order yang dibuat setelah jam `00:00:00` di hari tersebut tersaring keluar.
- **Solusi Perbaikan:** Pada `OrdersService.listOrders`, format tanggal berupa string tanggal murni (`length <= 10`) dinormalisasi secara eksplisit: `start_date` diset ke awal hari (`00:00:00.000`), dan `end_date` diperpanjang hingga detik terakhir hari bersangkutan (`23:59:59.999`):
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

## 4. Bagian yang belum selesai atau masih lemah, serta langkah perbaikan selanjutnya.

1. **Pencabutan Token JWT Stateless (*Token Blacklist / Refresh Token Rotation*):**
   - *Kondisi Saat Ini:* Fitur logout (`POST /api/auth/logout`) di Next.js BFF menghapus cookie HttpOnly `azatech_session`, sehingga browser seketika kehilangan sesi. Namun secara kriptografis token JWT Express masih valid hingga masa kadaluwarsanya berakhir (`8h`).
   - *Langkah Perbaikan:* Menggunakan access token berumur pendek (15 menit) yang dipasangkan dengan mekanisme *Refresh Token* berbasis database (tabel `refresh_tokens`) sehingga sesi dapat langsung di-revoke di sisi server saat user logout atau mengganti password.
2. **Penyimpanan Rate Limiting Terdistribusi:**
   - *Kondisi Saat Ini:* Pembatasan brute force login di [`backend/src/modules/auth/auth.routes.ts`](backend/src/modules/auth/auth.routes.ts) menggunakan memori bawaan `express-rate-limit` per *instance/container*.
   - *Langkah Perbaikan:* Menghubungkan rate limiter ke Upstash Redis atau tabel counter PostgreSQL agar hitungan percobaan login tersinkronisasi di seluruh container/serverless instance.
3. **Buku Besar Audit Jejak Stok (*Inventory Audit Trail Ledger*):**
   - *Kondisi Saat Ini:* Kolom `products.stock` diubah langsung di tempat (*in-place update*) saat order dibuat atau dibatalkan.
   - *Langkah Perbaikan:* Menambahkan tabel `inventory_movements` yang bersifat *append-only* (mencatat delta `+` / `-`, user ID pelaku, alasan transaksi `ORDER_CREATED` / `ORDER_CANCELLED`, dan nomor order terkait) untuk mempermudah audit fisik dan rekonsiliasi stok gudang.

---

## 5. Arsitektur Tambahan: Nomor Invoice Harian & Idempotency Key

### A. Counter Nomor Invoice Harian (`order_counters`) dengan Zona Waktu Asia/Jakarta
Untuk menghasilkan nomor invoice berurutan tanpa mengunci seluruh tabel `orders`, dibuat tabel khusus `order_counters`:
- `date_key VARCHAR(8) PRIMARY KEY`: Berformat `YYYYMMDD` berdasarkan waktu lokal `Asia/Jakarta`.
- `last_sequence INTEGER NOT NULL`: Angka urutan terakhir pada hari tersebut.

Alokasi nomor urut dijalankan secara atomik di dalam transaksi:
```sql
INSERT INTO order_counters (date_key, last_sequence, updated_at)
VALUES ($1, 1, NOW())
ON CONFLICT (date_key) DO UPDATE
SET last_sequence = order_counters.last_sequence + 1, updated_at = NOW()
RETURNING last_sequence;
```
Hasilnya adalah nomor invoice unik `INV-YYYYMMDD-XXXX` (contoh: `INV-20261102-0001`) yang terjamin urut, bebas tabrakan, dan dilindungi oleh konstrain `UNIQUE` pada kolom `orders.order_number`.

### B. Keamanan Transaksi Pembatalan Order (PATCH /cancel)
Pembatalan order (`OrdersService.cancelOrder`) dijalankan dalam satu transaksi database:
1. `SELECT ... FROM orders WHERE id = $1 FOR UPDATE` mengunci baris order.
2. Jika status order bukan `PENDING` atau `PAID`, sistem melempar `ConflictError` (HTTP 409).
3. Status diubah menjadi `CANCELLED`.
4. Seluruh produk pada `order_items` dibaca dan stoknya dikembalikan (`stock = stock + quantity`).
Jika dua request cancel dikirim bersamaan, tepat satu transaksi yang berhasil merestorasi stok; request kedua menerima HTTP 409 sehingga stok tidak akan pernah terduplikasi 2 kali.

### C. Penanganan Idempotency Key (`order_idempotency`)
Sistem mendukung header HTTP `Idempotency-Key` untuk mencegah order ganda saat jaringan internet pengguna tidak stabil:
1. Hash SHA-256 dari payload pesanan disimpan bersama key tersebut.
2. Jika request dengan key yang sama dikirim ulang dengan payload yang persis sama, sistem langsung mengembalikan data order sebelumnya tanpa membuat order baru atau memotong stok ulang.
3. Jika key yang sama digunakan dengan payload berbeda, sistem menolak dengan `HTTP 409 Conflict`.
