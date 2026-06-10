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
  const savingsRounded =
    book.savings != null ? Math.round(book.savings) : null;

  return (
    <article
      className={`flex h-full min-h-[22rem] flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition hover:shadow-md ${
        admin && !book.isPubliclyVisible ? "border-amber-300 opacity-80" : "border-gray-200"
      }`}
    >
      <div className="aspect-[2/3] w-full shrink-0 overflow-hidden bg-gray-100">
        {book.coverImageUrl ? (
          <img
            src={book.coverImageUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center p-4 text-center" dir="auto">
            <div>
              <p className="line-clamp-3 text-sm font-semibold text-gray-700">
                {book.title}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {book.author?.name ?? "—"}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col p-4">
        <div className="mb-2 flex min-h-[1.375rem] flex-wrap items-start gap-1">
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

        <h3
          className="line-clamp-2 min-h-[2.75rem] font-semibold leading-snug text-gray-900"
          dir="auto"
        >
          <Link to={href} className="hover:text-primary">
            {book.title}
          </Link>
        </h3>

        <p className="mt-1 line-clamp-1 min-h-[1.25rem] text-sm text-gray-600" dir="auto">
          {book.author?.name ?? "—"}
        </p>

        <div className="mt-auto min-h-[3rem] pt-3 text-xs text-gray-500">
          <p>
            {book.numberOfPages ? <span>{book.numberOfPages} pp</span> : <span>&nbsp;</span>}
            {book.numberOfPages && book.yearPublished && <span> · </span>}
            {book.yearPublished && <span>{book.yearPublished}</span>}
          </p>
          <p className="mt-1 line-clamp-1" dir="auto">
            {book.publisher?.name ?? "\u00a0"}
          </p>
        </div>

        <p className="mt-2 min-h-[1.25rem] text-sm font-medium text-gray-800">
          {admin && book.purchasePrice != null ? (
            <>
              {book.purchasePrice} {book.currency}
              {savingsRounded != null && (
                <span
                  className={`ml-2 text-xs ${
                    savingsRounded < 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  ({savingsRounded < 0 ? "saved" : "over"}{" "}
                  {Math.abs(savingsRounded)} {book.currency})
                </span>
              )}
            </>
          ) : (
            "\u00a0"
          )}
        </p>
      </div>
    </article>
  );
}
