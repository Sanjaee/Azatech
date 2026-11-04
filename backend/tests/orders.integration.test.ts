import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { app } from '../src/app';
import { ensureDatabaseReady, closeDatabase } from '../src/db/runtime';
import { getDb } from '../src/db';
import { products, customers, orders, orderCounters, orderIdempotency } from '../src/db/schema';
import { env } from '../src/config/env';
import { calculateVariantCTax } from '../src/utils/money';

describe('Azatech OMS — Pengujian Integrasi Varian C (Sistem Manajemen Order)', () => {
  let token: string;
  let testCustomerId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await ensureDatabaseReady({ seed: true });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: env.SEED_ADMIN_EMAIL,
        password: env.SEED_ADMIN_PASSWORD,
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.data.token).toBeDefined();
    token = loginRes.body.data.token;

    const db = getDb();
    const [firstCustomer] = await db.select().from(customers).limit(1);
    expect(firstCustomer).toBeDefined();
    testCustomerId = firstCustomer.id;
  });

  afterAll(async () => {
    try {
      const db = getDb();
      const { like } = await import('drizzle-orm');
      await db.delete(orderIdempotency);
      await db.delete(orders);
      await db.delete(products).where(like(products.productCode, 'PRD-%'));
    } catch {
      // Ignore cleanup errors on teardown
    }
    await closeDatabase();
  });

  // =========================================================================
  // Mandatory Test 6 & Additional Auth Tests: Protected endpoints & JWT auth
  // =========================================================================
  describe('1. Autentikasi & Otorisasi JWT', () => {
    it('Wajib #6: Menolak request ke endpoint terproteksi jika tanpa token JWT (HTTP 401)', async () => {
      const resProducts = await request(app).get('/api/products');
      expect(resProducts.status).toBe(401);
      expect(resProducts.body.success).toBe(false);

      const resCustomers = await request(app).get('/api/customers');
      expect(resCustomers.status).toBe(401);

      const resOrders = await request(app).get('/api/orders');
      expect(resOrders.status).toBe(401);

      const resCreateOrder = await request(app).post('/api/orders').send({});
      expect(resCreateOrder.status).toBe(401);
    });

    it('Menolak request dengan token JWT yang tidak valid atau telah dimanipulasi (HTTP 401)', async () => {
      const res = await request(app)
        .get('/api/products')
        .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('Menolak login jika email atau password salah (HTTP 401)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: env.SEED_ADMIN_EMAIL,
          password: 'WrongPassword123!',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/invalid email or password/i);
    });
  });

  // =========================================================================
  // Additional Tests: Products uniqueness, pagination, and search
  // =========================================================================
  describe('2. Endpoint Produk & Pelanggan', () => {
    it('Berhasil membuat produk baru dan mencegah duplikasi kode produk (HTTP 409)', async () => {
      const uniqueCode = `PRD-TEST-${Date.now()}`;

      const res1 = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          product_code: uniqueCode,
          name: 'Unique Mechanical Keyboard',
          price: 750000,
          stock: 25,
        });

      expect(res1.status).toBe(201);
      expect(res1.body.data.product_code).toBe(uniqueCode);

      const res2 = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          product_code: uniqueCode,
          name: 'Duplicate Keyboard',
          price: 800000,
          stock: 10,
        });

      expect(res2.status).toBe(409);
      expect(res2.body.success).toBe(false);
      expect(res2.body.message).toMatch(/already in use|already exists/i);
    });

    it('Mendukung pencarian nama/kode, filter stok, dan pagination pada GET /api/products', async () => {
      const res = await request(app)
        .get('/api/products?page=1&per_page=5&search=Keyboard')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta).toBeDefined();
      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.per_page).toBe(5);
    });

    it('Validasi Zod: Menolak produk dengan harga negatif atau stok tidak valid (HTTP 422)', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          product_code: `PRD-INVALID-${Date.now()}`,
          name: 'Bad Product',
          price: -5000,
          stock: -1,
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // Mandatory Test 5: Variant C VAT calculation and rounding
  // =========================================================================
  describe('3. Perhitungan Pajak Varian C (PPN 11% Dibulatkan ke Atas ke Kelipatan Rp 100 Terdekat)', () => {
    it('Wajib #5: Memverifikasi rumus pembulatan ke atas PPN 11% ke kelipatan Rp 100 terdekat', async () => {
      // Test cases from specification:
      // Subtotal 155.450 -> raw 11% = 17.099,50 -> CEIL to Rp 100 = 17.100
      const test1 = calculateVariantCTax(155450);
      expect(test1.taxAmountNumber).toBe(17100);
      expect(test1.grandTotalNumber).toBe(172550);

      // Subtotal 100.000 -> raw 11% = 11.000 -> exact = 11.000
      const test2 = calculateVariantCTax(100000);
      expect(test2.taxAmountNumber).toBe(11000);
      expect(test2.grandTotalNumber).toBe(111000);

      // Subtotal 100.001 -> raw 11% = 11.000,11 -> CEIL to Rp 100 = 11.100
      const test3 = calculateVariantCTax(100001);
      expect(test3.taxAmountNumber).toBe(11100);
      expect(test3.grandTotalNumber).toBe(111101);

      // Create an actual order and verify database-persisted values
      const prodRes = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          product_code: `PRD-VAT-${Date.now()}`,
          name: 'Precision VAT Test Item',
          price: 155450,
          stock: 10,
        });

      expect(prodRes.status).toBe(201);
      const vatProductId = prodRes.body.data.id;

      const orderRes = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          customer_id: testCustomerId,
          items: [{ product_id: vatProductId, quantity: 1 }],
        });

      expect(orderRes.status).toBe(201);
      expect(orderRes.body.data.subtotal).toBe(155450);
      expect(orderRes.body.data.tax_amount).toBe(17100);
      expect(orderRes.body.data.grand_total).toBe(172550);
    });
  });

  // =========================================================================
  // Mandatory Tests 1, 2, 3, 4: Order Lifecycle & Stock Conservation
  // =========================================================================
  describe('4. Siklus Hidup Order & Konsistensi Stok (Transaksi ACID)', () => {
    it('Wajib #1: Berhasil membuat order, snapshot harga produk, dan memotong stok di database', async () => {
      const prodRes = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          product_code: `PRD-ORDER-${Date.now()}`,
          name: 'Order Lifecycle Monitor',
          price: 125000,
          stock: 20,
        });

      const productId = prodRes.body.data.id;

      const createRes = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          customer_id: testCustomerId,
          items: [{ product_id: productId, quantity: 2 }],
        });

      expect(createRes.status).toBe(201);
      const order = createRes.body.data;
      expect(order.order_number).toMatch(/^INV-\d{8}-\d{4}$/);
      expect(order.status).toBe('PENDING');
      expect(order.subtotal).toBe(250000);
      expect(order.tax_amount).toBe(27500); // 11% of 250.000 = 27.500
      expect(order.grand_total).toBe(277500);
      expect(order.items[0].product_name).toBe('Order Lifecycle Monitor');
      expect(order.items[0].unit_price).toBe(125000);

      // Verify stock in database was decremented: 20 - 2 = 18
      const db = getDb();
      const [productAfter] = await db.select().from(products).where(eq(products.id, productId));
      expect(productAfter.stock).toBe(18);

      // Now change product master price to 999.000; historical order price MUST NOT change!
      await db.update(products).set({ price: '999000.00' }).where(eq(products.id, productId));

      const fetchRes = await request(app)
        .get(`/api/orders/${order.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(fetchRes.status).toBe(200);
      expect(fetchRes.body.data.items[0].unit_price).toBe(125000);
      expect(fetchRes.body.data.subtotal).toBe(250000);
    });

    it('Wajib #2: Melakukan rollback seluruh transaksi jika stok produk tidak mencukupi (HTTP 422)', async () => {
      const prodRes = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          product_code: `PRD-ROLLBACK-${Date.now()}`,
          name: 'Low Stock Item',
          price: 50000,
          stock: 3,
        });

      const productId = prodRes.body.data.id;

      // Attempt to order quantity 5 when only 3 are available
      const orderRes = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          customer_id: testCustomerId,
          items: [{ product_id: productId, quantity: 5 }],
        });

      expect(orderRes.status).toBe(422);
      expect(orderRes.body.success).toBe(false);
      expect(orderRes.body.errors).toBeDefined();

      // Verify stock was unaffected: still 3
      const db = getDb();
      const [productAfter] = await db.select().from(products).where(eq(products.id, productId));
      expect(productAfter.stock).toBe(3);
    });

    it('Wajib #3: Mengembalikan stok produk otomatis saat order dibatalkan dari status PENDING atau PAID', async () => {
      const prodRes = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          product_code: `PRD-CANCEL-${Date.now()}`,
          name: 'Cancellable Headset',
          price: 300000,
          stock: 12,
        });

      const productId = prodRes.body.data.id;

      // Create order for 4 items -> stock becomes 8
      const createRes = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          customer_id: testCustomerId,
          items: [{ product_id: productId, quantity: 4 }],
        });

      const orderId = createRes.body.data.id;

      const db = getDb();
      const [afterOrder] = await db.select().from(products).where(eq(products.id, productId));
      expect(afterOrder.stock).toBe(8);

      // Pay the order (PENDING -> PAID)
      const payRes = await request(app)
        .patch(`/api/orders/${orderId}/pay`)
        .set('Authorization', `Bearer ${token}`);
      expect(payRes.status).toBe(200);
      expect(payRes.body.data.status).toBe('PAID');

      // Cancel the PAID order (PAID -> CANCELLED) -> stock restored to 12
      const cancelRes = await request(app)
        .patch(`/api/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${token}`);

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.data.status).toBe('CANCELLED');

      const [afterCancel] = await db.select().from(products).where(eq(products.id, productId));
      expect(afterCancel.stock).toBe(12);
    });

    it('Wajib #4: Menolak transisi status ilegal (HTTP 409) dan mencegah pembatalan ganda agar stok tidak bertambah 2x', async () => {
      const prodRes = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          product_code: `PRD-TRANSITION-409-${Date.now()}`,
          name: 'Transition Guard Product',
          price: 200000,
          stock: 10,
        });

      const productId = prodRes.body.data.id;

      const createRes = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          customer_id: testCustomerId,
          items: [{ product_id: productId, quantity: 3 }],
        });

      const orderId = createRes.body.data.id;

      // 1. Pay order (PENDING -> PAID): 200 OK
      const pay1 = await request(app)
        .patch(`/api/orders/${orderId}/pay`)
        .set('Authorization', `Bearer ${token}`);
      expect(pay1.status).toBe(200);

      // 2. Paying an already PAID order (PAID -> PAID): 409 Conflict
      const payAgain = await request(app)
        .patch(`/api/orders/${orderId}/pay`)
        .set('Authorization', `Bearer ${token}`);
      expect(payAgain.status).toBe(409);

      // 3. Cancel order (PAID -> CANCELLED): 200 OK
      const cancel1 = await request(app)
        .patch(`/api/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${token}`);
      expect(cancel1.status).toBe(200);

      // 4. Cancelling an already CANCELLED order (CANCELLED -> CANCELLED): 409 Conflict
      const cancelAgain = await request(app)
        .patch(`/api/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${token}`);
      expect(cancelAgain.status).toBe(409);

      // 5. Paying a CANCELLED order (CANCELLED -> PAID): 409 Conflict
      const payCancelled = await request(app)
        .patch(`/api/orders/${orderId}/pay`)
        .set('Authorization', `Bearer ${token}`);
      expect(payCancelled.status).toBe(409);

      // Verify stock was restored only once (remains 10, not 13)
      const db = getDb();
      const [finalProduct] = await db.select().from(products).where(eq(products.id, productId));
      expect(finalProduct.stock).toBe(10);
    });
  });

  // =========================================================================
  // Section C, D, E: Concurrency & Idempotency Integration Tests
  // =========================================================================
  describe('5. Concurrency (Pencegahan Race Condition) & Idempotency Key', () => {
    it('Anti-Overselling: Mencegah stok minus saat dua order dikirim bersamaan berebut sisa stok (Pessimistic Lock)', async () => {
      const prodRes = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          product_code: `PRD-CONCURRENT-5-${Date.now()}`,
          name: 'Limited Edition GPU',
          price: 5000000,
          stock: 5,
        });

      const productId = prodRes.body.data.id;

      // Two simultaneous requests each ordering 4 units when only 5 units exist
      const [resA, resB] = await Promise.all([
        request(app)
          .post('/api/orders')
          .set('Authorization', `Bearer ${token}`)
          .send({
            customer_id: testCustomerId,
            items: [{ product_id: productId, quantity: 4 }],
          }),
        request(app)
          .post('/api/orders')
          .set('Authorization', `Bearer ${token}`)
          .send({
            customer_id: testCustomerId,
            items: [{ product_id: productId, quantity: 4 }],
          }),
      ]);

      const statuses = [resA.status, resB.status].sort();
      // Exactly one request succeeds (201) and one fails with insufficient stock (422)
      expect(statuses).toEqual([201, 422]);

      const db = getDb();
      const [finalProduct] = await db.select().from(products).where(eq(products.id, productId));
      // 5 initial - 4 ordered = 1 remaining (never negative!)
      expect(finalProduct.stock).toBe(1);
    });

    it('Nomor Invoice Unik: Menghasilkan format INV-YYYYMMDD-XXXX yang unik dan berurutan saat beban bersamaan', async () => {
      const prodRes = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          product_code: `PRD-CONC-NUM-${Date.now()}`,
          name: 'Order Number Test Item',
          price: 10000,
          stock: 50,
        });

      const productId = prodRes.body.data.id;

      // Dispatch 5 concurrent orders simultaneously
      const promises = Array.from({ length: 5 }, () =>
        request(app)
          .post('/api/orders')
          .set('Authorization', `Bearer ${token}`)
          .send({
            customer_id: testCustomerId,
            items: [{ product_id: productId, quantity: 1 }],
          })
      );

      const responses = await Promise.all(promises);
      for (const res of responses) {
        expect(res.status).toBe(201);
      }

      const orderNumbers = responses.map((r) => r.body.data.order_number);
      const uniqueOrderNumbers = new Set(orderNumbers);

      // Verify every order number is unique
      expect(uniqueOrderNumbers.size).toBe(5);
      // Verify format
      for (const num of orderNumbers) {
        expect(num).toMatch(/^INV-\d{8}-\d{4}$/);
      }
    });

    it('Pembatalan Simultan: Menangani dua request cancel bersamaan secara aman tanpa merestorasi stok ganda', async () => {
      const prodRes = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          product_code: `PRD-CONC-CANCEL-${Date.now()}`,
          name: 'Simultaneous Cancel Item',
          price: 50000,
          stock: 10,
        });

      const productId = prodRes.body.data.id;

      const orderRes = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          customer_id: testCustomerId,
          items: [{ product_id: productId, quantity: 3 }],
        });

      expect(orderRes.status).toBe(201);
      const orderId = orderRes.body.data.id;

      // Fire 2 simultaneous cancel requests for the same order
      const [cancel1, cancel2] = await Promise.all([
        request(app)
          .patch(`/api/orders/${orderId}/cancel`)
          .set('Authorization', `Bearer ${token}`),
        request(app)
          .patch(`/api/orders/${orderId}/cancel`)
          .set('Authorization', `Bearer ${token}`),
      ]);

      const statuses = [cancel1.status, cancel2.status].sort();
      // One request transitions the order and succeeds (200), the other sees non-cancellable state (409)
      expect(statuses).toEqual([200, 409]);

      // Verify stock was restored exactly once: 10 - 3 + 3 = 10 (NOT 13!)
      const db = getDb();
      const [finalProd] = await db.select().from(products).where(eq(products.id, productId));
      expect(finalProd.stock).toBe(10);
    });

    it('Bagian E: Mendukung header Idempotency-Key untuk replay order identik dan mencegah double-order', async () => {
      const prodRes = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          product_code: `PRD-IDEMP-${Date.now()}`,
          name: 'Idempotency Test Item',
          price: 75000,
          stock: 20,
        });

      const productId = prodRes.body.data.id;
      const idempotencyKey = `idem-key-${Date.now()}-${Math.random()}`;

      const payload1 = {
        customer_id: testCustomerId,
        items: [{ product_id: productId, quantity: 2 }],
      };

      // 1. Initial order creation with Idempotency-Key
      const res1 = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', idempotencyKey)
        .send(payload1);

      expect(res1.status).toBe(201);
      const originalOrder = res1.body.data;
      expect(originalOrder.order_number).toBeDefined();

      // Verify stock was decremented once: 20 - 2 = 18
      const db = getDb();
      let [prodState] = await db.select().from(products).where(eq(products.id, productId));
      expect(prodState.stock).toBe(18);

      // 2. Replay EXACT same request with same Idempotency-Key: returns original order without re-decrementing stock
      const res2 = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', idempotencyKey)
        .send(payload1);

      expect(res2.status).toBe(201);
      expect(res2.body.data.id).toBe(originalOrder.id);
      expect(res2.body.data.order_number).toBe(originalOrder.order_number);

      // Stock remains 18 (NOT decremented again to 16)
      [prodState] = await db.select().from(products).where(eq(products.id, productId));
      expect(prodState.stock).toBe(18);

      // 3. Reuse SAME Idempotency-Key with DIFFERENT payload: returns HTTP 409 Conflict
      const payload2 = {
        customer_id: testCustomerId,
        items: [{ product_id: productId, quantity: 3 }],
      };

      const res3 = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', idempotencyKey)
        .send(payload2);

      expect(res3.status).toBe(409);
      expect(res3.body.success).toBe(false);
      expect(res3.body.message).toMatch(/idempotency key reuse with different request payload/i);
    });

    it('Menolak pembuatan order dan mengembalikan HTTP 404 jika customer ID tidak ditemukan (HTTP 404)', async () => {
      const db = getDb();
      const [anyProduct] = await db.select().from(products).limit(1);

      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          customer_id: '00000000-0000-4000-8000-000000000999',
          items: [{ product_id: anyProduct.id, quantity: 1 }],
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('Anti-Tampering: Menolak jika client mencoba memanipulasi mengirimkan harga atau subtotal sendiri (HTTP 422)', async () => {
      const db = getDb();
      const [anyProduct] = await db.select().from(products).limit(1);

      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          customer_id: testCustomerId,
          subtotal: 1,
          tax_amount: 0,
          grand_total: 1,
          items: [
            {
              product_id: anyProduct.id,
              quantity: 1,
              unit_price: 1,
            },
          ],
        });

      // Strict Zod schema rejects untrusted financial fields with HTTP 422
      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });
  });
});
