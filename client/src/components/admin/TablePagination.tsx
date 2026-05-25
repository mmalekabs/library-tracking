import { PAGE_SIZE_OPTIONS, type PageSize } from "@/constants/pagination";
import type { PaginationMeta } from "@/lib/books";

interface TablePaginationProps {
  page: number;
  pageSize: PageSize;
  pagination: PaginationMeta | undefined;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: PageSize) => void;
}

export function TablePagination({
  page,
  pageSize,
  pagination,
  onPageChange,
  onPageSizeChange,
}: TablePaginationProps) {
  if (!pagination || pagination.totalItems === 0) return null;

  const { totalPages, totalItems } = pagination;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-gray-200 pt-4">
      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
        <label className="flex items-center gap-2">
          <span>Rows per page</span>
          <select
            value={pageSize}
            onChange={(e) =>
              onPageSizeChange(Number(e.target.value) as PageSize)
            }
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <span>
          {from}–{to} of {totalItems}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-50"
        >
          Previous
        </button>
        <span className="min-w-[7rem] text-center text-sm text-gray-600">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}
