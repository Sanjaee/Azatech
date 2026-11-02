import { z } from 'zod';

export const loginFormSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginFormValues = z.infer<typeof loginFormSchema>;

export const productFormSchema = z.object({
  product_code: z
    .string()
    .trim()
    .min(2, 'Product code must be at least 2 characters')
    .max(64, 'Max 64 characters'),
  name: z
    .string()
    .trim()
    .min(2, 'Product name must be at least 2 characters')
    .max(255, 'Max 255 characters'),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  price: z.coerce
    .number({ invalid_type_error: 'Price must be a valid number' })
    .positive('Price must be greater than zero'),
  stock: z.coerce
    .number({ invalid_type_error: 'Stock must be a valid integer' })
    .int('Stock must be a whole number')
    .min(0, 'Stock cannot be negative'),
});

export type ProductFormValues = z.infer<typeof productFormSchema>;

export const customerFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Customer name must be at least 2 characters')
    .max(200, 'Max 200 characters'),
  email: z.string().trim().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().trim().max(50, 'Max 50 characters').optional().or(z.literal('')),
  address: z.string().trim().max(1000, 'Max 1000 characters').optional().or(z.literal('')),
});

export type CustomerFormValues = z.infer<typeof customerFormSchema>;

export const createOrderFormSchema = z.object({
  customer_id: z.string().uuid('Please select a customer'),
  items: z
    .array(
      z.object({
        product_id: z.string().uuid('Please select a product'),
        quantity: z.coerce
          .number({ invalid_type_error: 'Enter a valid quantity' })
          .int('Quantity must be a whole number')
          .positive('Quantity must be at least 1'),
      })
    )
    .min(1, 'Add at least one product to the order'),
});

export type CreateOrderFormValues = z.infer<typeof createOrderFormSchema>;
