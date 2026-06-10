/** True when value is exactly 13 digits (ignoring spaces and hyphens). */
export function isValidIsbn13(value: string | null | undefined): boolean {
  if (!value?.trim()) return false;
  const digits = value.replace(/[^0-9]/g, "");
  return digits.length === 13;
}

/** Empty or not a valid ISBN-13 — should be replaced from Goodreads. */
export function needsIsbn13(value: string | null | undefined): boolean {
  return !isValidIsbn13(value);
}
