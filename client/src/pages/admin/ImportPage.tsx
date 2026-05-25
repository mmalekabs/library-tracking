import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import Papa from "papaparse";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";
import { CSV_FIELD_OPTIONS, FORMAT_OPTIONS, STATUS_OPTIONS } from "@/constants/book";
import { detectColumnMapping } from "@/constants/import";
import { executeCsvImport, type ImportReport, type ImportSettings } from "@/lib/import";
import { inputClass } from "@/components/admin/FormSection";

type Step = "upload" | "preview" | "settings" | "report";

export function ImportPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<Record<string, string>[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [validationErrors, setValidationErrors] = useState<
    { row: number; message: string }[]
  >([]);
  const [importing, setImporting] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);

  const [settings, setSettings] = useState<Omit<ImportSettings, "columnMapping">>({
    duplicateMode: "skip",
    defaultFormat: "PHYSICAL",
    defaultToPurchase: false,
    defaultVisibility: true,
    defaultStatus: "TO_READ",
  });

  const parseFile = useCallback((f: File) => {
    if (f.size > 5 * 1024 * 1024) {
      toast.error("File must be under 5MB");
      return;
    }
    Papa.parse<Record<string, string>>(f, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const hdrs = results.meta.fields ?? [];
        const mapping = detectColumnMapping(hdrs);
        const errors: { row: number; message: string }[] = [];

        results.data.forEach((row, i) => {
          const titleCol = Object.entries(mapping).find(([, v]) => v === "title")?.[0];
          const authorCol = Object.entries(mapping).find(([, v]) => v === "author")?.[0];
          if (titleCol && !row[titleCol]?.trim()) {
            errors.push({ row: i + 2, message: "Missing title" });
          }
          if (authorCol && !row[authorCol]?.trim()) {
            errors.push({ row: i + 2, message: "Missing author" });
          }
        });

        setFile(f);
        setHeaders(hdrs);
        setPreviewRows(results.data.slice(0, 10));
        setTotalRows(results.data.length);
        setColumnMapping(mapping);
        setValidationErrors(errors.slice(0, 20));
        setStep("preview");
      },
      error: (err) => toast.error(err.message),
    });
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f?.name.endsWith(".csv")) parseFile(f);
    else toast.error("Please upload a CSV file");
  };

  const runImport = async () => {
    if (!file) return;
    setImporting(true);
    try {
      const fullSettings: ImportSettings = {
        ...settings,
        columnMapping,
      };
      const result = await executeCsvImport(file, fullSettings);
      setReport(result);
      setStep("report");
      queryClient.invalidateQueries({ queryKey: ["books"] });
      toast.success(`Imported ${result.imported} books`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="max-w-4xl">
      <h2 className="text-2xl font-bold text-gray-900">Import CSV</h2>
      <p className="mt-1 text-sm text-gray-600">
        Bulk-import books from a Goodreads-style export.
      </p>

      <div className="mt-6 flex gap-2 text-sm">
        {(["upload", "preview", "settings", "report"] as Step[]).map((s, i) => (
          <span
            key={s}
            className={
              step === s
                ? "font-medium text-primary"
                : "text-gray-400"
            }
          >
            {i + 1}. {s.charAt(0).toUpperCase() + s.slice(1)}
          </span>
        ))}
      </div>

      {step === "upload" && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          className="mt-8 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-white p-12"
        >
          <Upload className="h-12 w-12 text-gray-400" aria-hidden />
          <p className="mt-4 font-medium text-gray-700">
            Drag & drop a CSV file here
          </p>
          <p className="mt-1 text-sm text-gray-500">Max 5MB</p>
          <label className="mt-6 cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90">
            Choose file
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) parseFile(f);
              }}
            />
          </label>
        </div>
      )}

      {step === "preview" && file && (
        <div className="mt-8 space-y-6">
          <div className="flex items-center gap-3 rounded-lg border bg-white p-4">
            <FileSpreadsheet className="h-8 w-8 text-primary" aria-hidden />
            <div>
              <p className="font-medium">{file.name}</p>
              <p className="text-sm text-gray-500">
                {(file.size / 1024).toFixed(1)} KB · {totalRows} rows
              </p>
            </div>
          </div>

          <div className="rounded-xl border bg-white p-6">
            <h3 className="font-semibold text-gray-900">Column mapping</h3>
            <p className="mt-1 text-sm text-gray-500">
              Match each CSV column to a database field.
            </p>
            <div className="mt-4 space-y-2">
              {headers.map((header) => (
                <div
                  key={header}
                  className="grid grid-cols-2 items-center gap-4 text-sm"
                >
                  <span className="font-medium text-gray-700" dir="auto">
                    {header}
                  </span>
                  <select
                    value={columnMapping[header] ?? ""}
                    onChange={(e) =>
                      setColumnMapping((m) => ({
                        ...m,
                        [header]: e.target.value,
                      }))
                    }
                    className={inputClass}
                  >
                    {CSV_FIELD_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {validationErrors.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="flex items-center gap-2 font-medium text-amber-800">
                <AlertCircle className="h-5 w-5" />
                Validation warnings ({validationErrors.length}+)
              </p>
              <ul className="mt-2 max-h-32 overflow-auto text-sm text-amber-700">
                {validationErrors.map((e, i) => (
                  <li key={i}>
                    Row {e.row}: {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  {headers.map((h) => (
                    <th key={h} className="px-3 py-2 font-medium" dir="auto">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, i) => (
                  <tr key={i} className="border-b">
                    {headers.map((h) => (
                      <td key={h} className="max-w-[200px] truncate px-3 py-2" dir="auto">
                        {row[h]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-3 py-2 text-xs text-gray-500">
              Showing first 10 of {totalRows} rows
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep("settings")}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white"
            >
              Continue to settings
            </button>
            <button
              type="button"
              onClick={() => setStep("upload")}
              className="text-sm text-gray-600"
            >
              Back
            </button>
          </div>
        </div>
      )}

      {step === "settings" && (
        <div className="mt-8 space-y-6 rounded-xl border bg-white p-6">
          <h3 className="font-semibold">Import settings</h3>

          <FormField label="Duplicate handling">
            <select
              value={settings.duplicateMode}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  duplicateMode: e.target.value as ImportSettings["duplicateMode"],
                }))
              }
              className={inputClass}
            >
              <option value="skip">Skip duplicates</option>
              <option value="overwrite">Overwrite duplicates</option>
              <option value="allow">Import all (allow duplicates)</option>
            </select>
          </FormField>

          <FormField label="Default format">
            <select
              value={settings.defaultFormat}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  defaultFormat: e.target.value as ImportSettings["defaultFormat"],
                }))
              }
              className={inputClass}
            >
              {FORMAT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Default reading status">
            <select
              value={settings.defaultStatus}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  defaultStatus: e.target.value as ImportSettings["defaultStatus"],
                }))
              }
              className={inputClass}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </FormField>

          <div className="space-y-4 rounded-lg border border-amber-200 bg-amber-50/50 p-4">
            <div className="flex items-center gap-3">
              <input
                id="defToPurchase"
                type="checkbox"
                checked={settings.defaultToPurchase}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    defaultToPurchase: e.target.checked,
                  }))
                }
                className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
              />
              <label htmlFor="defToPurchase" className="text-sm font-medium text-gray-900">
                Import as &quot;to purchase&quot; (wishlist, not library)
              </label>
            </div>
            <p className="text-xs text-gray-600">
              When checked, imported books go to the To Purchase list instead of
              Books.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <input
              id="defVis"
              type="checkbox"
              checked={settings.defaultVisibility}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  defaultVisibility: e.target.checked,
                }))
              }
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <label htmlFor="defVis" className="text-sm">
              {settings.defaultToPurchase
                ? "Publicly visible on wishlist page by default"
                : "Publicly visible in catalog by default"}
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              disabled={importing}
              onClick={runImport}
              className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60"
            >
              {importing ? "Importing…" : "Start import"}
            </button>
            <button
              type="button"
              onClick={() => setStep("preview")}
              className="text-sm text-gray-600"
            >
              Back
            </button>
          </div>
        </div>
      )}

      {step === "report" && report && (
        <div className="mt-8 space-y-6 rounded-xl border bg-white p-6">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-green-700">
            <CheckCircle className="h-6 w-6" />
            Import complete
          </h3>
          <ul className="space-y-2 text-sm">
            <li>✅ {report.imported} books imported</li>
            <li>⏭️ {report.skipped} books skipped (duplicates)</li>
            <li>❌ {report.failed} books failed</li>
          </ul>
          {report.errors.length > 0 && (
            <div className="max-h-48 overflow-auto rounded border border-red-100 bg-red-50 p-3 text-sm text-red-800">
              {report.errors.map((e, i) => (
                <p key={i}>
                  Row {e.row}: {e.message}
                </p>
              ))}
            </div>
          )}
          {(report.createdAuthors.length > 0 ||
            report.createdPublishers.length > 0) && (
            <div className="text-sm text-gray-600">
              {report.createdAuthors.length > 0 && (
                <p>New authors: {report.createdAuthors.join(", ")}</p>
              )}
              {report.createdPublishers.length > 0 && (
                <p>New publishers: {report.createdPublishers.join(", ")}</p>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={() => navigate("/admin/books")}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white"
          >
            View books
          </button>
        </div>
      )}
    </div>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">
        {label}
      </label>
      {children}
    </div>
  );
}
