import { Link } from "react-router-dom";
import type { Book } from "@/types";

const formatLabels: Record<Book["format"], { label: string; className: string }> = {
  PHYSICAL: { label: "Physical", className: "bg-emerald-100 text-emerald-800" },
  DIGITAL: { label: "Digital", className: "bg-blue-100 text-blue-800" },
  AUDIO: { label: "Audio", className: "bg-purple-100 text-purple-800" },
};

interface BookCardProps {
  book: Book;
  admin?: boolean;
  detailPath?: string;
}

export function BookCard({ book, admin = false, detailPath }: BookCardProps) {
  const href = detailPath ?? (admin ? `/admin/books/${book.id}/edit` : `/books/${book.id}`);
  const format = formatLabels[book.format];

  return (
    <article
      className={`flex flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition hover:shadow-md ${
        admin && !book.isPubliclyVisible ? "border-amber-300 opacity-80" : "border-gray-200"
      }`}
    >
      <div className="flex aspect-[2/3] items-center justify-center bg-gray-100">
        {book.coverImageUrl ? (
          <img
            src={book.coverImageUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="p-4 text-center" dir="auto">
            <p className="line-clamp-3 text-sm font-semibold text-gray-700">
              {book.title}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {book.author?.name ?? "—"}
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="mb-2 flex flex-wrap gap-1">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${format.className}`}
          >
            {format.label}
          </span>
          {admin && !book.isPubliclyVisible && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              Hidden
            </span>
          )}
        </div>

        <h3 className="line-clamp-2 font-semibold text-gray-900" dir="auto">
          <Link to={href} className="hover:text-primary">
            {book.title}
          </Link>
        </h3>

        <p className="mt-1 text-sm text-gray-600" dir="auto">
          {book.author?.name ?? "—"}
        </p>

        <div className="mt-auto pt-3 text-xs text-gray-500">
          {book.numberOfPages && <span>{book.numberOfPages} pp</span>}
          {book.numberOfPages && book.yearPublished && <span> · </span>}
          {book.yearPublished && <span>{book.yearPublished}</span>}
          {book.publisher && (
            <p className="mt-1 line-clamp-1" dir="auto">
              {book.publisher.name}
            </p>
          )}
        </div>

        {admin && book.purchasePrice != null && (
          <p className="mt-2 text-sm font-medium text-gray-800">
            {book.purchasePrice} {book.currency}
            {book.savings != null && (
              <span
                className={`ml-2 text-xs ${
                  book.savings < 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                ({book.savings < 0 ? "saved" : "over"} {Math.abs(book.savings)}{" "}
                {book.currency})
              </span>
            )}
          </p>
        )}
      </div>
    </article>
  );
}
