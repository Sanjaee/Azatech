export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Product {
  id: string;
  product_code: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  created_at: string;
  updated_at: string;
}

export type OrderStatus = 'PENDING' | 'PAID' | 'CANCELLED';

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  product_code: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
}

export interface OrderSummary {
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
  created_at: string;
  updated_at: string;
}

export interface OrderDetail extends OrderSummary {
  items: OrderItem[];
}

export interface PaginationMeta {
  page: number;
  per_page: number;
  total: number;
  total_pages?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: PaginationMeta;
  errors?: Record<string, string[]>;
}
