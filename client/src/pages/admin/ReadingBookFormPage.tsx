import { Link, useLocation, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ReadingBookForm } from "@/components/reading/ReadingBookForm";
import { fetchReadingOnlyBook } from "@/lib/reading";
import type { ReadingBookDraft } from "@/lib/goodreadsDraft";

export function ReadingBookFormPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const isEdit = Boolean(id);
  const initialDraft = (location.state as { draft?: ReadingBookDraft } | null)
    ?.draft;

  const { data: book, isLoading, isError } = useQuery({
    queryKey: ["reading", "book", id],
    queryFn: () => fetchReadingOnlyBook(id!),
    enabled: isEdit,
  });

  return (
    <div>
      <Link to="/admin/reading" className="text-sm text-primary hover:underline">
        ← Back to reading tracker
      </Link>
      <h2 className="mt-4 text-2xl font-bold text-gray-900">
        {isEdit ? "Edit reading book" : "Add book to read"}
      </h2>
      <p className="mt-1 text-sm text-gray-600">
        This book is tracked for reading only and will not appear in your library
        catalog.
      </p>

      {isEdit && isLoading && (
        <p className="mt-8 text-gray-500">Loading book…</p>
      )}
      {isEdit && isError && (
        <p className="mt-8 text-red-600">Could not load book.</p>
      )}
      {(!isEdit || book) && (
        <div className="mt-6">
          <ReadingBookForm
            book={book}
            mode={isEdit ? "edit" : "create"}
            initialDraft={initialDraft}
          />
        </div>
      )}
    </div>
  );
}
