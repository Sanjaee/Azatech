import { z } from 'zod';

export const createOrderItemSchema = z
  .object({
    product_id: z
      .string({ required_error: 'Product ID is required' })
      .uuid('Invalid product ID format'),
    quantity: z
      .number({
        required_error: 'Quantity is required',
        invalid_type_error: 'Quantity must be an integer',
      })
      .int('Quantity must be a positive integer')
      .positive('Quantity must be greater than zero'),
  })
  .strict();

export const createOrderSchema = z
  .object({
    customer_id: z
      .string({ required_error: 'Customer ID is required' })
      .uuid('Invalid customer ID format'),
    items: z
      .array(createOrderItemSchema, {
        required_error: 'Order items are required',
      })
      .min(1, 'At least one item is required to create an order'),
  })
  .strict();

export const listOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(10),
  status: z
    .enum(['PENDING', 'PAID', 'CANCELLED', 'ALL'])
    .optional()
    .transform((v) => (v === 'ALL' ? undefined : v)),
  start_date: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || !Number.isNaN(Date.parse(v)), {
      message: 'Invalid start_date format',
    }),
  end_date: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || !Number.isNaN(Date.parse(v)), {
      message: 'Invalid end_date format',
    }),
});

export const orderIdParamSchema = z.object({
  id: z.string().uuid('Invalid order ID format'),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;
