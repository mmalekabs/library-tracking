import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Columns3, Plus, Search, LayoutGrid, Table2 } from "lucide-react";
import toast from "react-hot-toast";
import { BookCard } from "@/components/books/BookCard";
import { AdminBooksTable } from "@/components/admin/AdminBooksTable";
import { TablePagination } from "@/components/admin/TablePagination";
import {
  DEFAULT_PAGE_SIZE,
  type PageSize,
} from "@/constants/pagination";
import {
  fetchAdminBooks,
  toggleBookVisibility,
  deleteBook,
  type BookSortBy,
} from "@/lib/books";
import { MoveToLibraryModal } from "@/components/admin/MoveToLibraryModal";
import { BookTableColumnsModal } from "@/components/admin/BookTableColumnsModal";
import {
  getBookTableColumnsForOrder,
  loadBookTableColumnOrder,
  saveBookTableColumnOrder,
} from "@/components/admin/bookTableColumns";
import { ApiError } from "@/lib/api";
import type { Book } from "@/types";

type Collection = "library" | "to_purchase";
type ViewMode = "table" | "grid";

interface AdminBooksListProps {
  collection: Collection;
}

const config: Record<
  Collection,
  {
    title: string;
    description: string;
    addPath: string;
    editPath: (id: string) => string;
    emptyMessage: string;
  }
> = {
  library: {
    title: "Books",
    description: "Books in your library (owned or planned to read).",
    addPath: "/admin/books/new",
    editPath: (id) => `/admin/books/${id}/edit`,
    emptyMessage: "No books in your library yet.",
  },
  to_purchase: {
    title: "To Purchase",
    description:
      "Books you want to buy. Use Show/Hide to control the public wishlist at /to-purchase.",
    addPath: "/admin/to-purchase/new",
    editPath: (id) => `/admin/to-purchase/${id}/edit`,
    emptyMessage: "No books on your purchase list yet.",
  },
};

