import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchPublicToPurchaseBook } from "@/lib/books";

export function PublicToPurchaseBookDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: book, isLoading, isError } = useQuery({
    queryKey: ["books", "public", "to-purchase", id],
    queryFn: () => fetchPublicToPurchaseBook(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return <p className="text-gray-500">Loading…</p>;
  }

  if (isError || !book) {
    return (
      <div>
        <Link to="/to-purchase" className="text-sm text-primary hover:underline">
          ← Back to wishlist
        </Link>
        <p className="mt-4 text-red-600">Book not found.</p>
      </div>
    );
  }

  return (
    <div>
      <Link to="/to-purchase" className="text-sm text-primary hover:underline">
        ← Back to wishlist
      </Link>

      <p className="mt-4 inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
        On purchase list
      </p>

      <div className="mt-6 grid gap-8 md:grid-cols-[240px_1fr]">
        <div className="flex aspect-[2/3] items-center justify-center rounded-xl bg-gray-100">
          {book.coverImageUrl ? (
            <img
              src={book.coverImageUrl}
              alt=""
              className="h-full w-full rounded-xl object-cover"
            />
          ) : (
            <p className="p-4 text-center font-semibold text-gray-600" dir="auto">
              {book.title}
            </p>
          )}
        </div>

        <div>
          <h1 className="text-3xl font-bold text-gray-900" dir="auto">
            {book.title}
          </h1>
          <p className="mt-2 text-lg text-gray-600" dir="auto">
            {book.author?.name ?? "—"}
            {book.additionalAuthors && book.additionalAuthors.length > 0 && (
              <span>
                {" "}
                · {book.additionalAuthors.map((a) => a.name).join(", ")}
              </span>
            )}
          </p>

          <dl className="mt-8 grid gap-3 text-sm sm:grid-cols-2">
            {book.publisher && (
              <>
                <dt className="font-medium text-gray-500">Publisher</dt>
                <dd dir="auto">{book.publisher.name}</dd>
              </>
            )}
            {book.isbn && (
              <>
                <dt className="font-medium text-gray-500">ISBN</dt>
                <dd>{book.isbn}</dd>
              </>
            )}
            {book.isbn13 && (
              <>
                <dt className="font-medium text-gray-500">ISBN-13</dt>
                <dd>{book.isbn13}</dd>
              </>
            )}
            {book.edition && (
              <>
                <dt className="font-medium text-gray-500">Edition</dt>
                <dd dir="auto">{book.edition}</dd>
              </>
            )}
            <dt className="font-medium text-gray-500">Format</dt>
            <dd>{book.format}</dd>
            <dt className="font-medium text-gray-500">Binding</dt>
            <dd>{book.binding.replace(/_/g, " ")}</dd>
            {book.numberOfPages && (
              <>
                <dt className="font-medium text-gray-500">Pages</dt>
                <dd>{book.numberOfPages}</dd>
              </>
            )}
            {book.yearPublished && (
              <>
                <dt className="font-medium text-gray-500">Published</dt>
                <dd>{book.yearPublished}</dd>
              </>
            )}
            {book.originalPublicationYear && (
              <>
                <dt className="font-medium text-gray-500">Original year</dt>
                <dd>{book.originalPublicationYear}</dd>
              </>
            )}
            <dt className="font-medium text-gray-500">Added to list</dt>
            <dd>{new Date(book.dateAdded).toLocaleDateString()}</dd>
          </dl>

          {book.bookshelves && book.bookshelves.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {book.bookshelves.map((shelf) => (
                <span
                  key={shelf.id}
                  className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700"
                  dir="auto"
                >
                  {shelf.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
