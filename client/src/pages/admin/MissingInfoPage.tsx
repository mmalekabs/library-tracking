import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Clock,
  ImageDown,
  Search,
  ExternalLink,
  Barcode,
  CircleDollarSign,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  bulkFetchGoodreadsCovers,
  bulkFetchIsbn13FromGoodreads,
  bulkFetchMarketPriceFromAseeralkotb,
  fetchBooksMissingInfo,
  fetchMissingInfoSummary,
  hasGoodreadsBookId,
  isValidIsbn13,
  needsIsbn13,
  updateBook,
  type MissingInfoCollection,
  type PaginatedBooks,
} from "@/lib/books";
import { fetchAseeralkotbPrice } from "@/lib/aseeralkotb";
import { fetchGoodreadsBook, fetchGoodreadsCover as fetchCoverById } from "@/lib/goodreads";
import { ApiError } from "@/lib/api";
import type { Book } from "@/types";
import { TablePagination } from "@/components/admin/TablePagination";
import { DEFAULT_PAGE_SIZE, type PageSize } from "@/constants/pagination";
import { formatElapsed } from "@/utils/formatElapsed";

type BulkKind = "cover" | "isbn" | "price";

type BulkJob = {
  active: boolean;
  kind: BulkKind;
  startedAt: number;
  total: number;
  current: number;
  updated: number;
  failed: number;
  currentTitle?: string;
};

function bookStillMissingInfo(book: Book): boolean {
  return (
    !book.coverImageUrl?.trim() ||
    needsIsbn13(book.isbn13) ||
    book.marketPrice == null
  );
}

function missingLabels(book: Book): string[] {
  const labels: string[] = [];
  if (!book.coverImageUrl?.trim()) labels.push("Cover");
  if (needsIsbn13(book.isbn13)) labels.push("ISBN-13");
  if (book.marketPrice == null) labels.push("Price");
  return labels;
}

