'use client';

import React from 'react';
import Link from 'next/link';
import {
  Package,
  Users,
  ShoppingCart,
  Clock,
  PlusCircle,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import { useProducts, useCustomers, useOrders } from '@/hooks/use-oms';
import { formatDateTime, formatRupiah } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { OrderStatusBadge } from '@/components/orders/order-status-badge';

export default function DashboardPage() {
  const productsQuery = useProducts({ page: 1, per_page: 1 });
  const customersQuery = useCustomers({ page: 1, per_page: 1 });
  const allOrdersQuery = useOrders({ page: 1, per_page: 5 });
  const pendingOrdersQuery = useOrders({ page: 1, per_page: 1, status: 'PENDING' });

  const isLoading =
    productsQuery.isLoading ||
    customersQuery.isLoading ||
    allOrdersQuery.isLoading ||
    pendingOrdersQuery.isLoading;

  const hasError =
    productsQuery.isError ||
    customersQuery.isError ||
    allOrdersQuery.isError ||
    pendingOrdersQuery.isError;

  const totalProducts = productsQuery.data?.meta?.total ?? 0;
  const totalCustomers = customersQuery.data?.meta?.total ?? 0;
  const totalOrders = allOrdersQuery.data?.meta?.total ?? 0;
  const pendingOrders = pendingOrdersQuery.data?.meta?.total ?? 0;
  const recentOrders = allOrdersQuery.data?.data ?? [];

  const stats = [
    {
      title: 'Total Products',
      value: totalProducts,
      subtitle: 'Active catalog SKUs',
      icon: Package,
      href: '/products',
      color: 'text-blue-600 bg-blue-50',
    },
    {
      title: 'Total Customers',
      value: totalCustomers,
      subtitle: 'Registered store accounts',
      icon: Users,
      href: '/customers',
      color: 'text-indigo-600 bg-indigo-50',
    },
    {
      title: 'Total Orders',
      value: totalOrders,
      subtitle: 'All historical invoices',
      icon: ShoppingCart,
      href: '/orders',
      color: 'text-emerald-600 bg-emerald-50',
    },
    {
      title: 'Pending Orders',
      value: pendingOrders,
      subtitle: 'Awaiting payment confirmation',
      icon: Clock,
      href: '/orders?status=PENDING',
      color: 'text-amber-600 bg-amber-50',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500">
            Real-time store metrics from PostgreSQL database.
          </p>
        </div>
        <Button asChild>
          <Link href="/orders/new">
            <PlusCircle className="h-4 w-4" />
            Create Order
          </Link>
        </Button>
      </div>

      {hasError && (
        <div className="flex items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
          <span>Failed to load dashboard metrics. Please refresh the page.</span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="hover:border-slate-300 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-slate-600">
                  {stat.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${stat.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-8 w-20 my-1" />
                ) : (
                  <div className="text-2xl font-bold text-slate-900">{stat.value}</div>
                )}
                <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                  <span>{stat.subtitle}</span>
                  <Link
                    href={stat.href}
                    className="font-medium text-primary hover:underline inline-flex items-center gap-0.5"
                  >
                    View <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Recent Orders</CardTitle>
            <CardDescription>
              Latest orders processed with Variant C 11% PPN calculation.
            </CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/orders">View All Orders</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {allOrdersQuery.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : recentOrders.length === 0 ? (
            <div className="text-center py-10 border rounded-lg bg-slate-50/50">
              <ShoppingCart className="h-8 w-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-700">No orders recorded yet</p>
              <p className="text-xs text-slate-500 mb-4">
                Create your first customer order to see live transactions here.
              </p>
              <Button asChild size="sm">
                <Link href="/orders/new">Create First Order</Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order Number</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Grand Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-xs font-semibold">
                      {order.order_number}
                    </TableCell>
                    <TableCell className="font-medium">{order.customer.name}</TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {formatDateTime(order.created_at)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatRupiah(order.grand_total)}
                    </TableCell>
                    <TableCell>
                      <OrderStatusBadge status={order.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/orders/${order.id}`}>Details</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
