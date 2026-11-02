'use client';

import React, { useState } from 'react';
import {
  Users,
  Plus,
  Search,
  Mail,
  Phone,
  MapPin,
  Eye,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Customer } from '@/types';
import { useCustomers } from '@/hooks/use-oms';
import { formatDateTime } from '@/lib/utils';
import { CustomerFormDialog } from '@/components/customers/customer-form-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function CustomersPage() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const perPage = 10;
  const { data, isLoading, isError, refetch } = useCustomers({
    page,
    per_page: perPage,
    search: searchQuery,
  });

  const customers = data?.data ?? [];
  const meta = data?.meta;
  const totalPages = meta?.total_pages ?? (meta ? Math.ceil(meta.total / meta.per_page) || 1 : 1);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setSearchQuery(searchInput.trim());
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Customers</h1>
          <p className="text-sm text-slate-500">
            Directory of registered corporate and individual store buyers.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Customer
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-base">Customer Directory</CardTitle>
              <CardDescription>
                {meta
                  ? `Showing ${customers.length} of ${meta.total} customers`
                  : 'Loading customers...'}
              </CardDescription>
            </div>

            <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full sm:w-80">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search by name, email, phone..."
                  value={searchInput}
                  onChange={(e) => {
                    setSearchInput(e.target.value);
                    if (e.target.value === '') {
                      setPage(1);
                      setSearchQuery('');
                    }
                  }}
                  className="pl-9"
                />
              </div>
              <Button type="submit" variant="secondary" size="sm">
                Search
              </Button>
            </form>
          </div>
        </CardHeader>

        <CardContent>
          {isError ? (
            <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg bg-rose-50/40">
              <AlertCircle className="h-8 w-8 text-rose-600 mb-2" />
              <p className="text-sm font-semibold text-rose-900">Failed to load customers</p>
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
          ) : customers.length === 0 ? (
            <div className="text-center py-12 border rounded-lg bg-slate-50/50">
              <Users className="h-8 w-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-700">No customers found</p>
              <p className="text-xs text-slate-500 mb-4">
                {searchQuery
                  ? `No customers matched "${searchQuery}".`
                  : 'Add your first customer to begin creating orders.'}
              </p>
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                Add Customer
              </Button>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead className="text-right">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-semibold text-slate-900">
                        {customer.name}
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {customer.email || <span className="text-slate-400">—</span>}
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {customer.phone || <span className="text-slate-400">—</span>}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-slate-600">
                        {customer.address || <span className="text-slate-400">—</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedCustomer(customer)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
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
                  {meta?.total ?? 0} total customers)
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

      <CustomerFormDialog open={createOpen} onOpenChange={setCreateOpen} />

      {/* Customer Details Dialog */}
      <Dialog
        open={Boolean(selectedCustomer)}
        onOpenChange={(open) => !open && setSelectedCustomer(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedCustomer?.name}</DialogTitle>
            <DialogDescription>Customer profile and contact details</DialogDescription>
          </DialogHeader>
          {selectedCustomer && (
            <div className="space-y-4 text-sm">
              <div className="rounded-lg border bg-slate-50/70 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <Mail className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-slate-500">Email</p>
                    <p className="text-slate-900">{selectedCustomer.email || 'Not provided'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-slate-500">Phone</p>
                    <p className="text-slate-900">{selectedCustomer.phone || 'Not provided'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-slate-500">Address</p>
                    <p className="text-slate-900">{selectedCustomer.address || 'Not provided'}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                <span>Customer ID: {selectedCustomer.id}</span>
                <span>Joined: {formatDateTime(selectedCustomer.created_at)}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
