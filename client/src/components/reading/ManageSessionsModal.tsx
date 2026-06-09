import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { ApiError } from "@/lib/api";
import {
  deleteReadingSession,
  fetchReadingEntry,
  formatMinutes,
  updateReadingSession,
  type ReadingEntry,
  type ReadingSessionSummary,
} from "@/lib/reading";
import { SessionFormModal, type SessionFormData } from "./SessionFormModal";

interface ManageSessionsModalProps {
  entry: ReadingEntry | null;
  open: boolean;
  onClose: () => void;
  onChanged?: () => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function ManageSessionsModal({
  entry,
  open,
  onClose,
  onChanged,
}: ManageSessionsModalProps) {
  const queryClient = useQueryClient();
  const [editingSession, setEditingSession] =
    useState<ReadingSessionSummary | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["reading", "entry", entry?.id],
    queryFn: () => fetchReadingEntry(entry!.id),
    enabled: open && Boolean(entry?.id),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["reading"] });
    onChanged?.();
  };

  const mutationError = (err: unknown) =>
    toast.error(err instanceof ApiError ? err.message : "Request failed");

  const updateMutation = useMutation({
    mutationFn: ({
      sessionId,
      data,
    }: {
      sessionId: string;
      data: SessionFormData;
    }) =>
      updateReadingSession(sessionId, {
        sessionDate: data.sessionDate,
        pagesRead: data.pagesRead,
        minutesRead: data.minutesRead,
        note: data.note || null,
      }),
    onSuccess: () => {
      toast.success("Session updated");
      setEditingSession(null);
      invalidate();
    },
    onError: mutationError,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteReadingSession,
    onSuccess: () => {
      toast.success("Session deleted");
      setDeletingId(null);
      invalidate();
    },
    onError: mutationError,
  });

  if (!open || !entry) return null;

  const sessions = data?.sessions ?? [];

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-xl">
          <div className="border-b border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900">Sessions</h3>
            <p className="mt-1 text-sm text-gray-600" dir="auto">
              {entry.book.title}
            </p>
            {data && (
              <p className="mt-1 text-xs text-gray-500">
                {data.sessionCount} session{data.sessionCount === 1 ? "" : "s"} ·{" "}
                {data.totalPagesRead} pages · {formatMinutes(data.totalMinutes)}
              </p>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {isLoading && (
              <p className="p-4 text-sm text-gray-500">Loading sessions…</p>
            )}
            {isError && (
              <p className="p-4 text-sm text-red-600">Could not load sessions.</p>
            )}
            {!isLoading && !isError && sessions.length === 0 && (
              <p className="p-4 text-sm text-gray-500">No sessions logged yet.</p>
            )}
            <ul className="divide-y divide-gray-100">
              {sessions.map((session) => (
                <li
                  key={session.id}
                  className="flex items-start justify-between gap-3 px-3 py-3"
                >
                  <div className="min-w-0 text-sm">
                    <p className="font-medium text-gray-900">
                      {formatDate(session.sessionDate)}
                    </p>
                    <p className="text-gray-600">
                      {session.pagesRead} pages
                      {session.minutesRead != null &&
                        ` · ${formatMinutes(session.minutesRead)}`}
                    </p>
                    {session.note && (
                      <p className="mt-0.5 text-xs text-gray-500" dir="auto">
                        {session.note}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => setEditingSession(session)}
                      className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                      aria-label="Edit session"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingId(session.id)}
                      className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600"
                      aria-label="Delete session"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="border-t border-gray-200 p-4">
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {deletingId && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h4 className="text-lg font-semibold text-gray-900">Delete session?</h4>
            <p className="mt-2 text-sm text-gray-600">
              This removes the logged pages and time for that day. This cannot be
              undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                disabled={deleteMutation.isPending}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate(deletingId)}
                disabled={deleteMutation.isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      <SessionFormModal
        entry={entry}
        session={editingSession}
        open={editingSession !== null}
        saving={updateMutation.isPending}
        onClose={() => setEditingSession(null)}
        onSubmit={(formData) => {
          if (!editingSession) return;
          updateMutation.mutate({ sessionId: editingSession.id, data: formData });
        }}
      />
    </>
  );
}
