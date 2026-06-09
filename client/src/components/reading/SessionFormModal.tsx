import { useEffect, useState } from "react";
import type { ReadingEntry, ReadingSessionSummary } from "@/lib/reading";
import { inputClass } from "@/components/admin/FormSection";

export interface SessionFormData {
  sessionDate: string;
  pagesRead: number;
  minutesRead: number | null;
  note: string;
}

interface SessionFormModalProps {
  entry: ReadingEntry | null;
  session?: ReadingSessionSummary | null;
  open: boolean;
  saving?: boolean;
  onClose: () => void;
  onSubmit: (data: SessionFormData) => void;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function SessionFormModal({
  entry,
  session,
  open,
  saving,
  onClose,
  onSubmit,
}: SessionFormModalProps) {
  const isEdit = Boolean(session);
  const [sessionDate, setSessionDate] = useState(todayIso());
  const [pagesRead, setPagesRead] = useState("");
  const [minutesRead, setMinutesRead] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    if (session) {
      setSessionDate(session.sessionDate);
      setPagesRead(String(session.pagesRead));
      setMinutesRead(
        session.minutesRead != null ? String(session.minutesRead) : "",
      );
      setNote(session.note ?? "");
    } else {
      setSessionDate(todayIso());
      setPagesRead("");
      setMinutesRead("");
      setNote("");
    }
  }, [open, session]);

  if (!open || !entry) return null;

  const projectedPage =
    (entry.progressPage || 0) -
    (session?.pagesRead ?? 0) +
    (Number.parseInt(pagesRead, 10) || 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      sessionDate,
      pagesRead: Number.parseInt(pagesRead, 10) || 0,
      minutesRead: minutesRead ? Number.parseInt(minutesRead, 10) : null,
      note: note.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
      >
        <h3 className="text-lg font-semibold text-gray-900">
          {isEdit ? "Edit session" : "Log reading session"}
        </h3>
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
          {entry.book.numberOfPages ? (
            <p className="text-xs text-gray-500">
              Current page is calculated from all logged pages
              {pagesRead.trim() !== "" && (
                <>
                  {" "}
                  — will be ~{Math.min(projectedPage, entry.book.numberOfPages)}{" "}
                  of {entry.book.numberOfPages}
                </>
              )}
            </p>
          ) : (
            <p className="text-xs text-gray-500">
              Current page is the sum of pages logged across all sessions.
            </p>
          )}
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
            {saving ? "Saving…" : isEdit ? "Save changes" : "Log session"}
          </button>
        </div>
      </form>
    </div>
  );
}
