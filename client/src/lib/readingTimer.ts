const STORAGE_KEY = "library-reading-timer";

export interface ActiveReadingTimer {
  entryId: string;
  bookTitle: string;
  startedAt: number;
}

export function getActiveTimer(): ActiveReadingTimer | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveReadingTimer;
    if (
      !parsed.entryId ||
      !parsed.bookTitle ||
      typeof parsed.startedAt !== "number"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function startTimer(entryId: string, bookTitle: string): ActiveReadingTimer {
  const timer: ActiveReadingTimer = {
    entryId,
    bookTitle,
    startedAt: Date.now(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(timer));
  window.dispatchEvent(new CustomEvent("reading-timer-changed"));
  return timer;
}

export function clearTimer(): void {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent("reading-timer-changed"));
}

export function getElapsedMs(timer: ActiveReadingTimer): number {
  return Math.max(0, Date.now() - timer.startedAt);
}

export function getElapsedMinutes(timer: ActiveReadingTimer): number {
  return Math.max(1, Math.round(getElapsedMs(timer) / 60_000));
}

const PENDING_LOG_KEY = "library-pending-session-log";

export interface PendingSessionLog {
  entryId: string;
  minutes: number;
}

export function setPendingSessionLog(entryId: string, minutes: number): void {
  sessionStorage.setItem(
    PENDING_LOG_KEY,
    JSON.stringify({ entryId, minutes } satisfies PendingSessionLog),
  );
}

export function consumePendingSessionLog(): PendingSessionLog | null {
  try {
    const raw = sessionStorage.getItem(PENDING_LOG_KEY);
    sessionStorage.removeItem(PENDING_LOG_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PendingSessionLog;
  } catch {
    return null;
  }
}

export function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
