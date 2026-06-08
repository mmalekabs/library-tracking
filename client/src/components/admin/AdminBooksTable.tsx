import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Library, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import type { Book } from "@/types";
import { updateBook } from "@/lib/books";
import { ApiError } from "@/lib/api";
import { ConfirmChangeModal } from "./ConfirmChangeModal";
import {
  BOOK_TABLE_COLUMNS,
  BOOK_TABLE_FIELD_LABELS,
  type BookTableField,
  buildBookFieldPayload,
  fieldUsesSelect,
  getBookFieldDisplay,
  getBookFieldRaw,
  getInputType,
  getSelectOptions,
  valuesEqual,
} from "./bookTableEdit";
import { inputClass } from "./FormSection";

interface PendingChange {
  book: Book;
  field: BookTableField;
  oldRaw: string;
  newRaw: string;
  oldDisplay: string;
  newDisplay: string;
  payload: Record<string, unknown>;
}

interface AdminBooksTableProps {
  books: Book[];
  collection: "library" | "to_purchase";
  editPath: (id: string) => string;
  onDelete: (book: Book) => void;
  onMoveToLibrary?: (book: Book) => void;
}

export function AdminBooksTable({
  books,
  collection,
  editPath,
  onDelete,
  onMoveToLibrary,
}: AdminBooksTableProps) {
  const queryClient = useQueryClient();
  const tableRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState<{
    bookId: string;
    field: BookTableField;
  } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [pending, setPending] = useState<PendingChange | null>(null);

  const saveMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Record<string, unknown>;
    }) => updateBook(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["books"] });
      toast.success("Book updated");
      setPending(null);
      setEditing(null);
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : "Update failed");
    },
  });

  const finishEditing = useCallback(
    (bookId: string, field: BookTableField, rawValue: string) => {
      const book = books.find((b) => b.id === bookId);
      if (!book) {
        setEditing(null);
        return;
      }

      const oldRaw = getBookFieldRaw(book, field);
      const normalizedNew = rawValue;

      if (valuesEqual(field, oldRaw, normalizedNew)) {
        setEditing(null);
        return;
      }

      setPending({
        book,
        field,
        oldRaw,
        newRaw: normalizedNew,
        oldDisplay: getBookFieldDisplay(book, field),
        newDisplay:
          field === "isPubliclyVisible"
            ? normalizedNew === "true"
              ? "Yes"
              : "No"
            : fieldUsesSelect(field)
              ? getSelectOptions(field).find((o) => o.value === normalizedNew)
                  ?.label ?? normalizedNew
              : normalizedNew,
        payload: buildBookFieldPayload(field, normalizedNew),
      });
      setEditing(null);
    },
    [books],
  );

  const tryFinishCurrentEdit = useCallback(() => {
    if (!editing) return;
    finishEditing(editing.bookId, editing.field, editValue);
  }, [editing, editValue, finishEditing]);

  useEffect(() => {
    if (!editing) return;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (tableRef.current?.contains(target)) return;
      tryFinishCurrentEdit();
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [editing, tryFinishCurrentEdit]);

  const startEdit = (book: Book, field: BookTableField) => {
    if (pending) return;

    if (
      editing &&
      (editing.bookId !== book.id || editing.field !== field)
    ) {
      const prevBook = books.find((b) => b.id === editing.bookId);
      if (
        prevBook &&
        !valuesEqual(
          editing.field,
          getBookFieldRaw(prevBook, editing.field),
          editValue,
        )
      ) {
        finishEditing(editing.bookId, editing.field, editValue);
        return;
      }
    }

    setEditing({ bookId: book.id, field });
    setEditValue(getBookFieldRaw(book, field));
  };

  const handleCellKeyDown = (
    e: React.KeyboardEvent,
    book: Book,
    field: BookTableField,
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      finishEditing(book.id, field, editValue);
    }
    if (e.key === "Escape") {
      setEditing(null);
    }
  };

  const renderCell = (book: Book, field: BookTableField) => {
    const isEditing =
      editing?.bookId === book.id && editing?.field === field;
    const display = getBookFieldDisplay(book, field);

    if (isEditing) {
      if (fieldUsesSelect(field)) {
        return (
          <select
            autoFocus
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => handleCellKeyDown(e, book, field)}
            className={`${inputClass} min-w-0 py-1 text-xs`}
          >
            {getSelectOptions(field).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        );
      }
      return (
        <input
          autoFocus
          type={getInputType(field)}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => handleCellKeyDown(e, book, field)}
          className={`${inputClass} min-w-0 py-1 text-xs`}
          dir={field === "title" || field === "author" ? "auto" : undefined}
        />
      );
    }

    return (
      <button
        type="button"
        onClick={() => startEdit(book, field)}
        className="w-full rounded px-1 py-0.5 text-left text-xs hover:bg-primary/5 focus:bg-primary/10 focus:outline-none"
        title="Click to edit"
        dir={
          field === "title" || field === "author" || field === "publisher"
            ? "auto"
            : undefined
        }
      >
        <span className={display ? "text-gray-900" : "text-gray-400"}>
          {display || "—"}
        </span>
      </button>
    );
  };

  return (
    <>
      <div
        ref={tableRef}
        className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm"
      >
        <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
          <thead className="bg-gray-50">
            <tr>
              {BOOK_TABLE_COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className="whitespace-nowrap px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500"
                  style={{ minWidth: col.minWidth }}
                >
                  {col.label}
                </th>
              ))}
              <th className="sticky right-0 bg-gray-50 px-3 py-3 text-xs font-semibold uppercase text-gray-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {books.map((book) => (
              <tr
                key={book.id}
                className={
                  !book.isPubliclyVisible ? "bg-amber-50/40" : undefined
                }
              >
                {BOOK_TABLE_COLUMNS.map((col) => (
                  <td
                    key={col.key}
                    className="max-w-[14rem] px-2 py-1.5 align-middle"
                  >
                    {renderCell(book, col.key)}
                  </td>
                ))}
                <td className="sticky right-0 whitespace-nowrap bg-white px-2 py-1.5">
                  <div className="flex items-center gap-1">
                    <Link
                      to={editPath(book.id)}
                      className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-primary"
                      title="Full edit"
                    >
                      <ExternalLink className="h-4 w-4" aria-hidden />
                    </Link>
                    {collection === "to_purchase" && onMoveToLibrary && (
                      <button
                        type="button"
                        onClick={() => onMoveToLibrary(book)}
                        className="rounded p-1 text-primary hover:bg-primary/10"
                        title="Add to library"
                      >
                        <Library className="h-4 w-4" aria-hidden />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onDelete(book)}
                      className="rounded p-1 text-red-600 hover:bg-red-50"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-xs text-gray-500">
        Click any cell to edit. Click outside the table to review changes before
        saving.
      </p>

      <ConfirmChangeModal
        open={pending !== null}
        title="Save changes?"
        fieldLabel={pending ? BOOK_TABLE_FIELD_LABELS[pending.field] : ""}
        bookTitle={pending?.book.title ?? ""}
        oldValue={pending?.oldDisplay ?? ""}
        newValue={pending?.newDisplay ?? ""}
        saving={saveMutation.isPending}
        onConfirm={() => {
          if (!pending) return;
          saveMutation.mutate({
            id: pending.book.id,
            payload: pending.payload,
          });
        }}
        onCancel={() => {
          setPending(null);
        }}
      />
    </>
  );
}
