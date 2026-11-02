import crypto from 'crypto';
import { and, asc, desc, eq, gte, inArray, like, lte, sql } from 'drizzle-orm';
import { getDb } from '../../db';
import {
  customers,
  orderCounters,
  orderIdempotency,
  orderItems,
  orders,
  products,
  Customer,
  Order,
  OrderItem,
  OrderStatus,
} from '../../db/schema';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../utils/errors';
import {
  calculateVariantCTaxCents,
  centsToNumber,
  centsToNumericString,
  numericStringToNumber,
  parseMoneyToCents,
} from '../../utils/money';
import { CreateOrderInput, ListOrdersQuery } from './orders.schema';

export interface SerializedOrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  product_code: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
}

export interface SerializedOrderSummary {
  id: string;
  order_number: string;
  customer_id: string;
  customer: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
  };
  subtotal: number;
  tax_amount: number;
  grand_total: number;
  status: OrderStatus;
  created_at: Date;
  updated_at: Date;
}

export interface SerializedOrderDetail extends SerializedOrderSummary {
  items: SerializedOrderItem[];
}

function serializeOrderItem(item: OrderItem): SerializedOrderItem {
  return {
    id: item.id,
    order_id: item.orderId,
    product_id: item.productId,
    product_name: item.productName,
    product_code: item.productCode,
    unit_price: numericStringToNumber(item.unitPrice),
    quantity: item.quantity,
    subtotal: numericStringToNumber(item.subtotal),
  };
}

function serializeOrderSummary(order: Order, customer: Customer): SerializedOrderSummary {
  return {
    id: order.id,
    order_number: order.orderNumber,
    customer_id: order.customerId,
    customer: {
      id: customer.id,
      name: customer.name,
      email: customer.email ?? null,
      phone: customer.phone ?? null,
      address: customer.address ?? null,
    },
    subtotal: numericStringToNumber(order.subtotal),
    tax_amount: numericStringToNumber(order.taxAmount),
    grand_total: numericStringToNumber(order.grandTotal),
    status: order.status,
    created_at: order.createdAt,
    updated_at: order.updatedAt,
  };
}

/**
 * Format date in Asia/Jakarta timezone as YYYYMMDD string.
 */
export function getJakartaDateKey(now: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now).replace(/-/g, '');
}

export interface CreateOrderOptions {
  idempotencyKey?: string;
  userId?: string;
}

