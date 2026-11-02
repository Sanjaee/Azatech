import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRupiah(amount: number | string): string {
  const num = typeof amount === 'string' ? Number(amount) : amount;
  if (Number.isNaN(num)) return 'Rp0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

/**
 * Preview calculation of Variant C VAT (PPN 11% rounded UP to nearest Rp100)
 * Note: This is strictly for frontend display preview. Backend calculation is authoritative.
 */
export function calculatePreviewVariantCTax(subtotal: number): {
  subtotal: number;
  taxAmount: number;
  grandTotal: number;
} {
  if (subtotal <= 0) {
    return { subtotal: 0, taxAmount: 0, grandTotal: 0 };
  }
  const subtotalCents = Math.round(subtotal * 100);
  const roundedHundreds = Math.ceil((subtotalCents * 11) / 1_000_000);
  const taxAmount = roundedHundreds * 100;
  const grandTotal = subtotal + taxAmount;
  return { subtotal, taxAmount, grandTotal };
}

export function formatDateTime(dateInput: string | Date): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}