export function AdminBooksList({ collection }: AdminBooksListProps) {
  const cfg = config[collection];
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [visibility, setVisibility] = useState<"all" | "public" | "hidden">("all");
  const [moveToLibraryBook, setMoveToLibraryBook] = useState<Book | null>(null);
  const [sortBy, setSortBy] = useState<BookSortBy>("dateAdded");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [columnOrder, setColumnOrder] = useState(loadBookTableColumnOrder);
  const [columnsModalOpen, setColumnsModalOpen] = useState(false);

  const tableColumns = useMemo(
    () => getBookTableColumnsForOrder(columnOrder),
    [columnOrder],
  );

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
    window.clearTimeout((window as unknown as { _searchTimer?: number })._searchTimer);
    (window as unknown as { _searchTimer?: number })._searchTimer = window.setTimeout(
      () => setDebouncedSearch(value),
      300,
    );
  };

  const { data, isLoading } = useQuery({
    queryKey: [
      "books",
      "admin",
      collection,
      page,
      pageSize,
      debouncedSearch,
      visibility,
      sortBy,
      sortOrder,
    ],
    queryFn: () =>
      fetchAdminBooks({
        page,
        limit: pageSize,
        search: debouncedSearch || undefined,
        visibility,
        collection,
        sortBy,
        sortOrder,
      }),
  });

  const handleSort = (field: BookSortBy) => {
    setPage(1);
    if (sortBy === field) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder(field === "title" || field === "author" ? "asc" : "desc");
    }
  };

  const visibilityMutation = useMutation({
    mutationFn: ({ id, visible }: { id: string; visible: boolean }) =>
      toggleBookVisibility(id, visible),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["books"] });
      toast.success("Visibility updated");
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Update failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteBook,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["books"] });
      toast.success("Book deleted");
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Delete failed"),
  });

  const handleDelete = (book: Book) => {
    if (confirm(`Delete "${book.title}"?`)) {
      deleteMutation.mutate(book.id);
    }
  };

  const books = data?.data ?? [];
  const pagination = data?.pagination;

  const handlePageSizeChange = (size: PageSize) => {
    setPageSize(size);
    setPage(1);
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{cfg.title}</h2>
          <p className="mt-1 text-sm text-gray-600">{cfg.description}</p>
        </div>
        <Link
          to={cfg.addPath}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" aria-hidden />
          {collection === "to_purchase" ? "Add to list" : "Add book"}
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="relative min-w-[200px] flex-1 max-w-md">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            aria-hidden
          />
          <input
            type="search"
            placeholder="Search…"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <select
          value={visibility}
          onChange={(e) => {
            setVisibility(e.target.value as typeof visibility);
            setPage(1);
          }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="all">All visibility</option>
          <option value="public">Public only</option>
          <option value="hidden">Hidden only</option>
        </select>
        {viewMode === "table" && (
          <button
            type="button"
            onClick={() => setColumnsModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Columns3 className="h-4 w-4" aria-hidden />
            Columns
          </button>
        )}
        <div
          className="flex rounded-lg border border-gray-300 p-0.5"
          role="group"
          aria-label="View mode"
        >
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ${
              viewMode === "table"
                ? "bg-primary text-white"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Table2 className="h-4 w-4" aria-hidden />
            Table
          </button>
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ${
              viewMode === "grid"
                ? "bg-primary text-white"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <LayoutGrid className="h-4 w-4" aria-hidden />
            Grid
          </button>
        </div>
      </div>

      {isLoading && <p className="text-gray-500">Loading…</p>}

      {!isLoading && books.length === 0 && (
        <p className="text-gray-500">{cfg.emptyMessage}</p>
      )}

      {!isLoading && books.length > 0 && viewMode === "table" && (
        <AdminBooksTable
          books={books}
          columns={tableColumns}
          collection={collection}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={handleSort}
          editPath={cfg.editPath}
          onDelete={handleDelete}
          onMoveToLibrary={
            collection === "to_purchase"
              ? (book) => setMoveToLibraryBook(book)
              : undefined
          }
        />
      )}

      {!isLoading && books.length > 0 && viewMode === "grid" && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {books.map((book) => (
            <div key={book.id} className="relative">
              {collection === "to_purchase" && (
                <span className="absolute right-2 top-2 z-10 rounded-full bg-amber-500 px-2 py-0.5 text-xs font-medium text-white">
                  To purchase
                </span>
              )}
              <BookCard
                book={book}
                admin
                detailPath={cfg.editPath(book.id)}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    visibilityMutation.mutate({
                      id: book.id,
                      visible: !book.isPubliclyVisible,
                    })
                  }
                  className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
                >
                  {book.isPubliclyVisible
                    ? collection === "to_purchase"
                      ? "Hide from public"
                      : "Hide"
                    : collection === "to_purchase"
                      ? "Show on public wishlist"
                      : "Show"}
                </button>
                {collection === "to_purchase" && (
                  <button
                    type="button"
                    onClick={() => setMoveToLibraryBook(book)}
                    className="inline-flex flex-1 items-center justify-center gap-1 rounded border border-primary px-2 py-1 text-xs font-medium text-primary hover:bg-primary/5"
                  >
                    Add to library
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(book)}
                  className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && books.length > 0 && (
        <TablePagination
          page={page}
          pageSize={pageSize}
          pagination={pagination}
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
        />
      )}

      <BookTableColumnsModal
        open={columnsModalOpen}
        columnOrder={columnOrder}
        onClose={() => setColumnsModalOpen(false)}
        onSave={(order) => {
          setColumnOrder(order);
          saveBookTableColumnOrder(order);
          setColumnsModalOpen(false);
          toast.success("Column order updated");
        }}
      />

      <MoveToLibraryModal
        book={moveToLibraryBook}
        open={moveToLibraryBook !== null}
        onClose={() => setMoveToLibraryBook(null)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["books"] });
        }}
      />
    </div>
  );
}
