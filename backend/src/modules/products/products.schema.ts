import { z } from 'zod';

export const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional().default(''),
});

export const createProductSchema = z.object({
  product_code: z
    .string({ required_error: 'Product code is required' })
    .trim()
    .min(2, 'Product code must be at least 2 characters')
    .max(64, 'Product code cannot exceed 64 characters'),
  name: z
    .string({ required_error: 'Product name is required' })
    .trim()
    .min(2, 'Product name must be at least 2 characters')
    .max(255, 'Product name cannot exceed 255 characters'),
  description: z
    .string()
    .trim()
    .max(2000, 'Description cannot exceed 2000 characters')
    .optional()
    .nullable(),
  price: z.coerce
    .number({ required_error: 'Price is required', invalid_type_error: 'Price must be a number' })
    .positive('Price must be greater than zero'),
  stock: z.coerce
    .number({ required_error: 'Stock is required', invalid_type_error: 'Stock must be an integer' })
    .int('Stock must be an integer')
    .min(0, 'Stock must be greater than or equal to zero'),
});

export const updateProductSchema = createProductSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided for update' }
);

export const productIdParamSchema = z.object({
  id: z.string().uuid('Invalid product ID format'),
});

export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
