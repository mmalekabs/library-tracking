import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle,
  FileSpreadsheet,
  Upload,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  executeBookmoryImport,
  previewBookmoryImport,
  type BookmoryImportPreview,
  type BookmoryImportReport,
  type BookmoryImportSettings,
  type BookmoryUploadProgress,
} from "@/lib/bookmoryImport";
import { inputClass } from "@/components/admin/FormSection";

type Step = "upload" | "preview" | "settings" | "report";

const ACCEPT = ".xlsx,.xls,.csv,.json";

export function BookmoryImportPage() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<BookmoryImportPreview | null>(null);
  const [report, setReport] = useState<BookmoryImportReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [parseProgress, setParseProgress] = useState<BookmoryUploadProgress | null>(
    null,
  );
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] =
    useState<BookmoryUploadProgress | null>(null);

  const [settings, setSettings] = useState<BookmoryImportSettings>({
    duplicateMode: "skip",
    importAs: "library",
    isPubliclyVisible: true,
    allowMissingAuthor: true,
  });

  const parseFile = useCallback(async (f: File) => {
    if (f.size > 15 * 1024 * 1024) {
      toast.error("File must be under 15MB");
      return;
    }
    const lower = f.name.toLowerCase();
    if (
      !lower.endsWith(".xlsx") &&
      !lower.endsWith(".xls") &&
      !lower.endsWith(".csv") &&
      !lower.endsWith(".json")
    ) {
      toast.error("Use a Bookmory export (.xlsx recommended, or .csv / .json)");
      return;
    }

    setLoading(true);
    setParseProgress({
      phase: "uploading",
      percent: 0,
      current: 0,
      total: f.size,
      currentTitle: f.name,
    });
    try {
      const data = await previewBookmoryImport(f, {
        onProgress: setParseProgress,
      });
      setFile(f);
      setPreview(data);
      setStep("preview");
      toast.success(`Parsed ${data.summary.total} books from Bookmory export`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not parse file");
    } finally {
      setLoading(false);
      setParseProgress(null);
    }
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) void parseFile(f);
  };

  const runImport = async () => {
    if (!file) return;
    setImporting(true);
    setImportProgress({
      phase: "uploading",
      percent: 0,
      current: 0,
      total: file.size,
      currentTitle: file.name,
    });
    try {
      const result = await executeBookmoryImport(file, settings, {
        onProgress: setImportProgress,
      });
      setReport(result);
      setStep("report");
      queryClient.invalidateQueries({ queryKey: ["books"] });
      toast.success(
        `Imported ${result.imported + result.updated} books (${result.skipped} skipped)`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
      setImportProgress(null);
    }
  };

  const reset = () => {
    setStep("upload");
    setFile(null);
    setPreview(null);
    setReport(null);
  };

  return (
    <div className="max-w-5xl">
      <h2 className="text-2xl font-bold text-gray-900">Import from Bookmory</h2>
      <p className="mt-1 text-sm text-gray-600">
        Upload your Bookmory backup, preview how it maps to this library, then
        merge when you are ready.
      </p>

      <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        <p className="font-medium">How to export from Bookmory</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-blue-800">
          <li>Open Bookmory → Profile → Export</li>
          <li>Choose <strong>Excel (.xlsx)</strong> — recommended</li>
          <li>
            For best column detection, set Bookmory&apos;s language to{" "}
            <strong>English</strong> before exporting
          </li>
          <li>Upload the file here (CSV or JSON also accepted if you have them)</li>
        </ol>
        <p className="mt-2 text-xs text-blue-700">
          Database (.db) backups are not supported — use the Excel export instead.
        </p>
        <p className="mt-2 text-xs text-blue-700">
          Books import into your <strong>library</strong> by default. Status,
          start/finish dates, and page counts are saved on each book record. A{" "}
          <strong>goodreadsID</strong> column is mapped to Goodreads Book Id.
        </p>
      </div>

      <div className="mt-6 flex gap-2 text-sm">
        {(["upload", "preview", "settings", "report"] as Step[]).map((s, i) => (
          <span
            key={s}
            className={step === s ? "font-medium text-primary" : "text-gray-400"}
          >
            {i + 1}. {s.charAt(0).toUpperCase() + s.slice(1)}
          </span>
        ))}
      </div>

      {step === "upload" && (
        <div
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
          className="mt-6 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-white px-6 py-16 text-center"
        >
          <Upload className="h-10 w-10 text-gray-400" aria-hidden />
          <p className="mt-4 text-sm font-medium text-gray-900">
            Drop your Bookmory export here
          </p>
          <p className="mt-1 text-xs text-gray-500">.xlsx, .csv, or .json — up to 15MB</p>
          <label className="mt-6 cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90">
            Choose file
            <input
              type="file"
              accept={ACCEPT}
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void parseFile(f);
              }}
            />
          </label>
          {loading && parseProgress && <ParseProgressBar progress={parseProgress} />}
        </div>
      )}

      {step === "preview" && preview && (
        <div className="mt-6 space-y-6">
          {preview.parseWarnings.map((w) => (
            <div
              key={w}
              className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {w}
            </div>
          ))}

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Books found" value={preview.summary.total} />
            <Stat label="With read time" value={preview.summary.withReadTime} />
            <Stat label="With Goodreads Id" value={preview.summary.withGoodreadsId} />
            <Stat label="In library" value={preview.summary.inLibrary} />
            <Stat label="Duplicates" value={preview.summary.duplicates} />
            <Stat label="With reading data" value={preview.summary.withReadingData} />
            <Stat label="Wishlist flagged" value={preview.summary.wishlist} />
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900">
              Detected columns
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              Format: {preview.format.toUpperCase()}
              {preview.headerRowIndex > 0 &&
                ` · header on row ${preview.headerRowIndex + 1}`}
            </p>
            <dl className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(preview.columnMapping).map(([header, field]) => (
                <div key={header} className="text-xs">
                  <dt className="text-gray-500">{header}</dt>
                  <dd className="font-medium text-gray-800">→ {field}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Author</th>
                  <th className="px-4 py-3">Pages</th>
                  <th className="px-4 py-3">Read time</th>
                  <th className="px-4 py-3">Goodreads Id</th>
                  <th className="px-4 py-3">Library</th>
                  <th className="px-4 py-3">Match</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {preview.books.slice(0, 50).map((book) => (
                  <tr key={book.sourceRow}>
                    <td className="px-4 py-3 text-gray-500">{book.sourceRow}</td>
                    <td className="max-w-[12rem] truncate px-4 py-3 font-medium text-gray-900" dir="auto">
                      {book.title}
                    </td>
                    <td className="max-w-[10rem] truncate px-4 py-3 text-gray-600" dir="auto">
                      {book.author ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {book.pagesRead ?? book.numberOfPages ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {book.totalReadMinutes != null ? (
                        <span title={book.totalReadTimeRaw ?? undefined}>
                          {book.totalReadMinutes} min
                          {book.totalReadTimeRaw
                            ? ` (${book.totalReadTimeRaw})`
                            : ""}
                        </span>
                      ) : book.totalReadTimeRaw ? (
                        <span className="text-amber-700" title="Could not parse">
                          ? ({book.totalReadTimeRaw})
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">
                      {book.externalId ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {book.inLibrary ? "true" : "false"}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {book.duplicate ? (
                        <span className="text-amber-700">
                          In library ({book.duplicate.matchBy}) — will link
                        </span>
                      ) : (
                        <span className="text-green-700">New</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.books.length > 50 && (
            <p className="text-sm text-gray-500">
              Showing first 50 of {preview.books.length} books.
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={reset}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Choose another file
            </button>
            <button
              type="button"
              onClick={() => setStep("settings")}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
            >
              Continue to settings
            </button>
          </div>
        </div>
      )}

      {step === "settings" && preview && (
        <div className="mt-6 max-w-xl space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-600">
            Ready to import <strong>{preview.summary.total}</strong> books from{" "}
            <strong>{preview.fileName}</strong>.
          </p>

          <label className="block text-sm">
            <span className="font-medium text-gray-700">Default destination</span>
            <select
              value={settings.importAs}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  importAs: e.target.value as BookmoryImportSettings["importAs"],
                }))
              }
              className={`${inputClass} mt-1`}
            >
              <option value="library">Library</option>
              <option value="to_purchase">To purchase list</option>
            </select>
          </label>

          <label className="block text-sm">
            <span className="font-medium text-gray-700">If book already exists</span>
            <select
              value={settings.duplicateMode}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  duplicateMode: e.target
                    .value as BookmoryImportSettings["duplicateMode"],
                }))
              }
              className={`${inputClass} mt-1`}
            >
              <option value="skip">Skip duplicates</option>
              <option value="overwrite">Update existing books</option>
              <option value="update_goodreads_id">
                Match existing — update Goodreads Id only
              </option>
            </select>
            {settings.duplicateMode === "update_goodreads_id" && (
              <span className="mt-1 block text-xs text-gray-500">
                Matches by title, ISBN, or existing Goodreads Id. Only{" "}
                <strong>goodreadsID</strong> from the file is written — no other
                fields.
              </span>
            )}
          </label>

          {settings.importAs !== "to_purchase" && (
            <>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={settings.isPubliclyVisible}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      isPubliclyVisible: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-gray-300 text-primary"
                />
                Library books visible on public catalog
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={settings.allowMissingAuthor}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      allowMissingAuthor: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-gray-300 text-primary"
                />
                Use &quot;Unknown&quot; when author is missing (library rows only)
              </label>
            </>
          )}

          {importing && importProgress && (
            <ImportProgressBar progress={importProgress} />
          )}

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              onClick={() => setStep("preview")}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Back
            </button>
            <button
              type="button"
              disabled={importing}
              onClick={() => void runImport()}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              <FileSpreadsheet className="h-4 w-4" />
              {importing ? "Importing…" : "Start import"}
            </button>
          </div>
        </div>
      )}

      {step === "report" && report && (
        <div className="mt-6 space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle className="h-5 w-5" />
            <h3 className="text-lg font-semibold">Import complete</h3>
          </div>
          <ul className="grid gap-2 text-sm text-gray-700 sm:grid-cols-2">
            <li>Added: {report.imported}</li>
            <li>Updated: {report.updated}</li>
            <li>Skipped: {report.skipped}</li>
            <li>Failed: {report.failed}</li>
          </ul>
          {report.errors.length > 0 && (
            <div className="rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-800">
              <p className="font-medium">Errors</p>
              <ul className="mt-2 max-h-40 overflow-y-auto space-y-1">
                {report.errors.map((e) => (
                  <li key={`${e.row}-${e.message}`}>
                    Row {e.row}: {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-medium">Need to undo this import?</p>
            <p className="mt-1 text-amber-800">
              Open <strong>Recent additions</strong>, filter by today&apos;s date,
              select the books you want to remove, and bulk-delete them.
            </p>
            <Link
              to="/admin/recent-additions"
              className="mt-3 inline-block rounded-lg bg-amber-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-900"
            >
              Review recent additions
            </Link>
          </div>
          <button
            type="button"
            onClick={reset}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Import another file
          </button>
        </div>
      )}
    </div>
  );
}

function bookProgress(current: number, total: number): string {
  const bookTotal = Math.max(0, total - 1);
  const bookCurrent = Math.max(0, Math.min(bookTotal, current - 1));
  return bookTotal > 0 ? `${bookCurrent} / ${bookTotal}` : "";
}

function progressLabel(progress: BookmoryUploadProgress): string {
  const { phase, current, total } = progress;
  switch (phase) {
    case "uploading":
      return "Uploading file…";
    case "parsing":
      return "Reading export file…";
    case "checking": {
      const count = bookProgress(current, total);
      return count
        ? `Checking duplicates (${count})`
        : "Checking duplicates…";
    }
    case "importing": {
      const count = bookProgress(current, total);
      return count ? `Importing books (${count})` : "Importing books…";
    }
    default:
      return "Preparing…";
  }
}

function ProgressBar({
  progress,
  className = "mt-6 w-full max-w-md text-left",
}: {
  progress: BookmoryUploadProgress;
  className?: string;
}) {
  const label = progressLabel(progress);
  const showTitle = Boolean(progress.currentTitle);

  return (
    <div className={className} aria-live="polite">
      <div className="flex items-center justify-between gap-3 text-sm text-gray-700">
        <span>{label}</span>
        <span className="shrink-0 tabular-nums text-gray-500">
          {progress.percent}%
        </span>
      </div>
      {showTitle && (
        <p className="mt-1 truncate text-sm text-gray-600" dir="auto">
          {progress.currentTitle}
        </p>
      )}
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200"
        role="progressbar"
        aria-valuenow={progress.percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-150 ease-out"
          style={{ width: `${Math.min(100, progress.percent)}%` }}
        />
      </div>
    </div>
  );
}

function ParseProgressBar({ progress }: { progress: BookmoryUploadProgress }) {
  return <ProgressBar progress={progress} />;
}

function ImportProgressBar({ progress }: { progress: BookmoryUploadProgress }) {
  return <ProgressBar progress={progress} className="w-full text-left" />;
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-2xl font-semibold text-gray-900">{value}</p>
    </div>
  );
}
