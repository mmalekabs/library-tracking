import { useState } from "react";
import type { ReadingEntry } from "@/lib/reading";
import { inputClass } from "@/components/admin/FormSection";

interface FinishReadingModalProps {
  entry: ReadingEntry | null;
  open: boolean;
  saving?: boolean;
  onClose: () => void;
  onSubmit: (data: {
    status: "READ" | "DID_NOT_FINISH";
    rating: number | null;
    review: string;
    finishedAt: string;
  }) => void;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function FinishReadingModal({
  entry,
  open,
  saving,
  onClose,
  onSubmit,
}: FinishReadingModalProps) {
  const [status, setStatus] = useState<"READ" | "DID_NOT_FINISH">("READ");
  const [rating, setRating] = useState<number | null>(null);
  const [review, setReview] = useState("");
  const [finishedAt, setFinishedAt] = useState(todayIso());

  if (!open || !entry) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ status, rating, review: review.trim(), finishedAt });
        }}
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
      >
        <h3 className="text-lg font-semibold text-gray-900">Finish reading</h3>
        <p className="mt-1 text-sm text-gray-600" dir="auto">
          {entry.book.title}
        </p>

        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="font-medium text-gray-700">Outcome</span>
            <select
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as "READ" | "DID_NOT_FINISH")
              }
              className={`${inputClass} mt-1`}
            >
              <option value="READ">Finished</option>
              <option value="DID_NOT_FINISH">Did not finish</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium text-gray-700">Finish date</span>
            <input
              type="date"
              required
              value={finishedAt}
              onChange={(e) => setFinishedAt(e.target.value)}
              className={`${inputClass} mt-1`}
            />
          </label>
          <div>
            <span className="text-sm font-medium text-gray-700">Rating</span>
            <div className="mt-1 flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(rating === n ? null : n)}
                  className={`rounded px-2 py-1 text-sm ${
                    rating !== null && n <= rating
                      ? "bg-amber-100 text-amber-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>
          <label className="block text-sm">
            <span className="font-medium text-gray-700">Review</span>
            <textarea
              value={review}
              onChange={(e) => setReview(e.target.value)}
              rows={3}
              className={`${inputClass} mt-1`}
              placeholder="Optional thoughts"
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
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
