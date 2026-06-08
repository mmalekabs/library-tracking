import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import {
  BookMarked,
  Calendar,
  Clock,
  FileText,
  Pause,
  Play,
  Plus,
  Star,
} from "lucide-react";
import toast from "react-hot-toast";
import { ApiError } from "@/lib/api";
import {
  fetchBookTimeStats,
  fetchCurrentlyReading,
  fetchReadingHistory,
  fetchReadingStats,
  fetchReadingSummary,
  formatMinutes,
  logReadingSession,
  startReading,
  updateReadingEntry,
  type ReadingEntry,
} from "@/lib/reading";
import { StatCard, ChartBox } from "@/components/admin/stats/StatCard";
import { TablePagination } from "@/components/admin/TablePagination";
import { DEFAULT_PAGE_SIZE, type PageSize } from "@/constants/pagination";
import { STATUS_LABELS } from "@/constants/stats";
import { LogSessionModal } from "@/components/reading/LogSessionModal";
import { FinishReadingModal } from "@/components/reading/FinishReadingModal";
import { StartReadingModal } from "@/components/reading/StartReadingModal";

type Tab = "now" | "history" | "stats" | "books";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function ProgressBar({ percent }: { percent: number | null }) {
  if (percent === null) return null;
  return (
    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
      <div
        className="h-full rounded-full bg-primary transition-all"
        style={{ width: `${Math.min(100, percent)}%` }}
      />
    </div>
  );
}

