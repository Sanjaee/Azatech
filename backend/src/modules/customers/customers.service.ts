import { desc, ilike, or, sql } from 'drizzle-orm';
import { getDb } from '../../db';
import { customers, Customer } from '../../db/schema';
import { CreateCustomerInput, ListCustomersQuery } from './customers.schema';

export interface SerializedCustomer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  created_at: Date;
  updated_at: Date;
}

export function serializeCustomer(row: Customer): SerializedCustomer {
  return {
    id: row.id,
    name: row.name,
    email: row.email ?? null,
    phone: row.phone ?? null,
    address: row.address ?? null,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export class CustomersService {
  async list(query: ListCustomersQuery) {
    const db = getDb();
    const { page, per_page, search } = query;
    const offset = (page - 1) * per_page;

    const searchFilter = search
      ? or(
          ilike(customers.name, `%${search}%`),
          ilike(customers.email, `%${search}%`),
          ilike(customers.phone, `%${search}%`)
        )
      : undefined;

    const [items, countResult] = await Promise.all([
      db
        .select()
        .from(customers)
        .where(searchFilter)
        .orderBy(desc(customers.createdAt), desc(customers.id))
        .limit(per_page)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(customers)
        .where(searchFilter),
    ]);

    const total = Number(countResult[0]?.count ?? 0);

    return {
      items: items.map(serializeCustomer),
      meta: {
        page,
        per_page,
        total,
        total_pages: Math.ceil(total / per_page) || 1,
      },
    };
  }

  async create(input: CreateCustomerInput): Promise<SerializedCustomer> {
    const db = getDb();
    const [created] = await db
      .insert(customers)
      .values({
        name: input.name,
        email: input.email ?? null,
        phone: input.phone ?? null,
        address: input.address ?? null,
      })
      .returning();

    return serializeCustomer(created);
  }
}

export const customersService = new CustomersService();
