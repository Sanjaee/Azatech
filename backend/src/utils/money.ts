/**
 * Monetary calculation utilities for Azatech OMS — Variant C
 *
 * All money values are represented as exact integer cents (1/100th of Rupiah)
 * internally during arithmetic to prevent IEEE-754 floating-point drift,
 * and serialized/stored in PostgreSQL as NUMERIC(15, 2) strings ("150000.00")
 * and integer/decimal numbers in JSON responses.
 */

export function parseMoneyToCents(value: string | number): bigint {
  const str = typeof value === 'number' ? value.toFixed(2) : value.trim();
  const negative = str.startsWith('-');
  const clean = negative ? str.slice(1) : str;
  const parts = clean.split('.');
  const whole = BigInt(parts[0] || '0');
  const fracRaw = (parts[1] || '00').padEnd(2, '0').slice(0, 2);
  const frac = BigInt(fracRaw);
  const cents = whole * 100n + frac;
  return negative ? -cents : cents;
}

export function centsToNumericString(cents: bigint): string {
  const negative = cents < 0n;
  const abs = negative ? -cents : cents;
  const whole = abs / 100n;
  const frac = (abs % 100n).toString().padStart(2, '0');
  return `${negative ? '-' : ''}${whole.toString()}.${frac}`;
}

export function centsToNumber(cents: bigint): number {
  return Number(cents) / 100;
}

export function numericStringToNumber(value: string | number): number {
  if (typeof value === 'number') return value;
  return Number(parseMoneyToCents(value)) / 100;
}

/**
 * Variant C: VAT / PPN 11% rounded UP to the nearest Rp100.
 *
 * Formula:
 *   tax_amount = CEILING(subtotal * 0.11 / 100) * 100
 *   grand_total = subtotal + tax_amount
 *
 * Example 1:
 *   Subtotal: Rp150,000 -> Tax before rounding: Rp16,500 -> Tax after rounding: Rp16,500 -> Grand total: Rp166,500
 * Example 2:
 *   Subtotal: Rp150,010 -> Tax before rounding: Rp16,501.10 -> Tax after rounding: Rp16,600 -> Grand total: Rp166,610
 *
 * Exact integer math derivation:
 *   Let subtotalCents = subtotal * 100.
 *   We want CEILING((subtotalCents / 100) * (11 / 100) / 100) * 100 Rupiah
 *   = CEILING(subtotalCents * 11 / 1,000,000) * 100 Rupiah.
 *   In integer division for positive numerator N = subtotalCents * 11n and denominator D = 1_000_000n:
 *   CEILING(N / D) = (N + D - 1n) / D (when N > 0n; 0n when N == 0n).
 */
export function calculateVariantCTaxCents(subtotalCents: bigint): {
  subtotalCents: bigint;
  taxAmountCents: bigint;
  grandTotalCents: bigint;
} {
  if (subtotalCents <= 0n) {
    return {
      subtotalCents: 0n,
      taxAmountCents: 0n,
      grandTotalCents: 0n,
    };
  }

  const numerator = subtotalCents * 11n;
  const denominator = 1_000_000n;
  const roundedHundredsOfRupiah = (numerator + denominator - 1n) / denominator;

  // Each Rp100 unit equals 10,000 cents (100 * 100 cents)
  const taxAmountCents = roundedHundredsOfRupiah * 10_000n;
  const grandTotalCents = subtotalCents + taxAmountCents;

  return {
    subtotalCents,
    taxAmountCents,
    grandTotalCents,
  };
}

export function calculateVariantCTax(subtotal: string | number): {
  subtotal: string;
  taxAmount: string;
  grandTotal: string;
  subtotalNumber: number;
  taxAmountNumber: number;
  grandTotalNumber: number;
} {
  const subCents = parseMoneyToCents(subtotal);
  const { subtotalCents, taxAmountCents, grandTotalCents } = calculateVariantCTaxCents(subCents);

  return {
    subtotal: centsToNumericString(subtotalCents),
    taxAmount: centsToNumericString(taxAmountCents),
    grandTotal: centsToNumericString(grandTotalCents),
    subtotalNumber: centsToNumber(subtotalCents),
    taxAmountNumber: centsToNumber(taxAmountCents),
    grandTotalNumber: centsToNumber(grandTotalCents),
  };
}
