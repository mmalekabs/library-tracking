import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { BookPlus, Search } from "lucide-react";
import { fetchReadableBooks } from "@/lib/reading";
import { inputClass } from "@/components/admin/FormSection";
import { AddReadingBookModal } from "./AddReadingBookModal";
import type { CreateReadingOnlyBookInput } from "@/lib/reading";

interface StartReadingModalProps {
  open: boolean;
  activeBookIds: Set<string>;
  saving?: boolean;
  addingExternal?: boolean;
  onClose: () => void;
  onSelect: (bookId: string) => void;
  onAddExternal: (input: CreateReadingOnlyBookInput) => void;
}

export function StartReadingModal({
  open,
  activeBookIds,
  saving,
  addingExternal,
  onClose,
  onSelect,
  onAddExternal,
}: StartReadingModalProps) {
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setAddOpen(false);
    }
  }, [open]);

  const { data: books = [], isLoading } = useQuery({
    queryKey: ["reading", "readable-books", search],
    queryFn: () =>
      fetchReadableBooks({
        search: search || undefined,
        limit: 30,
      }),
    enabled: open,
  });

  if (!open) return null;

  const available = books.filter((b) => !activeBookIds.has(b.id));

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-xl">
          <div className="border-b border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900">Start reading</h3>
            <p className="mt-1 text-sm text-gray-600">
              Pick from your library or books tracked outside your collection.
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
            <div className="mt-3 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:border-primary hover:text-primary"
              >
                <BookPlus className="h-4 w-4" />
                Add book not in library
              </button>
              <Link
                to="/admin/reading/from-goodreads"
                onClick={onClose}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:border-primary hover:text-primary"
              >
                Add from Goodreads
              </Link>
            </div>
          </div>
          <ul className="flex-1 overflow-y-auto p-2">
            {isLoading && (
              <li className="p-4 text-sm text-gray-500">Loading…</li>
            )}
            {!isLoading && available.length === 0 && (
              <li className="p-4 text-sm text-gray-500">
                No books found. Add one that is not in your library.
              </li>
            )}
            {available.map((book) => (
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
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-sm font-medium text-gray-900"
                      dir="auto"
                    >
                      {book.title}
                    </p>
                    <p className="truncate text-xs text-gray-500" dir="auto">
                      {book.author?.name ?? "Unknown author"}
                      {book.numberOfPages ? ` · ${book.numberOfPages} pp` : ""}
                      {book.readingOnly ? " · Not in library" : ""}
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

      <AddReadingBookModal
        open={addOpen}
        saving={addingExternal}
        onClose={() => setAddOpen(false)}
        onSubmit={(input) => {
          onAddExternal(input);
        }}
      />
    </>
  );
}
