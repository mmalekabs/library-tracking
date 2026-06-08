import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, X } from "lucide-react";
import type { EntityCollection, ManagedEntity } from "@/lib/entities";
import { fetchAuthorBooks, fetchPublisherBooks } from "@/lib/entities";
import type { Book } from "@/types";
import { TablePagination } from "@/components/admin/TablePagination";
import { DEFAULT_PAGE_SIZE, type PageSize } from "@/constants/pagination";

interface EntityBooksModalProps {
  entity: ManagedEntity | null;
  entityType: "author" | "publisher";
  collection: EntityCollection;
  open: boolean;
  onClose: () => void;
}

function editPath(book: Book): string {
  return book.toPurchase
    ? `/admin/to-purchase/${book.id}/edit`
    : `/admin/books/${book.id}/edit`;
}

function authorRole(book: Book, authorId: string): string | null {
  if (book.author?.id === authorId) return "Primary";
  if (book.additionalAuthors?.some((a) => a.id === authorId)) {
    return "Additional";
  }
  return null;
}

export function EntityBooksModal({
  entity,
  entityType,
  collection,
  open,
  onClose,
}: EntityBooksModalProps) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(DEFAULT_PAGE_SIZE);

  useEffect(() => {
    if (open && entity) {
      setPage(1);
    }
  }, [open, entity?.id, collection]);

  const { data, isLoading } = useQuery({
    queryKey: ["entity-books", entityType, entity?.id, collection, page, pageSize],
    queryFn: () =>
      entityType === "author"
        ? fetchAuthorBooks(entity!.id, page, pageSize, collection)
        : fetchPublisherBooks(entity!.id, page, pageSize, collection),
    enabled: open && !!entity,
  });

  if (!open || !entity) return null;

  const books = data?.data ?? [];
  const pagination = data?.pagination;
  const label = entityType === "author" ? "author" : "publisher";
  const collectionLabel =
    collection === "library" ? "my library" : "to purchase";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="entity-books-title"
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-4">
          <div>
            <h3
              id="entity-books-title"
              className="text-lg font-semibold text-gray-900"
            >
              Books by this {label} ({collectionLabel})
            </h3>
            <p className="mt-1 text-sm text-gray-600" dir="auto">
              <span className="font-medium text-gray-900">{entity.name}</span>
              {pagination && (
                <span className="text-gray-500">
                  {" "}
                  · {pagination.totalItems} book
                  {pagination.totalItems === 1 ? "" : "s"} in {collectionLabel}
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {isLoading && (
            <p className="py-8 text-center text-gray-500">Loading books…</p>
          )}

          {!isLoading && books.length === 0 && (
            <p className="py-8 text-center text-gray-500">
              No books linked to this {label}.
            </p>
          )}

          {!isLoading && books.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Title</th>
                    {entityType === "author" && (
                      <th className="px-4 py-3 font-medium">Role</th>
                    )}
                    <th className="px-4 py-3 font-medium">Pages</th>
                    <th className="px-4 py-3 font-medium text-right">
                      Open
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {books.map((book) => (
                    <tr key={book.id}>
                      <td className="px-4 py-3 font-medium" dir="auto">
                        {book.title}
                      </td>
                      {entityType === "author" && (
                        <td className="px-4 py-3 text-gray-600">
                          {authorRole(book, entity.id) ?? "—"}
                        </td>
                      )}
                      <td className="px-4 py-3 text-gray-600">
                        {book.numberOfPages ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to={editPath(book)}
                          onClick={onClose}
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                          Edit
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {books.length > 0 && pagination && (
          <div className="border-t border-gray-200 px-6 py-3">
            <TablePagination
              page={page}
              pageSize={pageSize}
              pagination={pagination}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
