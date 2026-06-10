import type { Decimal } from "@prisma/client/runtime/library";

export function decimalToNumber(
  value: Decimal | null | undefined,
): number | null {
  if (value === null || value === undefined) return null;
  return Number(value);
}

/** purchasePrice - marketPrice; null if either price is missing */
export function calculateSavings(
  purchasePrice: Decimal | number | null | undefined,
  marketPrice: Decimal | number | null | undefined,
): number | null {
  const purchase =
    typeof purchasePrice === "number"
      ? purchasePrice
      : decimalToNumber(purchasePrice as Decimal | null);
  const market =
    typeof marketPrice === "number"
      ? marketPrice
      : decimalToNumber(marketPrice as Decimal | null);

  if (purchase === null || market === null) return null;
  return Math.round(purchase - market);
}