export class OrdersService {
  /**
   * Generates a unique order number in the format INV-YYYYMMDD-XXXX inside an active transaction.
   * Uses an atomic PostgreSQL daily counter table (order_counters) with:
   * - date_key as primary key (Asia/Jakarta timezone YYYYMMDD)
   * - last_sequence as integer
   * - INSERT ON CONFLICT DO UPDATE RETURNING to allocate the sequence atomically under concurrency.
   */
  private async generateOrderNumber(
    tx: Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0],
    now: Date = new Date()
  ): Promise<string> {
    const dateKey = getJakartaDateKey(now);

    const result = await tx.execute<{ last_sequence: number }>(sql`
      INSERT INTO order_counters (date_key, last_sequence, updated_at)
      VALUES (${dateKey}, 1, NOW())
      ON CONFLICT (date_key)
      DO UPDATE SET
        last_sequence = order_counters.last_sequence + 1,
        updated_at = NOW()
      RETURNING last_sequence
    `);

    const seq = Number(result.rows[0].last_sequence);
    const paddedSeq = seq.toString().padStart(4, '0');
    return `INV-${dateKey}-${paddedSeq}`;
  }

  /**
   * Transactional Order Creation (Section 8, Section 9, & Section E)
   *
   * 1. Validate customer existence.
   * 2. Validate that items are not empty.
   * 3. Validate positive integer quantities.
   * 4. Reject duplicate product IDs with clear item-level validation errors.
   * 5. Check idempotency key if provided: identical payload replays order, different payload returns 409.
   * 6. Begin a database transaction.
   * 7. Lock all affected product rows in a consistent ascending ID order (SELECT ... FOR UPDATE).
   * 8. Read current prices and stock.
   * 9. Validate all product records exist.
   * 10. Validate sufficient stock for every item.
   * 11. Calculate each item subtotal and order subtotal.
   * 12. Calculate Variant C tax (CEILING(subtotal * 0.11 / 100) * 100).
   * 13. Generate unique order number (INV-YYYYMMDD-XXXX) via atomic order_counters table.
   * 14. Insert the order.
   * 15. Insert all order items with price and product snapshots.
   * 16. Decrease product stock atomically.
   * 17. Record idempotency key if provided.
   * 18. Commit the transaction.
   */
  async createOrder(
    input: CreateOrderInput,
    options?: CreateOrderOptions
  ): Promise<SerializedOrderDetail> {
    const db = getDb();

    // Step 4: Reject duplicate product IDs in request items
    const seenProductIds = new Map<string, number>();
    const duplicateErrors: Record<string, string[]> = {};

    input.items.forEach((item, index) => {
      if (seenProductIds.has(item.product_id)) {
        duplicateErrors[`items.${index}.product_id`] = [
          'Duplicate product in order items. Combine quantities into a single line item.',
        ];
      } else {
        seenProductIds.set(item.product_id, index);
      }
    });

    if (Object.keys(duplicateErrors).length > 0) {
      throw new ValidationError('Duplicate product entries are not allowed', duplicateErrors);
    }

    // Optional Idempotency-Key verification (Section E)
    let payloadHash: string | undefined;
    if (options?.idempotencyKey && options?.userId) {
      payloadHash = crypto
        .createHash('sha256')
        .update(JSON.stringify(input))
        .digest('hex');

      const existingRecord = await db
        .select()
        .from(orderIdempotency)
        .where(
          and(
            eq(orderIdempotency.idempotencyKey, options.idempotencyKey),
            eq(orderIdempotency.userId, options.userId)
          )
        )
        .limit(1);

      if (existingRecord.length > 0) {
        const record = existingRecord[0];
        if (record.requestPayloadHash !== payloadHash) {
          throw new ConflictError(
            'Idempotency key reuse with different request payload is forbidden'
          );
        }
        return this.getOrderById(record.orderId);
      }
    }

    // Step 6: Begin database transaction
    return await db.transaction(async (tx) => {
      // Step 1: Validate customer existence
      const [customer] = await tx
        .select()
        .from(customers)
        .where(eq(customers.id, input.customer_id))
        .limit(1);

      if (!customer) {
        throw new NotFoundError('Customer not found', {
          customer_id: ['Selected customer does not exist'],
        });
      }

      // Step 7: Lock all affected product rows in a consistent ascending ID order to prevent deadlocks
      const sortedProductIds = [...input.items.map((i) => i.product_id)].sort((a, b) =>
        a.localeCompare(b)
      );

      const lockedProducts = await tx
        .select()
        .from(products)
        .where(inArray(products.id, sortedProductIds))
        .orderBy(asc(products.id))
        .for('update');

      const productMap = new Map(lockedProducts.map((p) => [p.id, p]));

      // Step 9: Validate all product records exist
      const missingErrors: Record<string, string[]> = {};
      input.items.forEach((item, idx) => {
        if (!productMap.has(item.product_id)) {
          missingErrors[`items.${idx}.product_id`] = [
            `Product with ID ${item.product_id} was not found`,
          ];
        }
      });

      if (Object.keys(missingErrors).length > 0) {
        throw new NotFoundError('One or more products were not found', missingErrors);
      }

      // Step 10: Validate sufficient stock for every item after acquiring row locks
      const stockErrors: Record<string, string[]> = {};
      input.items.forEach((item, idx) => {
        const product = productMap.get(item.product_id)!;
        if (product.stock < item.quantity) {
          stockErrors[`items.${idx}.quantity`] = [
            `${product.name} has ${product.stock} units remaining, ${item.quantity} requested`,
          ];
        }
      });

      if (Object.keys(stockErrors).length > 0) {
        throw new ValidationError('Insufficient stock', stockErrors);
      }

      // Step 11: Calculate each item subtotal and order subtotal from trusted DB unit prices
      let orderSubtotalCents = 0n;
      const preparedItems: Array<{
        productId: string;
        productName: string;
        productCode: string;
        unitPriceNumeric: string;
        quantity: number;
        subtotalNumeric: string;
      }> = [];

      for (const item of input.items) {
        const product = productMap.get(item.product_id)!;
        const unitPriceCents = parseMoneyToCents(product.price);
        const itemSubtotalCents = unitPriceCents * BigInt(item.quantity);
        orderSubtotalCents += itemSubtotalCents;

        preparedItems.push({
          productId: product.id,
          productName: product.name,
          productCode: product.productCode,
          unitPriceNumeric: centsToNumericString(unitPriceCents),
          quantity: item.quantity,
          subtotalNumeric: centsToNumericString(itemSubtotalCents),
        });
      }

      // Step 12: Calculate Variant C tax (PPN 11% rounded UP to nearest Rp100)
      const { subtotalCents, taxAmountCents, grandTotalCents } =
        calculateVariantCTaxCents(orderSubtotalCents);

      // Step 13: Generate unique order number (INV-YYYYMMDD-XXXX) via atomic order_counters table
      const orderNumber = await this.generateOrderNumber(tx);

      // Step 14: Insert the order
      const [createdOrder] = await tx
        .insert(orders)
        .values({
          orderNumber,
          customerId: customer.id,
          subtotal: centsToNumericString(subtotalCents),
          taxAmount: centsToNumericString(taxAmountCents),
          grandTotal: centsToNumericString(grandTotalCents),
          status: 'PENDING',
        })
        .returning();

      // Step 15: Insert all order items with price and product snapshots
      const insertedItems = await tx
        .insert(orderItems)
        .values(
          preparedItems.map((pi) => ({
            orderId: createdOrder.id,
            productId: pi.productId,
            productName: pi.productName,
            productCode: pi.productCode,
            unitPrice: pi.unitPriceNumeric,
            quantity: pi.quantity,
            subtotal: pi.subtotalNumeric,
          }))
        )
        .returning();

      // Step 16: Decrease product stock atomically
      for (const item of input.items) {
        const updatedRows = await tx
          .update(products)
          .set({
            stock: sql`${products.stock} - ${item.quantity}`,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(products.id, item.product_id),
              gte(products.stock, item.quantity)
            )
          )
          .returning({ id: products.id });

        if (updatedRows.length === 0) {
          throw new ValidationError('Insufficient stock', {
            items: ['Concurrent stock update conflict detected'],
          });
        }
      }

      // Step 17: Save Idempotency-Key mapping if present
      if (options?.idempotencyKey && options?.userId && payloadHash) {
        await tx.insert(orderIdempotency).values({
          idempotencyKey: options.idempotencyKey,
          userId: options.userId,
          requestPayloadHash: payloadHash,
          orderId: createdOrder.id,
        });
      }

      // Step 18: Return full order detail (transaction commits upon return)
      return {
        ...serializeOrderSummary(createdOrder, customer),
        items: insertedItems.map(serializeOrderItem),
      };
    });
  }

  async listOrders(query: ListOrdersQuery) {
    const db = getDb();
    const { page, per_page, status, start_date, end_date } = query;
    const offset = (page - 1) * per_page;

    const conditions = [];

    if (status) {
      conditions.push(eq(orders.status, status));
    }

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

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, countResult] = await Promise.all([
      db
        .select({
          order: orders,
          customer: customers,
        })
        .from(orders)
        .innerJoin(customers, eq(orders.customerId, customers.id))
        .where(whereClause)
        .orderBy(desc(orders.createdAt), desc(orders.id))
        .limit(per_page)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(orders)
        .where(whereClause),
    ]);

    const total = Number(countResult[0]?.count ?? 0);

    return {
      items: rows.map((r) => serializeOrderSummary(r.order, r.customer)),
      meta: {
        page,
        per_page,
        total,
        total_pages: Math.ceil(total / per_page) || 1,
      },
    };
  }

  async getOrderById(orderId: string): Promise<SerializedOrderDetail> {
    const db = getDb();

    const [row] = await db
      .select({
        order: orders,
        customer: customers,
      })
      .from(orders)
      .innerJoin(customers, eq(orders.customerId, customers.id))
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!row) {
      throw new NotFoundError('Order not found');
    }

    const items = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId))
      .orderBy(asc(orderItems.id));

    return {
      ...serializeOrderSummary(row.order, row.customer),
      items: items.map(serializeOrderItem),
    };
  }

  /**
   * Pay Order (Section 10)
   * Allowed transition: PENDING -> PAID
   * All other transitions return HTTP 409.
   * Atomic status update without decreasing stock again.
   */
  async payOrder(orderId: string): Promise<SerializedOrderDetail> {
    const db = getDb();

    await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .for('update');

      if (!existing) {
        throw new NotFoundError('Order not found');
      }

      if (existing.status !== 'PENDING') {
        throw new ConflictError(
          `Cannot pay order with status '${existing.status}'. Only PENDING orders can be paid.`
        );
      }

      await tx
        .update(orders)
        .set({
          status: 'PAID',
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId));
    });

    return this.getOrderById(orderId);
  }

  /**
   * Cancel Order (Section 10 & Section D)
   * Allowed transitions:
   *   PENDING -> CANCELLED
   *   PAID -> CANCELLED
   *
   * Enforced in a single ACID transaction with row-level locking (SELECT ... FOR UPDATE).
   * Simultaneous cancellation requests cannot restore stock twice.
   * Stock is restored only when order status transitions successfully to CANCELLED.
   */
  async cancelOrder(orderId: string): Promise<SerializedOrderDetail> {
    const db = getDb();

    await db.transaction(async (tx) => {
      // 1. Lock the order row exclusively to prevent simultaneous cancellations
      const [existing] = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .for('update');

      if (!existing) {
        throw new NotFoundError('Order not found');
      }

      if (existing.status === 'CANCELLED') {
        throw new ConflictError('Order is already cancelled');
      }

      if (existing.status !== 'PENDING' && existing.status !== 'PAID') {
        throw new ConflictError(
          `Cannot cancel order with status '${existing.status}'`
        );
      }

      // 2. Fetch order items for inventory restoration
      const items = await tx
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, orderId));

      if (items.length > 0) {
        // Lock affected products in ascending ID order to prevent deadlocks
        const sortedProductIds = [...new Set(items.map((i) => i.productId))].sort((a, b) =>
          a.localeCompare(b)
        );

        await tx
          .select({ id: products.id })
          .from(products)
          .where(inArray(products.id, sortedProductIds))
          .orderBy(asc(products.id))
          .for('update');

        // Restore each line item's ordered quantity
        for (const item of items) {
          await tx
            .update(products)
            .set({
              stock: sql`${products.stock} + ${item.quantity}`,
              updatedAt: new Date(),
            })
            .where(eq(products.id, item.productId));
        }
      }

      // 3. Mark order status as CANCELLED in the same transaction
      await tx
        .update(orders)
        .set({
          status: 'CANCELLED',
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId));
    });

    return this.getOrderById(orderId);
  }
}

export const ordersService = new OrdersService();
