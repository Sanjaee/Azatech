import { and, desc, eq, ilike, ne, or, sql } from 'drizzle-orm';
import { getDb } from '../../db';
import { products, Product } from '../../db/schema';
import { ConflictError, NotFoundError } from '../../utils/errors';
import { centsToNumericString, numericStringToNumber, parseMoneyToCents } from '../../utils/money';
import {
  CreateProductInput,
  ListProductsQuery,
  UpdateProductInput,
} from './products.schema';

export interface SerializedProduct {
  id: string;
  product_code: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  created_at: Date;
  updated_at: Date;
}

export function serializeProduct(row: Product): SerializedProduct {
  return {
    id: row.id,
    product_code: row.productCode,
    name: row.name,
    description: row.description ?? null,
    price: numericStringToNumber(row.price),
    stock: row.stock,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export class ProductsService {
  async list(query: ListProductsQuery) {
    const db = getDb();
    const { page, per_page, search } = query;
    const offset = (page - 1) * per_page;

    const searchFilter = search
      ? or(
          ilike(products.name, `%${search}%`),
          ilike(products.productCode, `%${search}%`)
        )
      : undefined;

    const [items, countResult] = await Promise.all([
      db
        .select()
        .from(products)
        .where(searchFilter)
        .orderBy(desc(products.createdAt), desc(products.id))
        .limit(per_page)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(products)
        .where(searchFilter),
    ]);

    const total = Number(countResult[0]?.count ?? 0);

    return {
      items: items.map(serializeProduct),
      meta: {
        page,
        per_page,
        total,
        total_pages: Math.ceil(total / per_page) || 1,
      },
    };
  }

  async create(input: CreateProductInput): Promise<SerializedProduct> {
    const db = getDb();

    const existing = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.productCode, input.product_code))
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictError(`Product code '${input.product_code}' is already in use`, {
        product_code: [`Product code '${input.product_code}' already exists`],
      });
    }

    const priceNumeric = centsToNumericString(parseMoneyToCents(input.price));

    const [created] = await db
      .insert(products)
      .values({
        productCode: input.product_code,
        name: input.name,
        description: input.description ?? null,
        price: priceNumeric,
        stock: input.stock,
      })
      .returning();

    return serializeProduct(created);
  }

  async update(id: string, input: UpdateProductInput): Promise<SerializedProduct> {
    const db = getDb();

    const [existing] = await db
      .select()
      .from(products)
      .where(eq(products.id, id))
      .limit(1);

    if (!existing) {
      throw new NotFoundError('Product not found');
    }

    if (input.product_code && input.product_code !== existing.productCode) {
      const duplicate = await db
        .select({ id: products.id })
        .from(products)
        .where(and(eq(products.productCode, input.product_code), ne(products.id, id)))
        .limit(1);

      if (duplicate.length > 0) {
        throw new ConflictError(`Product code '${input.product_code}' is already in use`, {
          product_code: [`Product code '${input.product_code}' already exists`],
        });
      }
    }

    const updateValues: Partial<typeof products.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (input.product_code !== undefined) updateValues.productCode = input.product_code;
    if (input.name !== undefined) updateValues.name = input.name;
    if (input.description !== undefined) updateValues.description = input.description ?? null;
    if (input.price !== undefined) {
      updateValues.price = centsToNumericString(parseMoneyToCents(input.price));
    }
    if (input.stock !== undefined) updateValues.stock = input.stock;

    const [updated] = await db
      .update(products)
      .set(updateValues)
      .where(eq(products.id, id))
      .returning();

    return serializeProduct(updated);
  }
}

export const productsService = new ProductsService();