function EntryCard({
  entry,
  onLog,
  onFinish,
  onPause,
  onResume,
}: {
  entry: ReadingEntry;
  onLog: () => void;
  onFinish: () => void;
  onPause: () => void;
  onResume: () => void;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex gap-4">
        {entry.book.coverImageUrl ? (
          <img
            src={entry.book.coverImageUrl}
            alt=""
            className="h-24 w-16 shrink-0 rounded object-cover"
          />
        ) : (
          <div className="flex h-24 w-16 shrink-0 items-center justify-center rounded bg-gray-100 text-xs text-gray-400">
            No cover
          </div>
        )}
        <div className="min-w-0 flex-1">
          <Link
            to={`/admin/books/${entry.bookId}/edit`}
            className="font-semibold text-gray-900 hover:text-primary"
            dir="auto"
          >
            {entry.book.title}
          </Link>
          <p className="text-sm text-gray-500" dir="auto">
            {entry.book.author?.name ?? "Unknown author"}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Started {formatDate(entry.startedAt)}
            {entry.calendarDays ? ` · ${entry.calendarDays} days` : ""}
            {entry.totalMinutes > 0
              ? ` · ${formatMinutes(entry.totalMinutes)} logged`
              : ""}
          </p>
          {entry.book.numberOfPages && (
            <p className="mt-1 text-xs text-gray-600">
              Page {entry.progressPage} of {entry.book.numberOfPages}
              {entry.progressPercent !== null &&
                ` (${entry.progressPercent}%)`}
            </p>
          )}
          <ProgressBar percent={entry.progressPercent} />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onLog}
          className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90"
        >
          <FileText className="h-3.5 w-3.5" />
          Log session
        </button>
        <button
          type="button"
          onClick={onFinish}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          Finish
        </button>
        {entry.status === "ON_HOLD" ? (
          <button
            type="button"
            onClick={onResume}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            <Play className="h-3.5 w-3.5" />
            Resume
          </button>
        ) : (
          <button
            type="button"
            onClick={onPause}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            <Pause className="h-3.5 w-3.5" />
            On hold
          </button>
        )}
      </div>
      {entry.recentSessions.length > 0 && (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <p className="text-xs font-medium text-gray-500">Recent sessions</p>
          <ul className="mt-1 space-y-0.5 text-xs text-gray-600">
            {entry.recentSessions.map((s) => (
              <li key={s.id}>
                {formatDate(s.sessionDate)} — {s.pagesRead} pages
                {s.minutesRead ? `, ${formatMinutes(s.minutesRead)}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function ReadingPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("now");
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [statsPeriod, setStatsPeriod] = useState<
    "day" | "week" | "month" | "year"
  >("month");
  const [logEntry, setLogEntry] = useState<ReadingEntry | null>(null);
  const [finishEntry, setFinishEntry] = useState<ReadingEntry | null>(null);
  const [startOpen, setStartOpen] = useState(false);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["reading"] });
    queryClient.invalidateQueries({ queryKey: ["books"] });
    queryClient.invalidateQueries({ queryKey: ["stats"] });
  };

  const { data: summary } = useQuery({
    queryKey: ["reading", "summary"],
    queryFn: fetchReadingSummary,
  });

  const { data: current = [], isLoading: loadingCurrent } = useQuery({
    queryKey: ["reading", "current"],
    queryFn: fetchCurrentlyReading,
  });

  const { data: historyData, isLoading: loadingHistory } = useQuery({
    queryKey: ["reading", "history", historyPage, historyPageSize],
    queryFn: () =>
      fetchReadingHistory({ page: historyPage, limit: historyPageSize }),
  });

  const { data: stats } = useQuery({
    queryKey: ["reading", "stats", statsPeriod],
    queryFn: () => fetchReadingStats({ period: statsPeriod }),
    enabled: tab === "stats",
  });

  const { data: bookStats = [] } = useQuery({
    queryKey: ["reading", "stats", "books"],
    queryFn: fetchBookTimeStats,
    enabled: tab === "books",
  });

  const mutationError = (err: unknown) =>
    toast.error(err instanceof ApiError ? err.message : "Request failed");

  const startMutation = useMutation({
    mutationFn: (bookId: string) => startReading(bookId),
    onSuccess: () => {
      toast.success("Started reading");
      setStartOpen(false);
      invalidate();
    },
    onError: mutationError,
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Parameters<typeof updateReadingEntry>[1];
    }) => updateReadingEntry(id, data),
    onSuccess: () => {
      invalidate();
    },
    onError: mutationError,
  });

  const sessionMutation = useMutation({
    mutationFn: ({
      entryId,
      data,
    }: {
      entryId: string;
      data: Parameters<typeof logReadingSession>[1];
    }) => logReadingSession(entryId, data),
    onSuccess: () => {
      toast.success("Session logged");
      setLogEntry(null);
      invalidate();
    },
    onError: mutationError,
  });

  const activeBookIds = new Set(current.map((e) => e.bookId));

  const tabs: { id: Tab; label: string }[] = [
    { id: "now", label: "Reading now" },
    { id: "history", label: "History" },
    { id: "stats", label: "Statistics" },
    { id: "books", label: "Time per book" },
  ];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Reading tracker</h2>
          <p className="mt-1 text-sm text-gray-600">
            Track what you read, log pages and time, and view your history.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setStartOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Start reading
        </button>
      </div>

      {summary && (
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-6">
          <StatCard
            label="Today"
            value={summary.today.pagesRead}
            sub={`${formatMinutes(summary.today.minutesRead)} logged`}
            icon={Calendar}
          />
          <StatCard
            label="This week"
            value={summary.thisWeek.pagesRead}
            sub={`${formatMinutes(summary.thisWeek.minutesRead)} logged`}
            icon={BookMarked}
          />
          <StatCard
            label="This month"
            value={summary.thisMonth.pagesRead}
            sub={`${formatMinutes(summary.thisMonth.minutesRead)} logged`}
            icon={FileText}
          />
          <StatCard
            label="Reading now"
            value={summary.currentlyReading}
            icon={Play}
          />
          <StatCard
            label="Finished this year"
            value={summary.booksFinishedThisYear}
            icon={Star}
          />
          <StatCard
            label="All-time logged"
            value={summary.totalPagesLogged}
            sub={`${formatMinutes(summary.totalMinutesLogged)} · ${summary.totalSessions} sessions`}
            icon={Clock}
          />
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-md px-4 py-2 text-sm font-medium ${
              tab === t.id
                ? "bg-white text-primary shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "now" && (
        <div className="space-y-4">
          {loadingCurrent && <p className="text-gray-500">Loading…</p>}
          {!loadingCurrent && current.length === 0 && (
            <p className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-gray-500">
              Nothing in progress. Start reading a book from your library.
            </p>
          )}
          {current.map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              onLog={() => setLogEntry(entry)}
              onFinish={() => setFinishEntry(entry)}
              onPause={() =>
                updateMutation.mutate(
                  { id: entry.id, data: { status: "ON_HOLD" } },
                  { onSuccess: () => toast.success("Paused") },
                )
              }
              onResume={() =>
                updateMutation.mutate(
                  { id: entry.id, data: { status: "READING" } },
                  { onSuccess: () => toast.success("Resumed") },
                )
              }
            />
          ))}
        </div>
      )}

      {tab === "history" && (
        <div>
          {loadingHistory && <p className="text-gray-500">Loading…</p>}
          {!loadingHistory && (historyData?.data.length ?? 0) === 0 && (
            <p className="text-gray-500">No reading history yet.</p>
          )}
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Book</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Started</th>
                  <th className="px-4 py-3">Finished</th>
                  <th className="px-4 py-3">Pages</th>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Rating</th>
                  <th className="px-4 py-3">Days</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {historyData?.data.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900" dir="auto">
                        {entry.book.title}
                      </p>
                      <p className="text-xs text-gray-500" dir="auto">
                        {entry.book.author?.name}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {STATUS_LABELS[entry.status] ?? entry.status}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {formatDate(entry.startedAt)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {formatDate(entry.finishedAt)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {entry.totalPagesRead}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {formatMinutes(entry.totalMinutes)}
                    </td>
                    <td className="px-4 py-3 text-amber-600">
                      {entry.rating ? "★".repeat(entry.rating) : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {entry.calendarDays ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {historyData && historyData.data.length > 0 && (
            <TablePagination
              page={historyPage}
              pageSize={historyPageSize}
              pagination={{
                page: historyData.pagination.page,
                limit: historyData.pagination.limit,
                totalItems: historyData.pagination.totalItems,
                totalPages: historyData.pagination.totalPages,
              }}
              onPageChange={setHistoryPage}
              onPageSizeChange={(size) => {
                setHistoryPageSize(size);
                setHistoryPage(1);
              }}
            />
          )}
        </div>
      )}

      {tab === "stats" && stats && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            {(["day", "week", "month", "year"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setStatsPeriod(p)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize ${
                  statsPeriod === p
                    ? "bg-primary text-white"
                    : "border border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
              >
                {p === "day" ? "Daily" : p === "week" ? "Weekly" : p === "month" ? "Monthly" : "Annual"}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard label="Pages" value={stats.totals.pagesRead} />
            <StatCard
              label="Time"
              value={formatMinutes(stats.totals.minutesRead)}
            />
            <StatCard label="Sessions" value={stats.totals.sessions} />
            <StatCard
              label="Books finished"
              value={stats.totals.booksFinished}
            />
          </div>

          <ChartBox title={`Pages read (${stats.from} → ${stats.to})`}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={stats.timeline}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="pagesRead" fill="#6366f1" name="Pages" />
              </BarChart>
            </ResponsiveContainer>
          </ChartBox>

          <ChartBox title="Reading time (minutes)">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={stats.timeline}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="minutesRead"
                  stroke="#10b981"
                  name="Minutes"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartBox>
        </div>
      )}

      {tab === "books" && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Book</th>
                <th className="px-4 py-3">Reads</th>
                <th className="px-4 py-3">Pages logged</th>
                <th className="px-4 py-3">Time logged</th>
                <th className="px-4 py-3">Calendar days</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {bookStats.map((row) => (
                <tr key={row.bookId}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {row.coverImageUrl ? (
                        <img
                          src={row.coverImageUrl}
                          alt=""
                          className="h-10 w-7 rounded object-cover"
                        />
                      ) : null}
                      <div>
                        <p className="font-medium text-gray-900" dir="auto">
                          {row.title}
                        </p>
                        <p className="text-xs text-gray-500" dir="auto">
                          {row.author}
                        </p>
                        {row.entries.length > 1 && (
                          <p className="mt-1 text-xs text-gray-400">
                            {row.entries.length} read-throughs
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{row.readCount}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {row.totalPagesRead}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {formatMinutes(row.totalMinutes)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {row.totalCalendarDays}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {bookStats.length === 0 && (
            <p className="p-8 text-center text-gray-500">
              No reading data yet. Log sessions to see time per book.
            </p>
          )}
        </div>
      )}

      <StartReadingModal
        open={startOpen}
        activeBookIds={activeBookIds}
        saving={startMutation.isPending}
        onClose={() => setStartOpen(false)}
        onSelect={(bookId) => startMutation.mutate(bookId)}
      />

      <LogSessionModal
        entry={logEntry}
        open={logEntry !== null}
        saving={sessionMutation.isPending}
        onClose={() => setLogEntry(null)}
        onSubmit={(data) => {
          if (!logEntry) return;
          sessionMutation.mutate({ entryId: logEntry.id, data });
        }}
      />

      <FinishReadingModal
        entry={finishEntry}
        open={finishEntry !== null}
        saving={updateMutation.isPending}
        onClose={() => setFinishEntry(null)}
        onSubmit={(data) => {
          if (!finishEntry) return;
          updateMutation.mutate(
            {
              id: finishEntry.id,
              data: {
                status: data.status,
                rating: data.rating,
                review: data.review || null,
                finishedAt: data.finishedAt,
              },
            },
            {
              onSuccess: () => {
                toast.success("Reading updated");
                setFinishEntry(null);
              },
            },
          );
        }}
      />
    </div>
  );
}
