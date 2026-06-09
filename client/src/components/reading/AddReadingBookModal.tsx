import { useState } from "react";
import { FORMAT_OPTIONS } from "@/constants/book";
import { FormField, inputClass } from "@/components/admin/FormSection";
import type { BookFormat, ReadingStatus } from "@/types";
import type { CreateReadingOnlyBookInput } from "@/lib/reading";

const TRACKING_STATUS_OPTIONS: {
  value: Exclude<ReadingStatus, "TO_READ">;
  label: string;
}[] = [
  { value: "READING", label: "Currently reading" },
  { value: "ON_HOLD", label: "On hold" },
  { value: "READ", label: "Already finished" },
  { value: "DID_NOT_FINISH", label: "Did not finish" },
];

interface AddReadingBookModalProps {
  open: boolean;
  saving?: boolean;
  onClose: () => void;
  onSubmit: (input: CreateReadingOnlyBookInput) => void;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AddReadingBookModal({
  open,
  saving,
  onClose,
  onSubmit,
}: AddReadingBookModalProps) {
  const [title, setTitle] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [format, setFormat] = useState<BookFormat>("DIGITAL");
  const [numberOfPages, setNumberOfPages] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [status, setStatus] =
    useState<Exclude<ReadingStatus, "TO_READ">>("READING");
  const [startedAt, setStartedAt] = useState(todayIso());
  const [finishedAt, setFinishedAt] = useState(todayIso());

  if (!open) return null;

  const needsFinishedDate = status === "READ" || status === "DID_NOT_FINISH";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const pages = numberOfPages.trim()
      ? Number.parseInt(numberOfPages, 10)
      : null;

    onSubmit({
      title: title.trim(),
      authorName: authorName.trim() || null,
      format,
      numberOfPages: pages && !Number.isNaN(pages) ? pages : null,
      coverImageUrl: coverImageUrl.trim() || null,
      entry: {
        status,
        startedAt: `${startedAt}T12:00:00.000Z`,
        finishedAt: needsFinishedDate ? `${finishedAt}T12:00:00.000Z` : null,
      },
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={handleSubmit}
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-xl"
      >
        <div className="border-b border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900">
            Add book not in library
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            Track PDFs, ebooks, borrowed books, or anything you read outside your
            collection.
          </p>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          <FormField label="Title" required className="sm:col-span-2">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
              required
              autoFocus
              dir="auto"
            />
          </FormField>

          <FormField label="Author" className="sm:col-span-2">
            <input
              type="text"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              className={inputClass}
              dir="auto"
            />
          </FormField>

          <FormField label="Format">
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as BookFormat)}
              className={inputClass}
            >
              {FORMAT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Pages">
            <input
              type="number"
              min={1}
              value={numberOfPages}
              onChange={(e) => setNumberOfPages(e.target.value)}
              className={inputClass}
            />
          </FormField>

          <FormField label="Cover image URL" className="sm:col-span-2">
            <input
              type="url"
              value={coverImageUrl}
              onChange={(e) => setCoverImageUrl(e.target.value)}
              className={inputClass}
              placeholder="https://…"
            />
          </FormField>

          <FormField label="Reading status" className="sm:col-span-2">
            <select
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as Exclude<ReadingStatus, "TO_READ">)
              }
              className={inputClass}
            >
              {TRACKING_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Started on">
            <input
              type="date"
              value={startedAt}
              onChange={(e) => setStartedAt(e.target.value)}
              className={inputClass}
              required
            />
          </FormField>

          {needsFinishedDate && (
            <FormField label="Finished on">
              <input
                type="date"
                value={finishedAt}
                onChange={(e) => setFinishedAt(e.target.value)}
                className={inputClass}
                required
              />
            </FormField>
          )}
        </div>

        <div className="flex gap-3 border-t border-gray-200 p-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !title.trim()}
            className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Add & track"}
          </button>
        </div>
      </form>
    </div>
  );
}
