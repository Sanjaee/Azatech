import { z } from 'zod';

export const listCustomersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(200).default(20),
  search: z.string().trim().optional().default(''),
});

export const createCustomerSchema = z.object({
  name: z
    .string({ required_error: 'Customer name is required' })
    .trim()
    .min(2, 'Customer name must be at least 2 characters')
    .max(200, 'Customer name cannot exceed 200 characters'),
  email: z
    .string()
    .trim()
    .email('Invalid email format')
    .optional()
    .or(z.literal(''))
    .nullable()
    .transform((v) => (v ? v.toLowerCase() : null)),
  phone: z
    .string()
    .trim()
    .max(50, 'Phone number cannot exceed 50 characters')
    .optional()
    .or(z.literal(''))
    .nullable()
    .transform((v) => (v ? v : null)),
  address: z
    .string()
    .trim()
    .max(1000, 'Address cannot exceed 1000 characters')
    .optional()
    .or(z.literal(''))
    .nullable()
    .transform((v) => (v ? v : null)),
});

export type ListCustomersQuery = z.infer<typeof listCustomersQuerySchema>;
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
