import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, GripVertical, RotateCcw } from "lucide-react";
import type { BookTableColumnField } from "./bookTableEdit";
import {
  DEFAULT_BOOK_TABLE_COLUMN_ORDER,
  getBookTableColumnLabel,
} from "./bookTableColumns";

interface BookTableColumnsModalProps {
  open: boolean;
  columnOrder: BookTableColumnField[];
  onClose: () => void;
  onSave: (order: BookTableColumnField[]) => void;
}

export function BookTableColumnsModal({
  open,
  columnOrder,
  onClose,
  onSave,
}: BookTableColumnsModalProps) {
  const [draft, setDraft] = useState(columnOrder);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  useEffect(() => {
    if (open) setDraft(columnOrder);
  }, [open, columnOrder]);

  if (!open) return null;

  const moveItem = (from: number, to: number) => {
    if (to < 0 || to >= draft.length) return;
    setDraft((items) => {
      const next = [...items];
      const [removed] = next.splice(from, 1);
      next.splice(to, 0, removed);
      return next;
    });
  };

  const handleDrop = (targetIndex: number) => {
    if (dragIndex === null || dragIndex === targetIndex) return;
    moveItem(dragIndex, targetIndex);
    setDragIndex(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="book-table-columns-title"
    >
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h3
          id="book-table-columns-title"
          className="text-lg font-semibold text-gray-900"
        >
          Table columns
        </h3>
        <p className="mt-1 text-sm text-gray-600">
          Drag rows or use the arrows to change column order. Your layout is
          saved in this browser.
        </p>

        <ul className="mt-4 max-h-[min(24rem,60vh)] space-y-1 overflow-y-auto rounded-lg border border-gray-200 p-2">
          {draft.map((key, index) => (
            <li
              key={key}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragEnd={() => setDragIndex(null)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(index);
              }}
              className={`flex items-center gap-2 rounded-lg border bg-white px-2 py-2 ${
                dragIndex === index
                  ? "border-primary/40 bg-primary/5"
                  : "border-gray-200"
              }`}
            >
              <span
                className="cursor-grab text-gray-400 active:cursor-grabbing"
                aria-hidden
              >
                <GripVertical className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1 text-sm font-medium text-gray-900">
                {getBookTableColumnLabel(key)}
              </span>
              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => moveItem(index, index - 1)}
                  disabled={index === 0}
                  className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                  title="Move up"
                  aria-label={`Move ${getBookTableColumnLabel(key)} up`}
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => moveItem(index, index + 1)}
                  disabled={index === draft.length - 1}
                  className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                  title="Move down"
                  aria-label={`Move ${getBookTableColumnLabel(key)} down`}
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setDraft([...DEFAULT_BOOK_TABLE_COLUMN_ORDER])}
            className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            Reset to default
          </button>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onSave(draft)}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
