import {
  BOOK_TABLE_COLUMNS,
  type BookTableColumnField,
} from "./bookTableEdit";

const STORAGE_KEY = "admin-book-table-column-order";

export const DEFAULT_BOOK_TABLE_COLUMN_ORDER: BookTableColumnField[] =
  BOOK_TABLE_COLUMNS.map((c) => c.key);

export function loadBookTableColumnOrder(): BookTableColumnField[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...DEFAULT_BOOK_TABLE_COLUMN_ORDER];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...DEFAULT_BOOK_TABLE_COLUMN_ORDER];

    const valid = new Set(DEFAULT_BOOK_TABLE_COLUMN_ORDER);
    const order = parsed.filter(
      (key): key is BookTableColumnField =>
        typeof key === "string" && valid.has(key as BookTableColumnField),
    );

    for (const key of DEFAULT_BOOK_TABLE_COLUMN_ORDER) {
      if (!order.includes(key)) order.push(key);
    }

    return order.length > 0 ? order : [...DEFAULT_BOOK_TABLE_COLUMN_ORDER];
  } catch {
    return [...DEFAULT_BOOK_TABLE_COLUMN_ORDER];
  }
}

export function saveBookTableColumnOrder(order: BookTableColumnField[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
}

export function getBookTableColumnsForOrder(order: BookTableColumnField[]) {
  const byKey = Object.fromEntries(
    BOOK_TABLE_COLUMNS.map((col) => [col.key, col]),
  ) as Record<BookTableColumnField, (typeof BOOK_TABLE_COLUMNS)[number]>;

  return order.map((key) => byKey[key]).filter(Boolean);
}

export function getBookTableColumnLabel(key: BookTableColumnField): string {
  return BOOK_TABLE_COLUMNS.find((c) => c.key === key)?.label ?? key;
}
