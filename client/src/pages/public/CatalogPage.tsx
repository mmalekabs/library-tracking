import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { BookCard } from "@/components/books/BookCard";
import { fetchPublicBooks } from "@/lib/books";

export function CatalogPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
    window.clearTimeout((window as unknown as { _searchTimer?: number })._searchTimer);
    (window as unknown as { _searchTimer?: number })._searchTimer = window.setTimeout(
      () => setDebouncedSearch(value),
      300,
    );
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: ["books", "public", page, debouncedSearch],
    queryFn: () =>
      fetchPublicBooks({
        page,
        limit: 20,
        search: debouncedSearch || undefined,
        sortBy: "createdAt",
        sortOrder: "desc",
      }),
  });

  const books = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">My Library</h1>
        <p className="mt-2 text-gray-600">
          {pagination
            ? `${pagination.totalItems} book${pagination.totalItems === 1 ? "" : "s"} in the catalog`
            : "Browse the public catalog"}
        </p>
      </div>

      <div className="relative mb-8 max-w-xl">
        <Search
          className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
          aria-hidden
        />
        <input
          type="search"
          placeholder="Search by title, author, or ISBN…"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {isLoading && (
        <p className="text-center text-gray-500">Loading books…</p>
      )}

      {isError && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          Could not load books. Make sure the API server is running.
        </p>
      )}

      {!isLoading && !isError && books.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <p className="text-lg font-medium text-gray-700">No books yet</p>
          <p className="mt-2 text-sm text-gray-500">
            Add books from the admin panel to populate the catalog.
          </p>
        </div>
      )}

      {books.length > 0 && (
        <>
          <div className="grid grid-cols-1 items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {books.map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-4">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-600">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                type="button"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
