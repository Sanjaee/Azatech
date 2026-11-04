'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Loader2,
  Calculator,
  AlertCircle,
  Check,
  ChevronsUpDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { createOrderFormSchema, CreateOrderFormValues } from '@/schemas';
import { useCustomers, useProducts, useCreateOrder } from '@/hooks/use-oms';
import { ApiClientError } from '@/lib/api-client';
import { calculatePreviewVariantCTax, cn, formatRupiah } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Separator } from '@/components/ui/separator';

export default function CreateOrderPage() {
  const router = useRouter();
  const [customerPopoverOpen, setCustomerPopoverOpen] = useState(false);
  const [productPopoverIndex, setProductPopoverIndex] = useState<number | null>(null);
  const [serverErrorBanner, setServerErrorBanner] = useState<string | null>(null);

  const customersQuery = useCustomers({ page: 1, per_page: 100 });
  const productsQuery = useProducts({ page: 1, per_page: 100 });
  const createOrder = useCreateOrder();

  const customers = customersQuery.data?.data ?? [];
  const products = productsQuery.data?.data ?? [];

  const productMap = useMemo(() => {
    return new Map(products.map((p) => [p.id, p]));
  }, [products]);

  const form = useForm<CreateOrderFormValues>({
    resolver: zodResolver(createOrderFormSchema),
    defaultValues: {
      customer_id: '',
      items: [{ product_id: '', quantity: 1 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  const watchedItems = form.watch('items');

  const previewTotals = useMemo(() => {
    let rawSubtotal = 0;
    for (const item of watchedItems || []) {
      const prod = productMap.get(item.product_id);
      const qty = Number(item.quantity) || 0;
      if (prod && qty > 0) {
        rawSubtotal += prod.price * qty;
      }
    }
    return calculatePreviewVariantCTax(rawSubtotal);
  }, [watchedItems, productMap]);

  async function onSubmit(values: CreateOrderFormValues) {
    if (createOrder.isPending) return;
    setServerErrorBanner(null);

    try {
      const res = await createOrder.mutateAsync(values);
      toast.success(`Order ${res.data.order_number} created successfully!`);
      router.push(`/orders/${res.data.id}`);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setServerErrorBanner(err.message);
        if (err.errors) {
          for (const [fieldPath, messages] of Object.entries(err.errors)) {
            if (messages && messages.length > 0) {
              // Map e.g. "items.1.quantity" or "items.0.product_id" or "customer_id" directly to RHF
              form.setError(fieldPath as any, {
                type: 'server',
                message: messages[0],
              });
            }
          }
        }
        toast.error(err.message);
      } else {
        setServerErrorBanner('An unexpected error occurred while creating the order.');
        toast.error('Failed to create order');
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="icon">
            <Link href="/orders">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back to Orders</span>
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Create New Order
            </h1>
            <p className="text-sm text-slate-500">
              Select a customer and add products. Backend calculates authoritative prices & Variant C PPN.
            </p>
          </div>
        </div>
      </div>

      {serverErrorBanner && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
        >
          <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">{serverErrorBanner}</p>
            <p className="text-xs text-rose-700 mt-0.5">
              Review the highlighted item rows below and adjust quantities or product selections.
            </p>
          </div>
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6 lg:grid-cols-3" noValidate>
          {/* Left 2 Columns: Customer & Order Items */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">1. Customer Information</CardTitle>
                <CardDescription>
                  Choose the customer account for this invoice.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="customer_id"
                  render={({ field }) => {
                    const selectedCustomer = customers.find((c) => c.id === field.value);
                    return (
                      <FormItem className="flex flex-col">
                        <FormLabel>Customer *</FormLabel>
                        <Popover
                          open={customerPopoverOpen}
                          onOpenChange={setCustomerPopoverOpen}
                        >
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                disabled={createOrder.isPending}
                                className={cn(
                                  'w-full justify-between font-normal',
                                  !field.value && 'text-muted-foreground'
                                )}
                              >
                                {selectedCustomer
                                  ? `${selectedCustomer.name}${
                                      selectedCustomer.email ? ` (${selectedCustomer.email})` : ''
                                    }`
                                  : 'Select customer...'}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-[400px] max-w-[90vw] p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Search customer by name or email..." />
                              <CommandList>
                                <CommandEmpty>No customer found.</CommandEmpty>
                                <CommandGroup>
                                  {customers.map((c) => (
                                    <CommandItem
                                      key={c.id}
                                      value={`${c.name} ${c.email || ''}`}
                                      onSelect={() => {
                                        form.setValue('customer_id', c.id, {
                                          shouldValidate: true,
                                        });
                                        setCustomerPopoverOpen(false);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          'mr-2 h-4 w-4',
                                          c.id === field.value ? 'opacity-100' : 'opacity-0'
                                        )}
                                      />
                                      <div className="flex flex-col">
                                        <span className="font-medium">{c.name}</span>
                                        {c.email && (
                                          <span className="text-xs text-slate-500">{c.email}</span>
                                        )}
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">2. Order Line Items</CardTitle>
                  <CardDescription>
                    Select products and specify quantities. Stock is locked and verified on submission.
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={createOrder.isPending}
                  onClick={() => append({ product_id: '', quantity: 1 })}
                >
                  <Plus className="h-4 w-4" />
                  Add Row
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {fields.map((fieldItem, index) => {
                  const currentProductId = watchedItems?.[index]?.product_id;
                  const currentQty = Number(watchedItems?.[index]?.quantity) || 0;
                  const selectedProduct = productMap.get(currentProductId);
                  const lineSubtotal = selectedProduct ? selectedProduct.price * currentQty : 0;

                  const itemQtyError =
                    form.formState.errors.items?.[index]?.quantity?.message;
                  const itemProdError =
                    form.formState.errors.items?.[index]?.product_id?.message;

                  return (
                    <div
                      key={fieldItem.id}
                      className={cn(
                        'rounded-lg border p-4 transition-colors',
                        itemQtyError || itemProdError
                          ? 'border-rose-300 bg-rose-50/30'
                          : 'bg-slate-50/40'
                      )}
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                        {/* 1. Product Selector (5 cols) */}
                        <div className="sm:col-span-5">
                          <FormField
                            control={form.control}
                            name={`items.${index}.product_id`}
                            render={({ field }) => (
                              <FormItem className="space-y-1.5">
                                <FormLabel className="text-xs font-medium text-slate-600">
                                  Product #{index + 1}
                                </FormLabel>
                                <Popover
                                  open={productPopoverIndex === index}
                                  onOpenChange={(open) =>
                                    setProductPopoverIndex(open ? index : null)
                                  }
                                >
                                  <PopoverTrigger asChild>
                                    <FormControl>
                                      <Button
                                        variant="outline"
                                        role="combobox"
                                        disabled={createOrder.isPending}
                                        className={cn(
                                          'w-full h-10 justify-between font-normal bg-white text-left px-3',
                                          !field.value && 'text-muted-foreground'
                                        )}
                                      >
                                        <span className="truncate">
                                          {selectedProduct
                                            ? `${selectedProduct.product_code} — ${selectedProduct.name}`
                                            : 'Select product...'}
                                        </span>
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                      </Button>
                                    </FormControl>
                                  </PopoverTrigger>
                                  <PopoverContent
                                    className="w-[420px] max-w-[90vw] p-0"
                                    align="start"
                                  >
                                    <Command>
                                      <CommandInput placeholder="Search SKU or product name..." />
                                      <CommandList>
                                        <CommandEmpty>No matching product.</CommandEmpty>
                                        <CommandGroup>
                                          {products.map((p) => (
                                            <CommandItem
                                              key={p.id}
                                              value={`${p.product_code} ${p.name}`}
                                              onSelect={() => {
                                                form.setValue(
                                                  `items.${index}.product_id`,
                                                  p.id,
                                                  { shouldValidate: true }
                                                );
                                                form.clearErrors(`items.${index}.product_id`);
                                                form.clearErrors(`items.${index}.quantity`);
                                                setProductPopoverIndex(null);
                                              }}
                                            >
                                              <Check
                                                className={cn(
                                                  'mr-2 h-4 w-4 shrink-0',
                                                  p.id === field.value
                                                    ? 'opacity-100'
                                                    : 'opacity-0'
                                                )}
                                              />
                                              <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2">
                                                  <span className="font-mono text-xs font-semibold text-slate-700">
                                                    {p.product_code}
                                                  </span>
                                                  <span className="text-xs font-semibold text-slate-900">
                                                    {formatRupiah(p.price)}
                                                  </span>
                                                </div>
                                                <p className="text-xs text-slate-700 truncate">
                                                  {p.name}
                                                </p>
                                                <p className="text-[11px] text-slate-500">
                                                  Available Stock: {p.stock} units
                                                </p>
                                              </div>
                                            </CommandItem>
                                          ))}
                                        </CommandGroup>
                                      </CommandList>
                                    </Command>
                                  </PopoverContent>
                                </Popover>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        {/* 2. Quantity Input (2 cols) */}
                        <div className="sm:col-span-2">
                          <FormField
                            control={form.control}
                            name={`items.${index}.quantity`}
                            render={({ field }) => (
                              <FormItem className="space-y-1.5">
                                <FormLabel className="text-xs font-medium text-slate-600">
                                  Quantity
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    min={1}
                                    step={1}
                                    className="h-10 bg-white"
                                    disabled={createOrder.isPending}
                                    {...field}
                                    onChange={(e) => {
                                      field.onChange(e);
                                      form.clearErrors(`items.${index}.quantity`);
                                    }}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        {/* 3. Item Subtotal Display Box (4 cols) */}
                        <div className="sm:col-span-4">
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-600 block">
                              Item Subtotal
                            </label>
                            <div className="flex h-10 items-center justify-end px-3 rounded-md border border-input bg-white text-sm font-bold text-slate-900 shadow-sm">
                              {formatRupiah(lineSubtotal)}
                            </div>
                          </div>
                        </div>

                        {/* 4. Delete Action Button (1 col) */}
                        <div className="sm:col-span-1">
                          <div className="space-y-1.5">
                            <span className="text-xs font-medium text-transparent select-none hidden sm:block">
                              &nbsp;
                            </span>
                            <div className="flex h-10 items-center justify-center">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                disabled={fields.length <= 1 || createOrder.isPending}
                                onClick={() => remove(index)}
                                className="h-10 w-10 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border-slate-200"
                                title="Remove item"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Product Details & Stock Badge: Cleanly placed below the aligned inputs */}
                      {selectedProduct && (
                        <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                          <span>
                            Kode:{' '}
                            <span className="font-mono font-medium text-slate-700">
                              {selectedProduct.product_code}
                            </span>
                          </span>
                          <span>•</span>
                          <span>
                            Unit Price:{' '}
                            <strong className="text-slate-800">
                              {formatRupiah(selectedProduct.price)}
                            </strong>
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1.5">
                            Available Stock:
                            <Badge
                              variant={
                                selectedProduct.stock === 0
                                  ? 'danger'
                                  : selectedProduct.stock < currentQty
                                  ? 'warning'
                                  : 'success'
                              }
                              className="text-[11px] px-2 py-0.5"
                            >
                              {selectedProduct.stock} units
                            </Badge>
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Order Financial Preview & Submit */}
          <div className="space-y-6">
            <Card className="sticky top-24">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base">Order Summary Preview</CardTitle>
                </div>
                <CardDescription>
                  Variant C: VAT / PPN 11% rounded UP to nearest Rp100.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2.5 text-sm">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Items Count</span>
                    <span className="font-medium text-slate-900">
                      {watchedItems?.length || 0} line item(s)
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Estimated Subtotal</span>
                    <span className="font-semibold text-slate-900">
                      {formatRupiah(previewTotals.subtotal)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <div>
                      <span>Estimated PPN (11%)</span>
                      <p className="text-[10px] text-slate-400">
                        CEILING(subtotal × 0.11 / 100) × 100
                      </p>
                    </div>
                    <span className="font-semibold text-slate-900">
                      {formatRupiah(previewTotals.taxAmount)}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-base font-bold text-slate-900">
                      Estimated Grand Total
                    </span>
                    <span className="text-lg font-bold text-primary">
                      {formatRupiah(previewTotals.grandTotal)}
                    </span>
                  </div>
                </div>

                <div className="rounded-md bg-slate-100 p-3 text-[11px] text-slate-600 leading-relaxed">
                  <strong>Authoritative Calculation:</strong> Only{' '}
                  <code className="font-mono">customer_id</code> and{' '}
                  <code className="font-mono">items (product_id, quantity)</code> are sent to the
                  server. Final prices, PPN, and stock deductions are executed atomically in
                  PostgreSQL.
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-2">
                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={createOrder.isPending}
                >
                  {createOrder.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processing Transaction...
                    </>
                  ) : (
                    'Submit Order'
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={createOrder.isPending}
                  onClick={() => router.push('/orders')}
                >
                  Cancel
                </Button>
              </CardFooter>
            </Card>
          </div>
        </form>
      </Form>
    </div>
  );
}
