'use client';

import React, { use, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CreditCard,
  XCircle,
  Loader2,
  User as UserIcon,
  Mail,
  Phone,
  MapPin,
  FileText,
  AlertCircle,
  ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import { useOrderDetail, usePayOrder, useCancelOrder } from '@/hooks/use-oms';
import { ApiClientError } from '@/lib/api-client';
import { formatDateTime, formatRupiah } from '@/lib/utils';
import { OrderStatusBadge } from '@/components/orders/order-status-badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: order, isLoading, isError, refetch } = useOrderDetail(id);
  const payOrder = usePayOrder();
  const cancelOrder = useCancelOrder();
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  const isMutating = payOrder.isPending || cancelOrder.isPending;

  async function handlePay() {
    if (!order || isMutating) return;
    try {
      await payOrder.mutateAsync(order.id);
      toast.success(`Order ${order.order_number} marked as PAID`);
    } catch (err) {
      if (err instanceof ApiClientError) {
        toast.error(err.message);
      } else {
        toast.error('Failed to process payment status update');
      }
    }
  }

  async function handleConfirmCancel() {
    if (!order || isMutating) return;
    try {
      await cancelOrder.mutateAsync(order.id);
      setCancelDialogOpen(false);
      toast.success(
        `Order ${order.order_number} cancelled and inventory stock restored`
      );
    } catch (err) {
      if (err instanceof ApiClientError) {
        toast.error(err.message);
      } else {
        toast.error('Failed to cancel order');
      }
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-80 lg:col-span-2" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="space-y-4">
        <Button asChild variant="outline" size="sm">
          <Link href="/orders">
            <ArrowLeft className="h-4 w-4" />
            Back to Orders
          </Link>
        </Button>
        <div className="flex flex-col items-center justify-center py-16 text-center border rounded-xl bg-white">
          <AlertCircle className="h-10 w-10 text-rose-600 mb-3" />
          <h2 className="text-lg font-semibold text-slate-900">Order Not Found</h2>
          <p className="text-sm text-slate-500 max-w-md mt-1 mb-4">
            The requested invoice could not be found or could not be loaded.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
            <Button asChild>
              <Link href="/orders">Return to Order List</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const canPay = order.status === 'PENDING';
  const canCancel = order.status === 'PENDING' || order.status === 'PAID';

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="icon">
            <Link href="/orders">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back to Orders</span>
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight font-mono text-slate-900">
                {order.order_number}
              </h1>
              <OrderStatusBadge status={order.status} />
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Created on {formatDateTime(order.created_at)}
            </p>
          </div>
        </div>

        {/* Status Transition Actions — Do not display invalid actions for completed/cancelled orders */}
        <div className="flex items-center gap-2.5">
          {canPay && (
            <Button
              onClick={handlePay}
              disabled={isMutating}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {payOrder.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="h-4 w-4" />
              )}
              Mark as Paid
            </Button>
          )}

          {canCancel && (
            <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isMutating}>
                  <XCircle className="h-4 w-4" />
                  Cancel Order
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <ShieldAlert className="h-5 w-5 text-rose-600" />
                    Confirm Order Cancellation
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to cancel order{' '}
                    <strong className="font-mono text-slate-900">
                      {order.order_number}
                    </strong>
                    ? All ordered quantities ({order.items.length} line item(s)) will be
                    atomically returned to product inventory stock. This action cannot be
                    undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={cancelOrder.isPending}>
                    Keep Order
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => {
                      e.preventDefault();
                      handleConfirmCancel();
                    }}
                    disabled={cancelOrder.isPending}
                    className="bg-rose-600 hover:bg-rose-700 text-white"
                  >
                    {cancelOrder.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Cancelling...
                      </>
                    ) : (
                      'Yes, Cancel & Restore Stock'
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Order Items & Historical Snapshots */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">
                  Order Items (Historical Price Snapshots)
                </CardTitle>
              </div>
              <CardDescription>
                Unit prices and product names below are immutable snapshots captured at the
                moment of order creation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product Code</TableHead>
                    <TableHead>Product Name (Snapshot)</TableHead>
                    <TableHead className="text-right">Historical Unit Price</TableHead>
                    <TableHead className="text-center">Qty</TableHead>
                    <TableHead className="text-right">Item Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs font-semibold text-slate-700">
                        {item.product_code}
                      </TableCell>
                      <TableCell className="font-medium text-slate-900">
                        {item.product_name}
                      </TableCell>
                      <TableCell className="text-right text-slate-700">
                        {formatRupiah(item.unit_price)}
                      </TableCell>
                      <TableCell className="text-center font-semibold">
                        {item.quantity}
                      </TableCell>
                      <TableCell className="text-right font-bold text-slate-900">
                        {formatRupiah(item.subtotal)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Customer Info & Financial Breakdown */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Financial Breakdown</CardTitle>
              <CardDescription>Variant C — PPN 11% (Rounded UP to Rp100)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between text-slate-600">
                <span>Order Subtotal</span>
                <span className="font-semibold text-slate-900">
                  {formatRupiah(order.subtotal)}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <div>
                  <span>Tax Amount (PPN 11%)</span>
                  <p className="text-[10px] text-slate-400">
                    Rounded up to nearest Rp100
                  </p>
                </div>
                <span className="font-semibold text-slate-900">
                  {formatRupiah(order.tax_amount)}
                </span>
              </div>
              <Separator />
              <div className="flex items-center justify-between pt-1">
                <span className="text-base font-bold text-slate-900">Grand Total</span>
                <span className="text-lg font-bold text-primary">
                  {formatRupiah(order.grand_total)}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Customer Details</CardTitle>
              <CardDescription>Billed customer information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <UserIcon className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-slate-500">Customer Name</p>
                  <p className="font-semibold text-slate-900">{order.customer.name}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Mail className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-slate-500">Email</p>
                  <p className="text-slate-800">{order.customer.email || '—'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-slate-500">Phone</p>
                  <p className="text-slate-800">{order.customer.phone || '—'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-slate-500">Address</p>
                  <p className="text-slate-800">{order.customer.address || '—'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
