# Panduan Wawancara Teknis — Azatech Fullstack Developer (Varian C)

Dokumen ini disusun khusus sebagai **cheat sheet praktis, jelas, dan mudah dicerna** bagi Saudara Ahmad saat menghadapi sesi wawancara teknis daring (Live Code & Screen Share) bersama Tim Azatech.

---

## ⚡ 1. Cheat Sheet Persiapan Sebelum Share Screen

Sebelum masuk ke Microsoft Teams, pastikan terminal Anda sudah siap di root folder project:

```bash
# 1. Jalankan pengujian otomatis (Pastikan 17 tests passed di depan interviewer)
npm run test

# 2. Cek typecheck TypeScript (Pastikan 0 errors)
npm run typecheck

# 3. Jalankan aplikasi secara lokal (Terminal terpisah)
# Opsi A: Jalankan langsung dengan server dev lokal
npm run dev:backend    # Berjalan di http://localhost:4000
npm run dev:frontend   # Berjalan di http://localhost:3000

# Opsi B: Jalankan full container dengan Docker Compose
docker compose up -d
```

### Kredensial & URL Cepat
- **Akun Admin:** `admin@azatech.id` / `Admin@Azatech2026!`
- **Frontend Lokal:** `http://localhost:3000` (atau Live: `https://azatech-web.vercel.app`)
- **Backend API:** `http://localhost:4000` (atau Live: `https://azatech-api.vercel.app`)
- **Database:** PostgreSQL (Neon Cloud / Local Docker)

---

## 🎙️ 2. Penjelasan Proyek dalam 2 Menit (Elevator Pitch)

Jika pewawancara meminta: *"Silakan perkenalkan diri dan jelaskan arsitektur project yang sudah Anda bangun"*, gunakan alur berikut:

> *"Project ini adalah **Order Management System (OMS)** berstandar produksi yang saya bangun spesifik untuk **Varian C** dengan penekanan pada **database ACID consistency, concurrency safety, dan keamanan arsitektur BFF**.*
>
> *1. **Arsitektur Decoupled & Keamanan BFF (Backend-for-Frontend):** Frontend Next.js dan Backend Express dideploy mandiri di domain terpisah. Browser tidak pernah memegang token JWT mentah di localStorage/JS storage. Autentikasi menggunakan cookie `HttpOnly` + `SameSite=Lax` di Next.js Route Handler yang meneruskan otorisasi via Bearer JWT ke Express API.*
>
> *2. **Integritas Bisnis Varian C:** Perhitungan PPN 11% dibulatkan ke atas ke kelipatan Rp 100 terdekat menggunakan aritmatika integer BigInt tanpa risiko floating-point drift.*
>
> *3. **Proteksi Konkurensi & Inventori:** Transaksi order menggunakan row-level pessimistic locking (`SELECT ... FOR UPDATE ORDER BY id ASC`) untuk mencegah deadlock dan race condition saat stok terbatas. Penomoran faktur harian menggunakan tabel counter atomik `order_counters` dengan zona waktu `Asia/Jakarta`.*
>
> *4. **Reliabilitas:** Dilengkapi dukungan `Idempotency-Key` untuk mencegah order ganda akibat retry jaringan, pembatalan order bersyarat yang mengembalikan stok tepat satu kali, dan 17 skenario automated integration test yang 100% lulus pada database PostgreSQL riil."*

---

## 🧭 3. Peta Navigasi Kode Saat Screen Sharing

Buka file-file kunci berikut di VS Code untuk dijelaskan langsung:

### A. Backend Kunci
| File | Fungsi Utama yang Perlu Ditunjukkan | Poin Penjelasan |
| :--- | :--- | :--- |
| [`backend/src/utils/money.ts`](backend/src/utils/money.ts) | `calculateVariantCTaxCents` & `calculateVariantCTax` | Rumus PPN 11% dibulatkan ke atas ke kelipatan Rp 100. Jelaskan mengapa pakai `BigInt` sen (mencegah bug desimal IEEE-754). |
| [`backend/src/modules/orders/orders.service.ts`](backend/src/modules/orders/orders.service.ts) | `createOrder` | **Core Transaction:** Validasi duplikasi produk, cek idempotency hash, sorting ID produk ascending, `SELECT FOR UPDATE`, potong stok, generate invoice atomik, snapshot harga historis. |
| [`backend/src/modules/orders/orders.service.ts`](backend/src/modules/orders/orders.service.ts) | `generateOrderNumber` | Alokasi nomor order harian via tabel `order_counters` (`INSERT ON CONFLICT DO UPDATE RETURNING`) dalam zona waktu `Asia/Jakarta`. |
| [`backend/src/modules/orders/orders.service.ts`](backend/src/modules/orders/orders.service.ts) | `cancelOrder` | Pembatalan bersyarat: hanya order `PENDING`/`PAID` yang bisa dicancel, update status & restore stok terjadi dalam 1 transaksi atomik. |
| [`backend/src/db/schema/index.ts`](backend/src/db/schema/index.ts) | Definisi tabel Drizzle ORM | Kolom `NUMERIC(15, 2)`, constraint `CHECK (stock >= 0)`, tabel `order_counters`, dan `order_idempotency`. |
| [`backend/tests/orders.integration.test.ts`](backend/tests/orders.integration.test.ts) | 17 integration tests | Tunjukkan pengujian order konkuren (`Promise.all`), uji pembatalan simultan, dan uji keaslian pembulatan PPN. |

