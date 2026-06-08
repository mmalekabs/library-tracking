import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { fetchAdminBooks } from "@/lib/books";
import { inputClass } from "@/components/admin/FormSection";

interface StartReadingModalProps {
  open: boolean;
  activeBookIds: Set<string>;
  saving?: boolean;
  onClose: () => void;
  onSelect: (bookId: string) => void;
}

export function StartReadingModal({
  open,
  activeBookIds,
  saving,
  onClose,
  onSelect,
}: StartReadingModalProps) {
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["books", "start-reading", search],
    queryFn: () =>
      fetchAdminBooks({
        collection: "library",
        search: search || undefined,
        limit: 20,
        page: 1,
      }),
    enabled: open,
  });

  if (!open) return null;

  const books = (data?.data ?? []).filter((b) => !activeBookIds.has(b.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-xl">
        <div className="border-b border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900">Start reading</h3>
          <p className="mt-1 text-sm text-gray-600">
            Pick a book from your library to begin a new read-through.
          </p>
          <div className="relative mt-4">
            <Search
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              aria-hidden
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search books…"
              className={`${inputClass} pl-9`}
              autoFocus
            />
          </div>
        </div>
        <ul className="flex-1 overflow-y-auto p-2">
          {isLoading && (
            <li className="p-4 text-sm text-gray-500">Loading…</li>
          )}
          {!isLoading && books.length === 0 && (
            <li className="p-4 text-sm text-gray-500">No books found.</li>
          )}
          {books.map((book) => (
            <li key={book.id}>
              <button
                type="button"
                disabled={saving}
                onClick={() => onSelect(book.id)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-gray-50 disabled:opacity-50"
              >
                {book.coverImageUrl ? (
                  <img
                    src={book.coverImageUrl}
                    alt=""
                    className="h-12 w-8 shrink-0 rounded object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-8 shrink-0 items-center justify-center rounded bg-gray-100 text-xs text-gray-400">
                    —
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900" dir="auto">
                    {book.title}
                  </p>
                  <p className="truncate text-xs text-gray-500" dir="auto">
                    {book.author?.name ?? "Unknown author"}
                    {book.numberOfPages ? ` · ${book.numberOfPages} pp` : ""}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
        <div className="border-t border-gray-200 p-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
