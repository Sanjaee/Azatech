'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bffFetch } from '@/lib/api-client';
import {
  Customer,
  OrderDetail,
  OrderSummary,
  Product,
  User,
} from '@/types';
import {
  CreateOrderFormValues,
  CustomerFormValues,
  ProductFormValues,
} from '@/schemas';

export function useCurrentUser() {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const res = await bffFetch<{ user: User }>('/api/auth/me');
      return res.data.user;
    },
    retry: false,
  });
}

export function useProducts(params: { page?: number; per_page?: number; search?: string }) {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', String(params.page));
  if (params.per_page) searchParams.set('per_page', String(params.per_page));
  if (params.search) searchParams.set('search', params.search);

  return useQuery({
    queryKey: ['products', params],
    queryFn: async () => {
      return bffFetch<Product[]>(`/api/backend/products?${searchParams.toString()}`);
    },
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: ProductFormValues) => {
      return bffFetch<Product>('/api/backend/products', {
        method: 'POST',
        body: JSON.stringify(values),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Partial<ProductFormValues> }) => {
      return bffFetch<Product>(`/api/backend/products/${id}`, {
        method: 'PUT',
        body: JSON.stringify(values),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useCustomers(params: { page?: number; per_page?: number; search?: string }) {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', String(params.page));
  if (params.per_page) searchParams.set('per_page', String(params.per_page));
  if (params.search) searchParams.set('search', params.search);

  return useQuery({
    queryKey: ['customers', params],
    queryFn: async () => {
      return bffFetch<Customer[]>(`/api/backend/customers?${searchParams.toString()}`);
    },
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: CustomerFormValues) => {
      return bffFetch<Customer>('/api/backend/customers', {
        method: 'POST',
        body: JSON.stringify(values),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}

export function useOrders(params: {
  page?: number;
  per_page?: number;
  status?: string;
  start_date?: string;
  end_date?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', String(params.page));
  if (params.per_page) searchParams.set('per_page', String(params.per_page));
  if (params.status && params.status !== 'ALL') searchParams.set('status', params.status);
  if (params.start_date) searchParams.set('start_date', params.start_date);
  if (params.end_date) searchParams.set('end_date', params.end_date);

  return useQuery({
    queryKey: ['orders', params],
    queryFn: async () => {
      return bffFetch<OrderSummary[]>(`/api/backend/orders?${searchParams.toString()}`);
    },
  });
}

export function useOrderDetail(id: string | null) {
  return useQuery({
    queryKey: ['orders', 'detail', id],
    queryFn: async () => {
      const res = await bffFetch<OrderDetail>(`/api/backend/orders/${id}`);
      return res.data;
    },
    enabled: Boolean(id),
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: CreateOrderFormValues) => {
      return bffFetch<OrderDetail>('/api/backend/orders', {
        method: 'POST',
        body: JSON.stringify({
          customer_id: values.customer_id,
          items: values.items.map((item) => ({
            product_id: item.product_id,
            quantity: Number(item.quantity),
          })),
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function usePayOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      return bffFetch<OrderDetail>(`/api/backend/orders/${orderId}/pay`, {
        method: 'PATCH',
      });
    },
    onSuccess: (_data, orderId) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders', 'detail', orderId] });
    },
  });
}

export function useCancelOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      return bffFetch<OrderDetail>(`/api/backend/orders/${orderId}/cancel`, {
        method: 'PATCH',
      });
    },
    onSuccess: (_data, orderId) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders', 'detail', orderId] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}