### B. Frontend Kunci
| File | Fungsi Utama yang Perlu Ditunjukkan | Poin Penjelasan |
| :--- | :--- | :--- |
| [`frontend/src/app/api/auth/login/route.ts`](frontend/src/app/api/auth/login/route.ts) | Next.js Login Route Handler | Menerima email/password, memanggil Express API, lalu menaruh token ke cookie `HttpOnly` (`azatech_session`). |
| [`frontend/src/app/api/backend/[...path]/route.ts`](frontend/src/app/api/backend/[...path]/route.ts) | BFF Proxy Route | Memeriksa whitelist endpoint, membaca cookie `HttpOnly`, menempelkan `Bearer JWT` ke Express backend. |
| [`frontend/src/app/(dashboard)/orders/new/page.tsx`](frontend/src/app/(dashboard)/orders/new/page.tsx) | Form Create Order | Selector customer riil (`GET /api/customers`), selector produk multi-row, kalkulasi preview subtotal & PPN 11% dinamis, dan perataan UI input. |

---

## 🔍 4. Jawaban 5 Pertanyaan Krusial Penguji (FAQ)

### Q1: *"Bagaimana Anda mencegah stok minus jika dua orang memesan barang yang sama di detik yang sama?"*
**Jawaban:**
> *"Kami menerapkan sistem pertahanan 3 lapis:*
> 1. *Semua ID produk dalam pesanan diurutkan secara ascending (`ORDER BY id ASC`), lalu dikunci menggunakan `SELECT ... FOR UPDATE` di PostgreSQL. Urutan ascending ini mengeliminasi risiko deadlock antar pesanan yang melibatkan banyak barang.*
> 2. *Setelah row berhasil dikunci, kami memvalidasi ulang stok aktual di database. Jika `product.stock < item.quantity`, transaksi langsung di-rollback penuh dengan HTTP 422.*
> 3. *Eksekusi pemotongan stok dilakukan dengan query bersyarat `WHERE id = $1 AND stock >= $2`, ditambah constraint database `CHECK (stock >= 0)` sebagai jaring pengaman terakhir di storage level.*
>
> *(Ajak interviewer melihat tesnya): Ini terbukti pada integration test di mana 2 request konkuren masing-masing meminta 4 unit dari barang yang hanya tersisa 5; tepat 1 berhasil, 1 gagal, dan stok akhir tetap aman di angka 1."*

---

### Q2: *"Bagaimana implementasi pembulatan pajak Varian C?"*
**Jawaban:**
> *"Sesuai ketentuan Varian C, PPN adalah 11% yang dibulatkan **ke atas** ke kelipatan **Rp 100** terdekat:*
> $$\text{tax\_amount} = \lceil \text{subtotal} \times 0.11 / 100 \rceil \times 100$$
>
> *Di kode ([`backend/src/utils/money.ts`](backend/src/utils/money.ts)), kami mengonversi nilai uang ke satuan sen (`BigInt`) dan menggunakan rumus pembagian integer ceiling `(N + D - 1) / D`:*
> - *Contoh 1: Subtotal Rp 150.000 $\rightarrow$ Pajak mentah Rp 16.500 $\rightarrow$ Hasil akhir Rp 16.500.*
> - *Contoh 2: Subtotal Rp 155.450 $\rightarrow$ Pajak mentah Rp 17.099,50 $\rightarrow$ Dibulatkan ke atas menjadi **Rp 17.100**.*
> - *Contoh 3: Subtotal Rp 100.001 $\rightarrow$ Pajak mentah Rp 11.000,11 $\rightarrow$ Dibulatkan ke atas menjadi **Rp 11.100**.*
>
> *Semua nilai moneter disimpan di database menggunakan kolom `NUMERIC(15, 2)` untuk konsistensi pelaporan keuangan."*

---

