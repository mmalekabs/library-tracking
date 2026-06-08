import { useState } from "react";
import type { ReadingEntry } from "@/lib/reading";
import { inputClass } from "@/components/admin/FormSection";

interface LogSessionModalProps {
  entry: ReadingEntry | null;
  open: boolean;
  saving?: boolean;
  onClose: () => void;
  onSubmit: (data: {
    sessionDate: string;
    pagesRead: number;
    minutesRead: number | null;
    endPage: number | null;
    note: string;
  }) => void;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function LogSessionModal({
  entry,
  open,
  saving,
  onClose,
  onSubmit,
}: LogSessionModalProps) {
  const [sessionDate, setSessionDate] = useState(todayIso());
  const [pagesRead, setPagesRead] = useState("");
  const [minutesRead, setMinutesRead] = useState("");
  const [endPage, setEndPage] = useState("");
  const [note, setNote] = useState("");

  if (!open || !entry) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      sessionDate,
      pagesRead: Number.parseInt(pagesRead, 10) || 0,
      minutesRead: minutesRead ? Number.parseInt(minutesRead, 10) : null,
      endPage: endPage ? Number.parseInt(endPage, 10) : null,
      note: note.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
      >
        <h3 className="text-lg font-semibold text-gray-900">Log reading session</h3>
        <p className="mt-1 text-sm text-gray-600" dir="auto">
          {entry.book.title}
        </p>

        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="font-medium text-gray-700">Date</span>
            <input
              type="date"
              required
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              className={`${inputClass} mt-1`}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="font-medium text-gray-700">Pages read</span>
              <input
                type="number"
                min={0}
                value={pagesRead}
                onChange={(e) => setPagesRead(e.target.value)}
                className={`${inputClass} mt-1`}
                placeholder="0"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-gray-700">Minutes</span>
              <input
                type="number"
                min={0}
                value={minutesRead}
                onChange={(e) => setMinutesRead(e.target.value)}
                className={`${inputClass} mt-1`}
                placeholder="Optional"
              />
            </label>
          </div>
          <label className="block text-sm">
            <span className="font-medium text-gray-700">
              Current page (optional)
            </span>
            <input
              type="number"
              min={0}
              max={entry.book.numberOfPages ?? undefined}
              value={endPage}
              onChange={(e) => setEndPage(e.target.value)}
              className={`${inputClass} mt-1`}
              placeholder={
                entry.book.numberOfPages
                  ? `of ${entry.book.numberOfPages}`
                  : "Page number"
              }
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-gray-700">Note</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className={`${inputClass} mt-1`}
              placeholder="Optional"
            />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Log session"}
          </button>
        </div>
      </form>
    </div>
  );
}
