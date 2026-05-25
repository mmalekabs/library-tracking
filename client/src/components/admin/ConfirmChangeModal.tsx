interface ConfirmChangeModalProps {
  open: boolean;
  title: string;
  fieldLabel: string;
  bookTitle: string;
  oldValue: string;
  newValue: string;
  saving?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmChangeModal({
  open,
  title,
  fieldLabel,
  bookTitle,
  oldValue,
  newValue,
  saving,
  onConfirm,
  onCancel,
}: ConfirmChangeModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-change-title"
    >
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h3 id="confirm-change-title" className="text-lg font-semibold text-gray-900">
          {title}
        </h3>
        <p className="mt-2 text-sm text-gray-600" dir="auto">
          <span className="font-medium">{bookTitle}</span>
          {" — "}
          {fieldLabel}
        </p>
        <dl className="mt-4 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm">
          <div>
            <dt className="font-medium text-gray-500">Previous</dt>
            <dd className="mt-0.5 text-gray-900 break-words" dir="auto">
              {oldValue || "—"}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-gray-500">New</dt>
            <dd className="mt-0.5 text-gray-900 break-words" dir="auto">
              {newValue || "—"}
            </dd>
          </div>
        </dl>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={saving}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
