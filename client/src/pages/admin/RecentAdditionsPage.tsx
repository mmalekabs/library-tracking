import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { bulkDeleteBooks, fetchAdminBooks } from "@/lib/books";
import { ApiError } from "@/lib/api";
import type { Book } from "@/types";
import { inputClass } from "@/components/admin/FormSection";
import { TablePagination } from "@/components/admin/TablePagination";
import { DEFAULT_PAGE_SIZE, type PageSize } from "@/constants/pagination";

type CollectionFilter = "all" | "library" | "to_purchase";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function bookTypeLabel(book: Book): string {
  if (book.toPurchase) return "To purchase";
  return "Library";
}

function formatCreatedAt(value?: string): string {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function RecentAdditionsPage() {
  const queryClient = useQueryClient();
  const today = isoDate(new Date());
  const weekAgo = isoDate(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000));

  const [createdFrom, setCreatedFrom] = useState(today);
  const [createdTo, setCreatedTo] = useState(today);
  const [collection, setCollection] = useState<CollectionFilter>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const queryKey = [
    "books",
    "recent",
    createdFrom,
    createdTo,
    collection,
    search,
    page,
    pageSize,
  ] as const;

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      fetchAdminBooks({
        page,
        limit: pageSize,
        search: search.trim() || undefined,
        collection,
        createdFrom,
        createdTo,
        sortBy: "createdAt",
        sortOrder: "desc",
        visibility: "all",
      }),
  });

  const books = data?.data ?? [];
  const pagination = data?.pagination;

  const allOnPageSelected =
    books.length > 0 && books.every((book) => selected.has(book.id));

  const toggleAllOnPage = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        books.forEach((book) => next.delete(book.id));
      } else {
        books.forEach((book) => next.add(book.id));
      }
      return next;
    });
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const deleteMutation = useMutation({
    mutationFn: bulkDeleteBooks,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["books"] });
      setSelected(new Set());
      toast.success(`Deleted ${result.deleted} book(s)`);
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Delete failed"),
  });

  const handleBulkDelete = () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (
      !confirm(
        `Delete ${ids.length} selected book(s)? Reading history for those books will be removed too.`,
      )
    ) {
      return;
    }
    deleteMutation.mutate(ids);
  };

  const applyPreset = (from: string, to: string) => {
    setCreatedFrom(from);
    setCreatedTo(to);
    setPage(1);
    setSelected(new Set());
  };

  const selectedCount = selected.size;

  const summaryText = useMemo(() => {
    if (!pagination) return null;
    return `${pagination.totalItems} book(s) added between ${createdFrom} and ${createdTo}`;
  }, [pagination, createdFrom, createdTo]);

  return (
    <div className="max-w-6xl">
      <h2 className="text-2xl font-bold text-gray-900">Recent additions</h2>
      <p className="mt-1 text-sm text-gray-600">
        Review books added in a date range and bulk-delete imports you want to
        undo. Use this after a Bookmory import to roll back mistakes.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => applyPreset(today, today)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => applyPreset(weekAgo, today)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          Last 7 days
        </button>
        <Link
          to="/admin/import/bookmory"
          className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10"
        >
          Back to Bookmory import
        </Link>
      </div>

      <div className="mt-6 grid gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        <label className="block text-sm">
          <span className="font-medium text-gray-700">Added from</span>
          <input
            type="date"
            value={createdFrom}
            onChange={(e) => {
              setCreatedFrom(e.target.value);
              setPage(1);
              setSelected(new Set());
            }}
            className={`${inputClass} mt-1`}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-gray-700">Added to</span>
          <input
            type="date"
            value={createdTo}
            onChange={(e) => {
              setCreatedTo(e.target.value);
              setPage(1);
              setSelected(new Set());
            }}
            className={`${inputClass} mt-1`}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-gray-700">Type</span>
          <select
            value={collection}
            onChange={(e) => {
              setCollection(e.target.value as CollectionFilter);
              setPage(1);
              setSelected(new Set());
            }}
            className={`${inputClass} mt-1`}
          >
            <option value="all">All types</option>
            <option value="library">Library</option>
            <option value="to_purchase">To purchase</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium text-gray-700">Search</span>
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Title or author…"
            className={`${inputClass} mt-1`}
          />
        </label>
      </div>

      {summaryText && (
        <p className="mt-4 text-sm text-gray-600">{summaryText}</p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={selectedCount === 0 || deleteMutation.isPending}
          onClick={handleBulkDelete}
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
          {deleteMutation.isPending
            ? "Deleting…"
            : `Delete selected (${selectedCount})`}
        </button>
        {selectedCount > 0 && (
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Clear selection
          </button>
        )}
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={allOnPageSelected}
                  onChange={toggleAllOnPage}
                  aria-label="Select all on this page"
                  className="h-4 w-4 rounded border-gray-300 text-primary"
                />
              </th>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Author</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Added</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && books.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No books found in this date range.
                </td>
              </tr>
            )}
            {books.map((book) => (
              <tr key={book.id} className={selected.has(book.id) ? "bg-primary/5" : undefined}>
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(book.id)}
                    onChange={() => toggleOne(book.id)}
                    aria-label={`Select ${book.title}`}
                    className="h-4 w-4 rounded border-gray-300 text-primary"
                  />
                </td>
                <td className="max-w-[14rem] truncate px-4 py-3 font-medium text-gray-900" dir="auto">
                  {book.title}
                </td>
                <td className="max-w-[10rem] truncate px-4 py-3 text-gray-600" dir="auto">
                  {book.author?.name ?? "—"}
                </td>
                <td className="px-4 py-3 text-gray-600">{bookTypeLabel(book)}</td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {formatCreatedAt(book.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <TablePagination
        page={page}
        pageSize={pageSize}
        pagination={pagination}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />
    </div>
  );
}
