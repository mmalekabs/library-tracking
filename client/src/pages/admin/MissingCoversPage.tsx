import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, ImageDown, Search, ExternalLink } from "lucide-react";
import toast from "react-hot-toast";
import {
  fetchBooksMissingCovers,
  fetchMissingCoversSummary,
  hasGoodreadsBookId,
  updateBook,
  type MissingCoversCollection,
  type MissingCoversSummary,
  type PaginatedBooks,
} from "@/lib/books";
import { fetchGoodreadsCover as fetchCoverById } from "@/lib/goodreads";
import { ApiError } from "@/lib/api";
import type { Book } from "@/types";
import { TablePagination } from "@/components/admin/TablePagination";
import { DEFAULT_PAGE_SIZE, type PageSize } from "@/constants/pagination";
import { formatElapsed } from "@/utils/formatElapsed";

const BULK_FETCH_DELAY_MS = 800;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type BulkJob = {
  active: boolean;
  startedAt: number;
  total: number;
  updated: number;
  failed: number;
  currentTitle?: string;
};

export function MissingCoversPage() {
  const queryClient = useQueryClient();
  const [collection, setCollection] = useState<MissingCoversCollection>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [filterFetchable, setFilterFetchable] = useState(false);
  const [fetchingId, setFetchingId] = useState<string | null>(null);
  const [bulkJob, setBulkJob] = useState<BulkJob | null>(null);
  const [clockMs, setClockMs] = useState(0);

  const listQueryKey = [
    "books",
    "missing-covers",
    collection,
    page,
    pageSize,
    debouncedSearch,
    filterFetchable,
  ] as const;

  const summaryQueryKey = [
    "books",
    "missing-covers",
    "summary",
    collection,
  ] as const;

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
    window.clearTimeout((window as unknown as { _searchTimer?: number })._searchTimer);
    (window as unknown as { _searchTimer?: number })._searchTimer = window.setTimeout(
      () => setDebouncedSearch(value),
      300,
    );
  };

  const { data: summary } = useQuery({
    queryKey: summaryQueryKey,
    queryFn: () => fetchMissingCoversSummary(collection),
  });

  const { data, isLoading } = useQuery({
    queryKey: listQueryKey,
    queryFn: () =>
      fetchBooksMissingCovers({
        page,
        limit: pageSize,
        search: debouncedSearch || undefined,
        collection,
        withGoodreadsIdOnly: filterFetchable,
      }),
  });

  const applyCoverFetched = useCallback(
    (book: Book) => {
      const canFetch = hasGoodreadsBookId(book.externalId);

      queryClient.setQueryData<MissingCoversSummary>(
        summaryQueryKey,
        (old) => {
          if (!old) return old;
          return {
            totalMissing: Math.max(0, old.totalMissing - 1),
            withGoodreadsId: canFetch
              ? Math.max(0, old.withGoodreadsId - 1)
              : old.withGoodreadsId,
            withoutGoodreadsId: canFetch
              ? old.withoutGoodreadsId
              : Math.max(0, old.withoutGoodreadsId - 1),
          };
        },
      );

      queryClient.setQueryData<PaginatedBooks>(listQueryKey, (old) => {
        if (!old) return old;
        const nextData = old.data.filter((b) => b.id !== book.id);
        if (nextData.length === old.data.length) return old;
        return {
          ...old,
          data: nextData,
          pagination: {
            ...old.pagination,
            totalItems: Math.max(0, old.pagination.totalItems - 1),
            totalPages: Math.max(
              1,
              Math.ceil(
                Math.max(0, old.pagination.totalItems - 1) / old.pagination.limit,
              ),
            ),
          },
        };
      });
    },
    [queryClient, listQueryKey, summaryQueryKey],
  );

  const fetchCoverForBook = useCallback(
    async (book: Book): Promise<boolean> => {
      const bookId = book.externalId?.trim();
      if (!hasGoodreadsBookId(bookId)) {
        return false;
      }
      const { coverUrl } = await fetchCoverById(bookId!);
      await updateBook(book.id, { coverImageUrl: coverUrl });
      applyCoverFetched(book);
      return true;
    },
    [applyCoverFetched],
  );

  useEffect(() => {
    if (!bulkJob?.active) {
      setClockMs(0);
      return;
    }
    const tick = () => setClockMs(Date.now() - bulkJob.startedAt);
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [bulkJob?.active, bulkJob?.startedAt]);

  const bulkMutation = useMutation({
    mutationFn: async () => {
      const startedAt = Date.now();
      const allBooks: Book[] = [];
      let fetchPage = 1;
      let totalPages = 1;

      while (fetchPage <= totalPages) {
        const res = await fetchBooksMissingCovers({
          collection,
          withGoodreadsIdOnly: true,
          page: fetchPage,
          limit: 100,
        });
        allBooks.push(...res.data);
        totalPages = res.pagination.totalPages;
        fetchPage += 1;
      }

      setBulkJob({
        active: true,
        startedAt,
        total: allBooks.length,
        updated: 0,
        failed: 0,
      });

      let updated = 0;
      let failed = 0;

      for (let i = 0; i < allBooks.length; i++) {
        const book = allBooks[i]!;
        setBulkJob((prev) =>
          prev
            ? { ...prev, currentTitle: book.title, updated, failed }
            : prev,
        );

        try {
          const ok = await fetchCoverForBook(book);
          if (ok) {
            updated += 1;
          } else {
            failed += 1;
          }
        } catch {
          failed += 1;
        }

        setBulkJob((prev) =>
          prev ? { ...prev, updated, failed, currentTitle: book.title } : prev,
        );

        if (i < allBooks.length - 1) {
          await delay(BULK_FETCH_DELAY_MS);
        }
      }

      return { updated, failed, attempted: allBooks.length };
    },
    onSuccess: (report) => {
      toast.success(
        `Updated ${report.updated} cover${report.updated === 1 ? "" : "s"}${
          report.failed ? `, ${report.failed} failed` : ""
        }`,
      );
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Bulk fetch failed"),
    onSettled: () => {
      setBulkJob(null);
      void queryClient.invalidateQueries({ queryKey: ["books", "missing-covers"] });
    },
  });

  const fetchOne = async (book: Book) => {
    if (!hasGoodreadsBookId(book.externalId?.trim())) {
      toast.error("No valid Goodreads Book Id");
      return;
    }
    setFetchingId(book.id);
    try {
      await fetchCoverForBook(book);
      toast.success(`Cover set for “${book.title}”`);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Could not fetch cover",
      );
    } finally {
      setFetchingId(null);
    }
  };

  const books = data?.data ?? [];
  const pagination = data?.pagination;
  const isBulkRunning = bulkMutation.isPending || bulkJob?.active === true;
  const progressUpdated = bulkJob?.updated ?? 0;
  const progressFailed = bulkJob?.failed ?? 0;
  const progressTotal = bulkJob?.total ?? summary?.withGoodreadsId ?? 0;

  const editPath = (book: Book) =>
    book.toPurchase
      ? `/admin/to-purchase/${book.id}/edit`
      : `/admin/books/${book.id}/edit`;

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900">Missing covers</h2>
      <p className="mt-1 text-sm text-gray-600">
        Books without a cover image. Fetch covers from Goodreads when a Book Id
        is set.
      </p>

      {summary && (
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-500">No cover</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {summary.totalMissing}
            </p>
          </div>
          <div className="rounded-xl border border-green-200 bg-green-50/50 p-4">
            <p className="text-sm text-gray-600">Can fetch (Goodreads Id)</p>
            <p className="mt-1 text-2xl font-bold text-green-800">
              {summary.withGoodreadsId}
            </p>
          </div>
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-500">No Goodreads Id</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {summary.withoutGoodreadsId}
            </p>
          </div>
        </div>
      )}

      {isBulkRunning && (
        <div
          className="mt-6 rounded-xl border border-primary/30 bg-primary/5 p-4"
          role="status"
          aria-live="polite"
        >
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 text-primary">
              <Clock className="h-5 w-5 animate-pulse" aria-hidden />
              <span className="font-mono text-2xl font-bold tabular-nums tracking-tight">
                {formatElapsed(clockMs)}
              </span>
            </div>
            <div className="text-sm text-gray-800">
              <p className="font-semibold">
                Fetched{" "}
                <span className="text-green-700">{progressUpdated}</span>
                {progressTotal > 0 && (
                  <>
                    {" "}
                    of <span className="tabular-nums">{progressTotal}</span>
                  </>
                )}
                {progressFailed > 0 && (
                  <span className="text-amber-700">
                    {" "}
                    · {progressFailed} failed
                  </span>
                )}
              </p>
              {bulkJob?.currentTitle && (
                <p className="mt-1 truncate text-gray-600" dir="auto">
                  {bulkJob.currentTitle}
                </p>
              )}
            </div>
          </div>
          {progressTotal > 0 && (
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{
                  width: `${Math.min(100, ((progressUpdated + progressFailed) / progressTotal) * 100)}%`,
                }}
              />
            </div>
          )}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={
            isBulkRunning || !summary || summary.withGoodreadsId === 0
          }
          onClick={() => bulkMutation.mutate()}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
        >
          <ImageDown className="h-4 w-4" aria-hidden />
          {isBulkRunning
            ? "Fetching covers…"
            : `Fetch all with Goodreads Id (${summary?.withGoodreadsId ?? 0})`}
        </button>
        <p className="text-xs text-gray-500">
          ~0.8s delay between each book to avoid overloading Goodreads.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-4">
        <select
          value={collection}
          onChange={(e) => {
            setCollection(e.target.value as MissingCoversCollection);
            setPage(1);
          }}
          disabled={isBulkRunning}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-50"
        >
          <option value="all">All collections</option>
          <option value="library">Library only</option>
          <option value="to_purchase">To purchase only</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={filterFetchable}
            disabled={isBulkRunning}
            onChange={(e) => {
              setFilterFetchable(e.target.checked);
              setPage(1);
            }}
          />
          Only with Goodreads Book Id
        </label>
        <div className="relative min-w-[200px] flex-1 max-w-md">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            aria-hidden
          />
          <input
            type="search"
            placeholder="Search title, author, Book Id…"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            disabled={isBulkRunning}
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm disabled:opacity-50"
          />
        </div>
      </div>

      {isLoading && <p className="mt-6 text-gray-500">Loading…</p>}

      {!isLoading && books.length === 0 && (
        <p className="mt-6 text-gray-500">
          No books missing covers
          {filterFetchable ? " with a Goodreads Book Id" : ""}.
        </p>
      )}

      {books.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 font-semibold text-gray-600">Title</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Author</th>
                <th className="px-4 py-3 font-semibold text-gray-600">
                  Goodreads Id
                </th>
                <th className="px-4 py-3 font-semibold text-gray-600">List</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {books.map((book) => {
                const canFetch = hasGoodreadsBookId(book.externalId);
                return (
                  <tr key={book.id}>
                    <td className="px-4 py-3 font-medium" dir="auto">
                      {book.title}
                    </td>
                    <td className="px-4 py-3 text-gray-600" dir="auto">
                      {book.author?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {book.externalId ? (
                        canFetch ? (
                          <a
                            href={`https://www.goodreads.com/book/show/${book.externalId}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary hover:underline"
                          >
                            {book.externalId}
                          </a>
                        ) : (
                          <span className="text-amber-700" title="Not numeric">
                            {book.externalId}
                          </span>
                        )
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {book.toPurchase ? "To purchase" : "Library"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={
                            !canFetch ||
                            fetchingId === book.id ||
                            isBulkRunning
                          }
                          onClick={() => void fetchOne(book)}
                          className="inline-flex items-center gap-1 rounded border border-primary/40 bg-primary/5 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
                        >
                          <ImageDown className="h-3.5 w-3.5" aria-hidden />
                          {fetchingId === book.id ? "…" : "Fetch"}
                        </button>
                        <Link
                          to={editPath(book)}
                          className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
                        >
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                          Edit
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {books.length > 0 && pagination && (
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
      )}
    </div>
  );
}
