import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, Square } from "lucide-react";
import {
  clearTimer,
  formatElapsed,
  getActiveTimer,
  getElapsedMinutes,
  getElapsedMs,
  setPendingSessionLog,
  type ActiveReadingTimer,
} from "@/lib/readingTimer";

interface ReadingTimerBarProps {
  onStopAndLog: (timer: ActiveReadingTimer, minutes: number) => void;
}

export function ReadingTimerBar({ onStopAndLog }: ReadingTimerBarProps) {
  const navigate = useNavigate();
  const [timer, setTimer] = useState<ActiveReadingTimer | null>(() =>
    getActiveTimer(),
  );
  const [elapsedMs, setElapsedMs] = useState(0);

  const syncTimer = useCallback(() => {
    const active = getActiveTimer();
    setTimer(active);
    if (active) {
      setElapsedMs(getElapsedMs(active));
    }
  }, []);

  useEffect(() => {
    syncTimer();
    const onStorage = (e: StorageEvent) => {
      if (e.key === "library-reading-timer") syncTimer();
    };
    const onCustom = () => syncTimer();
    window.addEventListener("storage", onStorage);
    window.addEventListener("reading-timer-changed", onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("reading-timer-changed", onCustom);
    };
  }, [syncTimer]);

  useEffect(() => {
    if (!timer) return;
    const id = window.setInterval(() => {
      setElapsedMs(getElapsedMs(timer));
    }, 1000);
    return () => window.clearInterval(id);
  }, [timer]);

  if (!timer) return null;

  const handleStop = () => {
    const minutes = getElapsedMinutes(timer);
    const snapshot = { ...timer };
    clearTimer();
    setTimer(null);
    setPendingSessionLog(snapshot.entryId, minutes);
    window.dispatchEvent(
      new CustomEvent("reading-timer-stop", {
        detail: { entryId: snapshot.entryId, minutes },
      }),
    );
    onStopAndLog(snapshot, minutes);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-primary/20 bg-primary px-4 py-3 text-white shadow-lg md:left-64">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Clock className="h-5 w-5 shrink-0 animate-pulse" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-medium">Reading timer</p>
            <p className="truncate text-xs text-white/90" dir="auto">
              {timer.bookTitle}
            </p>
          </div>
          <span className="font-mono text-lg font-semibold tabular-nums">
            {formatElapsed(elapsedMs)}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => navigate("/admin/reading")}
            className="rounded-lg border border-white/40 px-3 py-1.5 text-sm font-medium hover:bg-white/10"
          >
            Open reading
          </button>
          <button
            type="button"
            onClick={handleStop}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-primary hover:bg-white/90"
          >
            <Square className="h-3.5 w-3.5" />
            Stop & log session
          </button>
        </div>
      </div>
    </div>
  );
}
