import { Link, useParams, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BookForm } from "@/components/admin/BookForm";
import { fetchAdminBook } from "@/lib/books";

export function BookFormPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const isToPurchase = location.pathname.includes("/to-purchase");
  const isEdit = Boolean(id);

  const backPath = isToPurchase ? "/admin/to-purchase" : "/admin/books";

  const { data: book, isLoading, isError } = useQuery({
    queryKey: ["books", "admin", id],
    queryFn: () => fetchAdminBook(id!),
    enabled: isEdit,
  });

  return (
    <div>
      <Link to={backPath} className="text-sm text-primary hover:underline">
        ← Back to {isToPurchase ? "to purchase" : "books"}
      </Link>
      <h2 className="mt-4 text-2xl font-bold text-gray-900">
        {isEdit
          ? "Edit book"
          : isToPurchase
            ? "Add book to purchase list"
            : "Add book"}
      </h2>

      {isEdit && isLoading && (
        <p className="mt-8 text-gray-500">Loading book…</p>
      )}
      {isEdit && isError && (
        <p className="mt-8 text-red-600">Could not load book.</p>
      )}
      {(!isEdit || book) && (
        <div className="mt-6">
          <BookForm
            book={book}
            mode={isEdit ? "edit" : "create"}
            defaultToPurchase={isToPurchase}
            backPath={backPath}
          />
        </div>
      )}
    </div>
  );
}
