'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import {
  ShoppingCart,
  PlusCircle,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Eye,
  AlertCircle,
  X,
} from 'lucide-react';
import { useOrders } from '@/hooks/use-oms';
import { formatDateTime, formatRupiah, cn } from '@/lib/utils';
import { OrderStatusBadge } from '@/components/orders/order-status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

function OrdersListContent() {
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get('status') || 'ALL';

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  const perPage = 10;
  const { data, isLoading, isError, refetch } = useOrders({
    page,
    per_page: perPage,
    status: statusFilter,
    start_date: startDate ? format(startDate, 'yyyy-MM-dd') : undefined,
    end_date: endDate ? format(endDate, 'yyyy-MM-dd') : undefined,
  });

  const orders = data?.data ?? [];
  const meta = data?.meta;
  const totalPages = meta?.total_pages ?? (meta ? Math.ceil(meta.total / meta.per_page) || 1 : 1);

  const hasFilters = statusFilter !== 'ALL' || Boolean(startDate) || Boolean(endDate);

  function handleResetFilters() {
    setStatusFilter('ALL');
    setStartDate(undefined);
    setEndDate(undefined);
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Orders</h1>
          <p className="text-sm text-slate-500">
            Track invoices, Variant C PPN 11% tax totals, and payment / cancellation states.
          </p>
        </div>
        <Button asChild>
          <Link href="/orders/new">
            <PlusCircle className="h-4 w-4" />
            Create Order
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <CardTitle className="text-base">Order Ledger</CardTitle>
              <CardDescription>
                {meta ? `Showing ${orders.length} of ${meta.total} orders` : 'Loading orders...'}
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Status Filter */}
              <div className="w-40">
                <Select
                  value={statusFilter}
                  onValueChange={(val) => {
                    setStatusFilter(val);
                    setPage(1);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Filter Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Statuses</SelectItem>
                    <SelectItem value="PENDING">PENDING</SelectItem>
                    <SelectItem value="PAID">PAID</SelectItem>
                    <SelectItem value="CANCELLED">CANCELLED</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Start Date Picker */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      'justify-start text-left font-normal h-9',
                      !startDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, 'dd MMM yyyy') : 'Start date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(d) => {
                      setStartDate(d);
                      setPage(1);
                    }}
                  />
                </PopoverContent>
              </Popover>

              {/* End Date Picker */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      'justify-start text-left font-normal h-9',
                      !endDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, 'dd MMM yyyy') : 'End date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(d) => {
                      setEndDate(d);
                      setPage(1);
                    }}
                  />
                </PopoverContent>
              </Popover>

              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={handleResetFilters}>
                  <X className="h-4 w-4" />
                  Clear
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {isError ? (
            <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg bg-rose-50/40">
              <AlertCircle className="h-8 w-8 text-rose-600 mb-2" />
              <p className="text-sm font-semibold text-rose-900">Failed to load orders</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
                Retry
              </Button>
            </div>
          ) : isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12 border rounded-lg bg-slate-50/50">
              <ShoppingCart className="h-8 w-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-700">No orders found</p>
              <p className="text-xs text-slate-500 mb-4">
                {hasFilters
                  ? 'No orders matched your current status or date range filters.'
                  : 'Create a new order to generate your first invoice.'}
              </p>
              {hasFilters ? (
                <Button variant="outline" size="sm" onClick={handleResetFilters}>
                  Reset Filters
                </Button>
              ) : (
                <Button asChild size="sm">
                  <Link href="/orders/new">Create Order</Link>
                </Button>
              )}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order Number</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                    <TableHead className="text-right">PPN (11%)</TableHead>
                    <TableHead className="text-right">Grand Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono text-xs font-semibold text-slate-900">
                        {order.order_number}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-slate-900">{order.customer.name}</div>
                        {order.customer.email && (
                          <div className="text-xs text-slate-500">{order.customer.email}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {formatDateTime(order.created_at)}
                      </TableCell>
                      <TableCell className="text-right text-slate-700">
                        {formatRupiah(order.subtotal)}
                      </TableCell>
                      <TableCell className="text-right text-slate-700">
                        {formatRupiah(order.tax_amount)}
                      </TableCell>
                      <TableCell className="text-right font-bold text-slate-900">
                        {formatRupiah(order.grand_total)}
                      </TableCell>
                      <TableCell>
                        <OrderStatusBadge status={order.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/orders/${order.id}`}>
                            <Eye className="h-3.5 w-3.5" />
                            Details
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="mt-4 flex items-center justify-between border-t pt-4">
                <p className="text-xs text-slate-500">
                  Page <span className="font-semibold text-slate-800">{page}</span> of{' '}
                  <span className="font-semibold text-slate-800">{totalPages}</span> (
                  {meta?.total ?? 0} total orders)
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-96 w-full" />
        </div>
      }
    >
      <OrdersListContent />
    </Suspense>
  );
}
