import { useEffect, useMemo, useState } from "react";
import { Clock, Play, Square } from "lucide-react";
import type { ReadingEntry, ReadingSessionSummary } from "@/lib/reading";
import {
  clearTimer,
  formatElapsed,
  getActiveTimer,
  getElapsedMinutes,
  getElapsedMs,
  startTimer,
} from "@/lib/readingTimer";
import { inputClass } from "@/components/admin/FormSection";

export interface SessionFormData {
  sessionDate: string;
  endPage: number;
  minutesRead: number | null;
  note: string;
}

interface SessionFormModalProps {
  entry: ReadingEntry | null;
  session?: ReadingSessionSummary | null;
  open: boolean;
  saving?: boolean;
  initialMinutes?: number | null;
  onClose: () => void;
  onSubmit: (data: SessionFormData) => void;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function sessionStartPage(
  entry: ReadingEntry,
  session?: ReadingSessionSummary | null,
): number {
  if (session) {
    if (session.endPage != null) {
      return Math.max(0, session.endPage - session.pagesRead);
    }
    return Math.max(0, entry.progressPage - session.pagesRead);
  }
  return entry.progressPage;
}

export function SessionFormModal({
  entry,
  session,
  open,
  saving,
  initialMinutes,
  onClose,
  onSubmit,
}: SessionFormModalProps) {
  const isEdit = Boolean(session);
  const [sessionDate, setSessionDate] = useState(todayIso());
  const [endPage, setEndPage] = useState("");
  const [minutesRead, setMinutesRead] = useState("");
  const [note, setNote] = useState("");
  const [timerTick, setTimerTick] = useState(0);

  const activeTimer =
    entry && getActiveTimer()?.entryId === entry.id ? getActiveTimer() : null;

  useEffect(() => {
    if (!open) return;
    if (session) {
      setSessionDate(session.sessionDate);
      const page =
        session.endPage ??
        sessionStartPage(entry!, session) + session.pagesRead;
      setEndPage(String(page));
      setMinutesRead(
        session.minutesRead != null ? String(session.minutesRead) : "",
      );
      setNote(session.note ?? "");
    } else {
      setSessionDate(todayIso());
      const start = entry ? sessionStartPage(entry) : 0;
      setEndPage(start > 0 ? String(start) : "");
      setMinutesRead(
        initialMinutes != null ? String(initialMinutes) : "",
      );
      setNote("");
    }
  }, [open, session, entry, initialMinutes]);

  useEffect(() => {
    if (!open || !activeTimer) return;
    const id = window.setInterval(() => setTimerTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [open, activeTimer?.startedAt, activeTimer]);

  const startPage = entry ? sessionStartPage(entry, session) : 0;
  const endPageNum = Number.parseInt(endPage, 10);
  const pagesThisSession = useMemo(() => {
    if (!Number.isFinite(endPageNum)) return null;
    return Math.max(0, endPageNum - startPage);
  }, [endPageNum, startPage]);

  if (!open || !entry) return null;

  const handleStartTimer = () => {
    if (activeTimer) return;
    startTimer(entry.id, entry.book.title);
    setTimerTick((t) => t + 1);
  };

  const handleStopTimer = () => {
    if (!activeTimer) return;
    const minutes = getElapsedMinutes(activeTimer);
    clearTimer();
    setMinutesRead(String(minutes));
    setTimerTick((t) => t + 1);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!Number.isFinite(endPageNum) || endPageNum < startPage) return;
    onSubmit({
      sessionDate,
      endPage: endPageNum,
      minutesRead: minutesRead ? Number.parseInt(minutesRead, 10) : null,
      note: note.trim(),
    });
  };

  const timerMs = activeTimer ? getElapsedMs(activeTimer) : 0;
  void timerTick;

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

        <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-800">
              <Clock className="h-4 w-4 text-primary" aria-hidden />
              Reading timer
            </div>
            {activeTimer ? (
              <span className="font-mono text-sm font-semibold tabular-nums text-primary">
                {formatElapsed(timerMs)}
              </span>
            ) : (
              <span className="text-xs text-gray-500">Keeps running if you leave</span>
            )}
          </div>
          <div className="mt-2 flex gap-2">
            {!activeTimer ? (
              <button
                type="button"
                onClick={handleStartTimer}
                className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90"
              >
                <Play className="h-3.5 w-3.5" />
                Start timer
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStopTimer}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                <Square className="h-3.5 w-3.5" />
                Stop timer
              </button>
            )}
          </div>
        </div>

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
              <span className="font-medium text-gray-700">Last page read</span>
              <input
                type="number"
                min={startPage}
                required
                value={endPage}
                onChange={(e) => setEndPage(e.target.value)}
                className={`${inputClass} mt-1`}
                placeholder={startPage > 0 ? String(startPage) : "1"}
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
                placeholder="From timer or manual"
              />
            </label>
          </div>
          {entry.book.numberOfPages ? (
            <p className="text-xs text-gray-500">
              You were on page {startPage} of {entry.book.numberOfPages}
              {pagesThisSession !== null && endPage.trim() !== "" && (
                <>
                  {" "}
                  — this session adds{" "}
                  <strong>{pagesThisSession}</strong> page
                  {pagesThisSession === 1 ? "" : "s"} (now on page {endPageNum})
                </>
              )}
            </p>
          ) : (
            <p className="text-xs text-gray-500">
              {startPage > 0
                ? `You were on page ${startPage}. `
                : ""}
              Pages read are calculated from your last page entry.
              {pagesThisSession !== null && endPage.trim() !== "" && (
                <>
                  {" "}
                  This session: <strong>{pagesThisSession}</strong> pages.
                </>
              )}
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
            disabled={saving || endPageNum < startPage}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? "Saving…" : isEdit ? "Save changes" : "Log session"}
          </button>
        </div>
      </form>
    </div>
  );
}
