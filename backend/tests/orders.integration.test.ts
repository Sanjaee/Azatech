import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { app } from '../src/app';
import { ensureDatabaseReady, closeDatabase } from '../src/db/runtime';
import { getDb } from '../src/db';
import { products, customers, orders } from '../src/db/schema';
import { env } from '../src/config/env';
import { calculateVariantCTax } from '../src/utils/money';

describe('Azatech OMS — Variant C Integration Tests', () => {
  let token: string;
  let testCustomerId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await ensureDatabaseReady({ forceInMemory: true, seed: true });

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
    await closeDatabase();
  });

  // =========================================================================
  // Mandatory Test 6 & Additional Auth Tests: Protected endpoints & JWT auth
  // =========================================================================
  describe('Authentication & Authorization', () => {
    it('Mandatory #6: rejects requests to protected endpoints without a token (HTTP 401)', async () => {
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

    it('rejects requests with an invalid or tampered JWT token (HTTP 401)', async () => {
      const res = await request(app)
        .get('/api/products')
        .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects login with invalid credentials (HTTP 401)', async () => {
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
  describe('Products & Customers APIs', () => {
    it('enforces product_code uniqueness on creation (HTTP 409) and positive price / non-negative stock', async () => {
      const uniqueCode = 'PRD-TEST-UNIQ-01';

      const createRes = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          product_code: uniqueCode,
          name: 'Azatech Precision Mousepad',
          description: 'XL Desk Mat',
          price: 250000,
          stock: 15,
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.data.product_code).toBe(uniqueCode);

      // Duplicate product_code must return 409
      const dupRes = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          product_code: uniqueCode,
          name: 'Duplicate Code Product',
          price: 100000,
          stock: 5,
        });

      expect(dupRes.status).toBe(409);
      expect(dupRes.body.success).toBe(false);

      // Zero or negative price must return 422
      const invalidPriceRes = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          product_code: 'PRD-INVALID-PRICE',
          name: 'Zero Price Item',
          price: 0,
          stock: 5,
        });

      expect(invalidPriceRes.status).toBe(422);
    });

    it('supports product pagination and search by product name and code', async () => {
      const pageRes = await request(app)
        .get('/api/products?page=1&per_page=5')
        .set('Authorization', `Bearer ${token}`);

      expect(pageRes.status).toBe(200);
      expect(pageRes.body.data.length).toBe(5);
      expect(pageRes.body.meta).toMatchObject({
        page: 1,
        per_page: 5,
      });
      expect(pageRes.body.meta.total).toBeGreaterThanOrEqual(16);

      const searchRes = await request(app)
        .get('/api/products?search=Hydrococo')
        .set('Authorization', `Bearer ${token}`);

      expect(searchRes.status).toBe(200);
      expect(searchRes.body.data.length).toBeGreaterThanOrEqual(1);
      expect(searchRes.body.data[0].product_code).toBe('PRD-BEV-015');
    });
  });

  // =========================================================================
  // Mandatory Test 5: Variant C VAT Calculation & Rounding
  // =========================================================================
  describe('Mandatory #5: Variant C VAT (PPN 11%) Calculation & Rounding', () => {
    it('calculates exact 11% VAT rounded UP to nearest Rp100 on unit & order creation', async () => {
      // Direct mathematical verification of examples in specification
      const ex1 = calculateVariantCTax(150000);
      expect(ex1.subtotalNumber).toBe(150000);
      expect(ex1.taxAmountNumber).toBe(16500);
      expect(ex1.grandTotalNumber).toBe(166500);

      const ex2 = calculateVariantCTax(150010);
      expect(ex2.subtotalNumber).toBe(150010);
      // 150,010 * 0.11 = 16,501.10 -> rounded UP to nearest Rp100 = 16,600
      expect(ex2.taxAmountNumber).toBe(16600);
      expect(ex2.grandTotalNumber).toBe(166610);

      // End-to-end API verification with Rp150,010 product
      const prodRes = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          product_code: 'PRD-VAT-150010',
          name: 'Variant C Tax Test Product',
          price: 150010,
          stock: 10,
        });

      expect(prodRes.status).toBe(201);
      const productId = prodRes.body.data.id;

      const orderRes = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          customer_id: testCustomerId,
          items: [{ product_id: productId, quantity: 1 }],
        });

      expect(orderRes.status).toBe(201);
      expect(orderRes.body.data.subtotal).toBe(150010);
      expect(orderRes.body.data.tax_amount).toBe(16600);
      expect(orderRes.body.data.grand_total).toBe(166610);
      expect(orderRes.body.data.order_number).toMatch(/^INV-\d{8}-\d{4}$/);
    });
  });

  // =========================================================================
  // Mandatory Test 1 & Historical Snapshot Test: Successful order creation
  // =========================================================================
  describe('Mandatory #1: Successful Order Creation & Historical Price Snapshot', () => {
    it('creates an order atomically, decreases stock, and preserves price snapshot after product price changes', async () => {
      const p1Res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          product_code: 'PRD-ORDER-OK-1',
          name: 'Snapshot Item Alpha',
          price: 75000,
          stock: 20,
        });
      const p2Res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          product_code: 'PRD-ORDER-OK-2',
          name: 'Snapshot Item Beta',
          price: 120000,
          stock: 10,
        });

      const p1Id = p1Res.body.data.id;
      const p2Id = p2Res.body.data.id;

      // Subtotal = (2 * 75,000) + (1 * 120,000) = 150,000 + 120,000 = 270,000
      // Tax 11% = 29,700 -> Grand Total = 299,700
      const orderRes = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          customer_id: testCustomerId,
          items: [
            { product_id: p1Id, quantity: 2 },
            { product_id: p2Id, quantity: 1 },
          ],
        });

      expect(orderRes.status).toBe(201);
      expect(orderRes.body.success).toBe(true);
      const order = orderRes.body.data;
      expect(order.status).toBe('PENDING');
      expect(order.subtotal).toBe(270000);
      expect(order.tax_amount).toBe(29700);
      expect(order.grand_total).toBe(299700);
      expect(order.items).toHaveLength(2);

      // Verify stock was decreased in database
      const db = getDb();
      const [dbP1] = await db.select().from(products).where(eq(products.id, p1Id));
      const [dbP2] = await db.select().from(products).where(eq(products.id, p2Id));
      expect(dbP1.stock).toBe(18);
      expect(dbP2.stock).toBe(9);

      // Update product 1 price and name
      const updateRes = await request(app)
        .put(`/api/products/${p1Id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Snapshot Item Alpha v2 (Price Raised)',
          price: 999000,
        });
      expect(updateRes.status).toBe(200);

      // Fetch order details and verify historical price and name snapshots are untouched
      const detailRes = await request(app)
        .get(`/api/orders/${order.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(detailRes.status).toBe(200);
      expect(detailRes.body.data.subtotal).toBe(270000);
      expect(detailRes.body.data.tax_amount).toBe(29700);
      expect(detailRes.body.data.grand_total).toBe(299700);

      const snapshotItem1 = detailRes.body.data.items.find(
        (i: { product_id: string }) => i.product_id === p1Id
      );
      expect(snapshotItem1.product_name).toBe('Snapshot Item Alpha');
      expect(snapshotItem1.unit_price).toBe(75000);
      expect(snapshotItem1.subtotal).toBe(150000);
    });
  });

  // =========================================================================
  // Mandatory Test 2: Insufficient stock causes complete rollback
  // =========================================================================
  describe('Mandatory #2: Insufficient Stock Causes Complete Transaction Rollback', () => {
    it('rolls back the entire order and leaves all product stock untouched if any item lacks stock', async () => {
      const pValidRes = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          product_code: 'PRD-ROLLBACK-OK',
          name: 'Available Stock Product',
          price: 50000,
          stock: 10,
        });

      const pLowRes = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          product_code: 'PRD-ROLLBACK-LOW',
          name: 'Hydrococo 150ml Limited',
          price: 30000,
          stock: 3,
        });

      const validId = pValidRes.body.data.id;
      const lowId = pLowRes.body.data.id;

      // Attempt to order 4 of validId (has 10) and 5 of lowId (has only 3)
      const orderRes = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          customer_id: testCustomerId,
          items: [
            { product_id: validId, quantity: 4 },
            { product_id: lowId, quantity: 5 },
          ],
        });

      expect(orderRes.status).toBe(422);
      expect(orderRes.body.success).toBe(false);
      expect(orderRes.body.message).toBe('Insufficient stock');
      expect(orderRes.body.errors['items.1.quantity'][0]).toContain(
        'Hydrococo 150ml Limited has 3 units remaining, 5 requested'
      );

      // Verify validId stock was NOT decreased (still 10) and lowId stock is still 3
      const db = getDb();
      const [dbValid] = await db.select().from(products).where(eq(products.id, validId));
      const [dbLow] = await db.select().from(products).where(eq(products.id, lowId));
      expect(dbValid.stock).toBe(10);
      expect(dbLow.stock).toBe(3);
    });
  });

  // =========================================================================
  // Mandatory Test 3 & 4: Cancellation restores stock & Invalid status transitions return 409
  // =========================================================================
  describe('Mandatory #3 & #4: Order Cancellation Restores Stock & Status Transitions Enforce HTTP 409', () => {
    it('Mandatory #3: cancels a PENDING or PAID order and restores stock exactly once', async () => {
      const prodRes = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          product_code: 'PRD-CANCEL-RESTORE',
          name: 'Cancelable Product',
          price: 100000,
          stock: 12,
        });

      const productId = prodRes.body.data.id;

      // Create order for 5 units -> stock becomes 7
      const createRes = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          customer_id: testCustomerId,
          items: [{ product_id: productId, quantity: 5 }],
        });

      expect(createRes.status).toBe(201);
      const orderId = createRes.body.data.id;

      const db = getDb();
      const [afterOrder] = await db.select().from(products).where(eq(products.id, productId));
      expect(afterOrder.stock).toBe(7);

      // Pay the order (PENDING -> PAID) -> stock remains 7
      const payRes = await request(app)
        .patch(`/api/orders/${orderId}/pay`)
        .set('Authorization', `Bearer ${token}`);

      expect(payRes.status).toBe(200);
      expect(payRes.body.data.status).toBe('PAID');

      const [afterPay] = await db.select().from(products).where(eq(products.id, productId));
      expect(afterPay.stock).toBe(7);

      // Cancel the PAID order (PAID -> CANCELLED) -> stock restored to 12
      const cancelRes = await request(app)
        .patch(`/api/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${token}`);

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.data.status).toBe('CANCELLED');

      const [afterCancel] = await db.select().from(products).where(eq(products.id, productId));
      expect(afterCancel.stock).toBe(12);
    });

    it('Mandatory #4: returns HTTP 409 for invalid transitions and prevents duplicate cancellation from restoring stock twice', async () => {
      const prodRes = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          product_code: 'PRD-TRANSITION-409',
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
  // Section 9 Requirement: Concurrent Order Integration Test
  // =========================================================================
  describe('Concurrent Stock Protection & Non-existent Customer Validation', () => {
    it('prevents overselling when two concurrent orders compete for limited stock', async () => {
      const prodRes = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          product_code: 'PRD-CONCURRENT-5',
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

    it('returns HTTP 404 when creating an order for a non-existent customer', async () => {
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

    it('rejects client attempts to inject unit_price, subtotal, or tax_amount into POST /api/orders', async () => {
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