### Q3: *"Bagaimana penomoran order `INV-YYYYMMDD-XXXX` dijamin tidak bentrok saat trafik tinggi?"*
**Jawaban:**
> *"Kami tidak menghitung `COUNT(*)` tabel orders karena rawan race condition. Kami membuat tabel terdedikasi `order_counters` dengan primary key `date_key VARCHAR(8)`:*
> 1. *Tanggal diambil menggunakan zona waktu `Asia/Jakarta` (`YYYYMMDD`).*
> 2. *Di dalam transaksi order, kami menjalankan `INSERT ... ON CONFLICT (date_key) DO UPDATE SET last_sequence = last_sequence + 1 RETURNING last_sequence`.*
> 3. *PostgreSQL menangani konkurensi ini secara atomik pada level baris tanggal hari ini.*
> 4. *Sebagai pelindung ganda, kolom `orders.order_number` memiliki constraint `UNIQUE`."*

---

### Q4: *"Jika toko mengubah harga produk besok, apakah total pesanan lama ikut berubah?"*
**Jawaban:**
> *"Tidak akan berubah, karena kami menerapkan **historical price snapshotting**. Pada saat transaksi order dibuat, data `product_name`, `product_code`, dan `unit_price` saat itu disalin langsung ke baris tabel `order_items`. Tabel `orders` dan `order_items` tidak pernah melakukan join harga live ke tabel master `products` saat menampilkan riwayat pesanan."*

---

### Q5: *"Bagaimana arsitektur autentikasi Anda melindungi pengguna dari serangan XSS dan CSRF?"*
**Jawaban:**
> *"Kami memisahkan kekhawatiran dengan pola BFF:*
> - *Browser berkomunikasi ke Next.js Route Handler.*
> - *Next.js menyimpan token JWT di cookie `HttpOnly`, `SameSite=Lax`, dan `Secure` (di production). Skrip JavaScript di browser (misal dari payload XSS berbahaya) mustahil membaca token JWT ini.*
> - *Next.js Route Handler melakukan verifikasi header `X-Requested-With` dan Origin untuk mencegah CSRF, lalu membungkus request ke Express API dengan header `Authorization: Bearer <JWT>`.*
> - *Express API memvalidasi signature HS256 JWT secara stateless pada setiap protected route."*

---

## 🛠️ 5. Antisipasi Live Coding (Perubahan Langsung Saat Wawancara)

Pewawancara sering meminta perubahan kecil untuk menguji pemahaman Anda:

### Skenario 1: *"Coba ubah persentase pajak dari 11% menjadi 12% atau ubah pembulatannya ke Rp 500"*
- **Buka file:** [`backend/src/utils/money.ts`](backend/src/utils/money.ts)
- **Cari baris:** `calculateVariantCTaxCents`
- **Ubah:**
  - Ubah pengali `11n` menjadi `12n` jika persentase naik jadi 12%.
  - Jika pembulatan diminta ke Rp 500: ubah pembagi dan pengali unit dari `100n` menjadi `500n`.
- **Verifikasi:** Jalankan `npm test` di terminal untuk melihat efek pengujiannya.

### Skenario 2: *"Coba tambahkan filter pencarian baru atau query parameter di API"*
- **Buka file:** [`backend/src/modules/products/products.schema.ts`](backend/src/modules/products/products.schema.ts) (tambahkan field di Zod schema).
- **Buka file:** [`backend/src/modules/products/products.service.ts`](backend/src/modules/products/products.service.ts) (tambahkan kondisi `where` Drizzle ORM menggunakan `like(...)` atau `eq(...)`).

### Skenario 3: *"Coba tambahkan status baru pada order, misalnya `PROCESSING` atau `SHIPPED`"*
- **Buka file:** [`backend/src/db/schema/index.ts`](backend/src/db/schema/index.ts) pada `orderStatusEnum` (`'PENDING'`, `'PAID'`, `'CANCELLED'`, tambahkan `'PROCESSING'`).
- **Buka file:** [`backend/src/modules/orders/orders.service.ts`](backend/src/modules/orders/orders.service.ts) untuk mengatur alur transisi statusnya (misal dari `PAID` ke `PROCESSING`).

---

## ✉️ 6. Template Balasan Konfirmasi Kehadiran Wawancara

Kirimkan pesan ini ke Pak Dion sebelum pukul 15.00 WIB:

```text
Selamat siang Pak Dion,

Terima kasih atas undangannya. Saya mengonfirmasi kehadiran saya untuk mengikuti wawancara teknis daring posisi Fullstack Developer Azatech pada:

- Hari, Tanggal : Rabu, 4 November 2026
- Pukul         : 22.00 – 23.00 WIB
- Media         : Microsoft Teams

Saya telah menyiapkan repository, database lokal, dan seluruh automated test dalam kondisi siap dijalankan untuk sesi live code dan walkthrough nanti malam.

Terima kasih, Pak Dion. Sampai berjumpa nanti malam.

Hormat saya,
Ahmad
```
