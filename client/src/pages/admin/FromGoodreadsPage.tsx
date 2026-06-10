import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BookPlus, Download, ExternalLink } from "lucide-react";
import toast from "react-hot-toast";
import { ApiError } from "@/lib/api";
import { createBook } from "@/lib/books";
import {
  fetchGoodreadsBook,
  type GoodreadsBookData,
} from "@/lib/goodreads";
import { FORMAT_OPTIONS, BINDING_OPTIONS } from "@/constants/book";
import { inputClass } from "@/components/admin/FormSection";

function fieldLabel(label: string, value: string | number | null | undefined) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-gray-900" dir="auto">
        {value ?? "—"}
      </dd>
    </div>
  );
}

export function FromGoodreadsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [preview, setPreview] = useState<GoodreadsBookData | null>(null);
  const [toPurchase, setToPurchase] = useState(false);

  const fetchMutation = useMutation({
    mutationFn: fetchGoodreadsBook,
    onSuccess: (data) => {
      setPreview(data);
      if (data.existingBook) {
        toast.error("This Goodreads book is already in your library");
      } else {
        toast.success("Book data fetched from Goodreads");
      }
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Fetch failed"),
  });

  const createMutation = useMutation({
    mutationFn: createBook,
    onSuccess: (book) => {
      queryClient.invalidateQueries({ queryKey: ["books"] });
      toast.success(toPurchase ? "Added to purchase list" : "Book added");
      navigate(
        toPurchase
          ? `/admin/to-purchase/${book.id}/edit`
          : `/admin/books/${book.id}/edit`,
      );
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Could not add book"),
  });

  const handleFetch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) {
      toast.error("Enter a Goodreads Book Id or URL");
      return;
    }
    fetchMutation.mutate(input.trim());
  };

  const handleAdd = () => {
    if (!preview) return;
    if (preview.existingBook) {
      toast.error("Book already exists — open it from the link below");
      return;
    }
    if (!preview.authorName && !toPurchase) {
      toast.error("Author is required for library books");
      return;
    }

    createMutation.mutate({
      title: preview.title,
      externalId: preview.goodreadsBookId,
      authorName: preview.authorName ?? undefined,
      additionalAuthorNames: preview.additionalAuthorNames,
      publisherName: preview.publisherName ?? undefined,
      isbn: preview.isbn,
      isbn13: preview.isbn13,
      numberOfPages: preview.numberOfPages,
      yearPublished: preview.yearPublished,
      originalPublicationYear: preview.originalPublicationYear,
      coverImageUrl: preview.coverImageUrl,
      format: preview.format,
      binding: preview.binding,
      toPurchase,
      isPubliclyVisible: !toPurchase,
      currency: "SAR",
    });
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Add from Goodreads</h2>
        <p className="mt-1 text-sm text-gray-600">
          Enter a Goodreads Book Id (from CSV export) or paste a book page URL.
          We fetch title, author, cover, ISBN, pages, and more — then add it to
          your library or purchase list.
        </p>
      </div>

      <form
        onSubmit={handleFetch}
        className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        <label className="block text-sm font-medium text-gray-700">
          Goodreads Book Id or URL
        </label>
        <div className="mt-2 flex flex-wrap gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. 2767052 or https://www.goodreads.com/book/show/2767052-…"
            className={`${inputClass} min-w-[16rem] flex-1`}
            autoFocus
          />
          <button
            type="submit"
            disabled={fetchMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
          >
            <Download className="h-4 w-4" aria-hidden />
            {fetchMutation.isPending ? "Fetching…" : "Fetch book"}
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Uses the same Book Id as your Goodreads CSV export and the Missing
          covers page.
        </p>
      </form>

      {preview && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          {preview.existingBook && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Already tracked:{" "}
              <Link
                to={`/admin/books/${preview.existingBook.id}/edit`}
                className="font-medium underline hover:text-amber-700"
              >
                {preview.existingBook.title}
              </Link>
            </div>
          )}

          <div className="flex flex-wrap gap-6">
            {preview.coverImageUrl ? (
              <img
                src={preview.coverImageUrl}
                alt=""
                className="h-48 w-32 shrink-0 rounded-lg object-cover shadow"
              />
            ) : (
              <div className="flex h-48 w-32 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xs text-gray-400">
                No cover
              </div>
            )}

            <div className="min-w-0 flex-1">
              <h3 className="text-xl font-semibold text-gray-900" dir="auto">
                {preview.title}
              </h3>
              <p className="mt-1 text-sm text-gray-600" dir="auto">
                {preview.authorName ?? "Unknown author"}
                {preview.additionalAuthorNames.length > 0 &&
                  ` · ${preview.additionalAuthorNames.join(", ")}`}
              </p>
              <a
                href={preview.goodreadsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                View on Goodreads
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>

              <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {fieldLabel("Goodreads Id", preview.goodreadsBookId)}
                {fieldLabel("Pages", preview.numberOfPages)}
                {fieldLabel("Year", preview.yearPublished)}
                {fieldLabel("ISBN", preview.isbn ?? preview.isbn13)}
                {fieldLabel("Publisher", preview.publisherName)}
                {fieldLabel(
                  "Format",
                  FORMAT_OPTIONS.find((f) => f.value === preview.format)?.label,
                )}
                {fieldLabel(
                  "Binding",
                  BINDING_OPTIONS.find((b) => b.value === preview.binding)
                    ?.label,
                )}
                {fieldLabel("Language", preview.language)}
                {fieldLabel("Edition format", preview.bookFormatLabel)}
              </dl>

              {preview.description && (
                <p className="mt-4 line-clamp-4 text-sm text-gray-500 italic">
                  Description from Goodreads is shown here for preview only — it
                  will not be saved to notes.
                </p>
              )}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-gray-100 pt-6">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={toPurchase}
                onChange={(e) => setToPurchase(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              Add to purchase list (wishlist) instead of library
            </label>

            <button
              type="button"
              onClick={handleAdd}
              disabled={
                createMutation.isPending ||
                !!preview.existingBook ||
                (!preview.authorName && !toPurchase)
              }
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              <BookPlus className="h-4 w-4" aria-hidden />
              {createMutation.isPending
                ? "Adding…"
                : toPurchase
                  ? "Add to purchase list"
                  : "Add to library"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
