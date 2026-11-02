'use client';

import React, { useState } from 'react';
import {
  Package,
  Plus,
  Search,
  Pencil,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { Product } from '@/types';
import { useProducts } from '@/hooks/use-oms';
import { formatRupiah } from '@/lib/utils';
import { ProductFormDialog } from '@/components/products/product-form-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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

export default function ProductsPage() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const perPage = 10;
  const { data, isLoading, isError, refetch } = useProducts({
    page,
    per_page: perPage,
    search: searchQuery,
  });

  const products = data?.data ?? [];
  const meta = data?.meta;
  const totalPages = meta?.total_pages ?? (meta ? Math.ceil(meta.total / meta.per_page) || 1 : 1);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setSearchQuery(searchInput.trim());
  }

  function handleOpenCreate() {
    setEditingProduct(null);
    setDialogOpen(true);
  }

  function handleOpenEdit(product: Product) {
    setEditingProduct(product);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Products</h1>
          <p className="text-sm text-slate-500">
            Manage store inventory, SKU codes, and unit prices.
          </p>
        </div>
        <Button onClick={handleOpenCreate}>
          <Plus className="h-4 w-4" />
          Add Product
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-base">Product Catalog</CardTitle>
              <CardDescription>
                {meta ? `Showing ${products.length} of ${meta.total} products` : 'Loading catalog...'}
              </CardDescription>
            </div>

            <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full sm:w-80">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search by name or code..."
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
              <p className="text-sm font-semibold text-rose-900">Failed to load products</p>
              <p className="text-xs text-rose-700 mb-4">
                Please check your connection and try again.
              </p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Retry
              </Button>
            </div>
          ) : isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12 border rounded-lg bg-slate-50/50">
              <Package className="h-8 w-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-700">No products found</p>
              <p className="text-xs text-slate-500 mb-4">
                {searchQuery
                  ? `No products matched "${searchQuery}".`
                  : 'Get started by adding your first product.'}
              </p>
              {searchQuery ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchInput('');
                    setSearchQuery('');
                    setPage(1);
                  }}
                >
                  Clear Search
                </Button>
              ) : (
                <Button size="sm" onClick={handleOpenCreate}>
                  Add Product
                </Button>
              )}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Product Name</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-center">Stock</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-mono text-xs font-semibold text-slate-700">
                        {product.product_code}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-slate-900">{product.name}</div>
                        {product.description && (
                          <div className="text-xs text-slate-500 line-clamp-1">
                            {product.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-slate-900">
                        {formatRupiah(product.price)}
                      </TableCell>
                      <TableCell className="text-center">
                        {product.stock === 0 ? (
                          <Badge variant="danger">Out of Stock (0)</Badge>
                        ) : product.stock <= 10 ? (
                          <Badge variant="warning">Low ({product.stock})</Badge>
                        ) : (
                          <Badge variant="success">{product.stock} in stock</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEdit(product)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination Controls */}
              <div className="mt-4 flex items-center justify-between border-t pt-4">
                <p className="text-xs text-slate-500">
                  Page <span className="font-semibold text-slate-800">{page}</span> of{' '}
                  <span className="font-semibold text-slate-800">{totalPages}</span> (
                  {meta?.total ?? 0} total items)
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

      <ProductFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingProduct={editingProduct}
      />
    </div>
  );
}