export function MissingInfoPage() {
  const queryClient = useQueryClient();
  const [collection, setCollection] = useState<MissingInfoCollection>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [filterFetchable, setFilterFetchable] = useState(false);
  const [fetchingId, setFetchingId] = useState<string | null>(null);
  const [fetchingAction, setFetchingAction] = useState<BulkKind | null>(null);
  const [bulkJob, setBulkJob] = useState<BulkJob | null>(null);
  const [clockMs, setClockMs] = useState(0);

  const listQueryKey = [
    "books",
    "missing-info",
    collection,
    page,
    pageSize,
    debouncedSearch,
    filterFetchable,
  ] as const;

  const summaryQueryKey = [
    "books",
    "missing-info",
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
    queryFn: () => fetchMissingInfoSummary(collection),
  });

  const { data, isLoading } = useQuery({
    queryKey: listQueryKey,
    queryFn: () =>
      fetchBooksMissingInfo({
        page,
        limit: pageSize,
        search: debouncedSearch || undefined,
        collection,
        withGoodreadsIdOnly: filterFetchable,
      }),
  });

  const applyBookUpdated = useCallback(
    (book: Book) => {
      if (bookStillMissingInfo(book)) {
        queryClient.setQueryData<PaginatedBooks>(listQueryKey, (old) => {
          if (!old) return old;
          return {
            ...old,
            data: old.data.map((b) => (b.id === book.id ? book : b)),
          };
        });
      } else {
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
      }

      void queryClient.invalidateQueries({ queryKey: summaryQueryKey });
    },
    [queryClient, listQueryKey, summaryQueryKey],
  );

  const fetchCoverForBook = useCallback(
    async (book: Book): Promise<Book> => {
      const bookId = book.externalId?.trim();
      if (!hasGoodreadsBookId(bookId)) {
        throw new ApiError("VALIDATION_ERROR", "No valid Goodreads Book Id", 400);
      }
      const { coverUrl } = await fetchCoverById(bookId!);
      return updateBook(book.id, { coverImageUrl: coverUrl });
    },
    [],
  );

  const fetchIsbnForBook = useCallback(async (book: Book): Promise<Book> => {
    const bookId = book.externalId?.trim();
    if (!hasGoodreadsBookId(bookId)) {
      throw new ApiError("VALIDATION_ERROR", "No valid Goodreads Book Id", 400);
    }
    const data = await fetchGoodreadsBook(bookId!);
    if (!data.isbn13) {
      throw new ApiError("ISBN_NOT_FOUND", "Goodreads did not return an ISBN-13", 404);
    }
    return updateBook(book.id, { isbn13: data.isbn13 });
  }, []);

  const fetchPriceForBook = useCallback(async (book: Book): Promise<Book> => {
    const isbn13 = book.isbn13?.trim();
    if (!isValidIsbn13(isbn13)) {
      throw new ApiError(
        "VALIDATION_ERROR",
        "A valid 13-digit ISBN-13 is required to look up price",
        400,
      );
    }
    const price = await fetchAseeralkotbPrice(isbn13!, book.title);
    return updateBook(book.id, { marketPrice: price.marketPrice });
  }, []);

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

  const applyBulkProgress = useCallback((kind: BulkKind, progress: {
    current: number;
    total: number;
    updated: number;
    failed: number;
    currentTitle: string | null;
  }) => {
    setBulkJob((prev) => {
      const startedAt = prev?.startedAt ?? Date.now();
      return {
        active: true,
        kind,
        startedAt,
        total: progress.total,
        current: progress.current,
        updated: progress.updated,
        failed: progress.failed,
        currentTitle: progress.currentTitle ?? undefined,
      };
    });
  }, []);

  const bulkCoverMutation = useMutation({
    mutationFn: async () => {
      setBulkJob({
        active: true,
        kind: "cover",
        startedAt: Date.now(),
        total: 0,
        current: 0,
        updated: 0,
        failed: 0,
      });
      return bulkFetchGoodreadsCovers(
        { collection, onlyWithGoodreadsId: true },
        { onProgress: (p) => applyBulkProgress("cover", p) },
      );
    },
    onSuccess: (report) => {
      toast.success(
        `Updated ${report.updated} cover${report.updated === 1 ? "" : "s"}${
          report.failed.length ? `, ${report.failed.length} failed` : ""
        }`,
      );
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Bulk fetch failed"),
    onSettled: () => {
      setBulkJob(null);
      void queryClient.invalidateQueries({ queryKey: ["books", "missing-info"] });
    },
  });

  const bulkIsbnMutation = useMutation({
    mutationFn: async () => {
      setBulkJob({
        active: true,
        kind: "isbn",
        startedAt: Date.now(),
        total: 0,
        current: 0,
        updated: 0,
        failed: 0,
      });
      return bulkFetchIsbn13FromGoodreads(
        { collection, onlyWithGoodreadsId: true },
        { onProgress: (p) => applyBulkProgress("isbn", p) },
      );
    },
    onSuccess: (report) => {
      toast.success(
        `Updated ${report.updated} ISBN${report.updated === 1 ? "" : "s"}${
          report.failed.length ? `, ${report.failed.length} failed` : ""
        }`,
      );
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Bulk ISBN fetch failed"),
    onSettled: () => {
      setBulkJob(null);
      void queryClient.invalidateQueries({ queryKey: ["books", "missing-info"] });
    },
  });

  const bulkPriceMutation = useMutation({
    mutationFn: async () => {
      setBulkJob({
        active: true,
        kind: "price",
        startedAt: Date.now(),
        total: 0,
        current: 0,
        updated: 0,
        failed: 0,
      });
      return bulkFetchMarketPriceFromAseeralkotb(
        { collection, onlyWithIsbn13: true },
        { onProgress: (p) => applyBulkProgress("price", p) },
      );
    },
    onSuccess: (report) => {
      toast.success(
        `Updated ${report.updated} price${report.updated === 1 ? "" : "s"}${
          report.failed.length ? `, ${report.failed.length} failed` : ""
        }`,
      );
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Bulk price fetch failed"),
    onSettled: () => {
      setBulkJob(null);
      void queryClient.invalidateQueries({ queryKey: ["books", "missing-info"] });
    },
  });

  const fetchOne = async (book: Book, kind: BulkKind) => {
    setFetchingId(book.id);
    setFetchingAction(kind);
    try {
      let updated: Book;
      if (kind === "cover") updated = await fetchCoverForBook(book);
      else if (kind === "isbn") updated = await fetchIsbnForBook(book);
      else updated = await fetchPriceForBook(book);
      applyBookUpdated(updated);
      const label =
        kind === "cover" ? "Cover" : kind === "isbn" ? "ISBN-13" : "Market price";
      toast.success(`${label} set for “${book.title}”`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not fetch");
    } finally {
      setFetchingId(null);
      setFetchingAction(null);
    }
  };

  const books = data?.data ?? [];
  const pagination = data?.pagination;
  const isBulkRunning =
    bulkCoverMutation.isPending ||
    bulkIsbnMutation.isPending ||
    bulkPriceMutation.isPending ||
    bulkJob?.active === true;
  const progressUpdated = bulkJob?.updated ?? 0;
  const progressFailed = bulkJob?.failed ?? 0;
  const progressTotal = bulkJob?.total ?? 0;
  const progressCurrent = bulkJob?.current ?? 0;

  const editPath = (book: Book) =>
    book.toPurchase
      ? `/admin/to-purchase/${book.id}/edit`
      : `/admin/books/${book.id}/edit`;

  const bulkLabel =
    bulkJob?.kind === "isbn"
      ? "ISBN-13"
      : bulkJob?.kind === "price"
        ? "prices"
        : "covers";

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900">Missing info</h2>
      <p className="mt-1 text-sm text-gray-600">
        Books missing a cover, ISBN-13, or market price. Fetch from Goodreads
        (cover, ISBN-13) or عصير الكتب (market price with 10% discount).
      </p>

      {summary && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-500">Missing any info</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {summary.totalMissing}
            </p>
          </div>
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-500">No cover</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {summary.missingCover}
            </p>
          </div>
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-500">No ISBN-13</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {summary.missingIsbn13}
            </p>
          </div>
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-500">No market price</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {summary.missingMarketPrice}
            </p>
          </div>
        </div>
      )}

      {isBulkRunning && bulkJob && (
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
                Fetched {bulkLabel}{" "}
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
                  width: `${Math.min(
                    100,
                    progressTotal > 0
                      ? (progressCurrent / progressTotal) * 100
                      : 0,
                  )}%`,
                }}
              />
            </div>
          )}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={isBulkRunning || !summary || summary.missingCover === 0}
          onClick={() => bulkCoverMutation.mutate()}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
        >
          <ImageDown className="h-4 w-4" aria-hidden />
          Fetch covers ({summary?.missingCover ?? 0})
        </button>
        <button
          type="button"
          disabled={
            isBulkRunning || !summary || summary.canFetchFromGoodreads === 0
          }
          onClick={() => bulkIsbnMutation.mutate()}
          className="inline-flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
        >
          <Barcode className="h-4 w-4" aria-hidden />
          Fetch ISBN-13 ({summary?.missingIsbn13 ?? 0})
        </button>
        <button
          type="button"
          disabled={isBulkRunning || !summary || summary.canFetchPrice === 0}
          onClick={() => bulkPriceMutation.mutate()}
          className="inline-flex items-center gap-2 rounded-lg border border-emerald-600/40 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
        >
          <CircleDollarSign className="h-4 w-4" aria-hidden />
          {bulkPriceMutation.isPending
            ? "Fetching prices…"
            : `Fetch prices (${summary?.canFetchPrice ?? 0})`}
        </button>
        <p className="text-xs text-gray-500">
          Bulk runs on the server (~0.8s between books). Market price uses عصير
          الكتب list price minus 10%.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-4">
        <select
          value={collection}
          onChange={(e) => {
            setCollection(e.target.value as MissingInfoCollection);
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
            placeholder="Search title, author, Book Id, ISBN…"
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
          No books missing info
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
                <th className="px-4 py-3 font-semibold text-gray-600">Missing</th>
                <th className="px-4 py-3 font-semibold text-gray-600">
                  Goodreads Id
                </th>
                <th className="px-4 py-3 font-semibold text-gray-600">ISBN-13</th>
                <th className="px-4 py-3 font-semibold text-gray-600">List</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {books.map((book) => {
                const canFetchGoodreads = hasGoodreadsBookId(book.externalId);
                const missing = missingLabels(book);
                const busy = fetchingId === book.id;
                return (
                  <tr key={book.id}>
                    <td className="px-4 py-3 font-medium" dir="auto">
                      {book.title}
                    </td>
                    <td className="px-4 py-3 text-gray-600" dir="auto">
                      {book.author?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {missing.map((label) => (
                          <span
                            key={label}
                            className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900"
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {book.externalId ? (
                        canFetchGoodreads ? (
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
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">
                      {book.isbn13 ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {book.toPurchase ? "To purchase" : "Library"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {!book.coverImageUrl?.trim() && (
                          <button
                            type="button"
                            disabled={
                              !canFetchGoodreads || busy || isBulkRunning
                            }
                            onClick={() => void fetchOne(book, "cover")}
                            className="inline-flex items-center gap-1 rounded border border-primary/40 bg-primary/5 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
                          >
                            <ImageDown className="h-3.5 w-3.5" aria-hidden />
                            {busy && fetchingAction === "cover" ? "…" : "Cover"}
                          </button>
                        )}
                        {needsIsbn13(book.isbn13) && (
                          <button
                            type="button"
                            disabled={
                              !canFetchGoodreads || busy || isBulkRunning
                            }
                            onClick={() => void fetchOne(book, "isbn")}
                            className="inline-flex items-center gap-1 rounded border border-primary/40 bg-primary/5 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
                          >
                            <Barcode className="h-3.5 w-3.5" aria-hidden />
                            {busy && fetchingAction === "isbn" ? "…" : "ISBN"}
                          </button>
                        )}
                        {book.marketPrice == null && (
                          <button
                            type="button"
                            disabled={
                              !isValidIsbn13(book.isbn13) || busy || isBulkRunning
                            }
                            onClick={() => void fetchOne(book, "price")}
                            className="inline-flex items-center gap-1 rounded border border-emerald-600/40 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                          >
                            <CircleDollarSign className="h-3.5 w-3.5" aria-hidden />
                            {busy && fetchingAction === "price" ? "…" : "Price"}
                          </button>
                        )}
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
