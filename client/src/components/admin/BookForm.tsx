import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImageDown } from "lucide-react";
import toast from "react-hot-toast";
import type { Book, BookFormat, BindingType, ReadingStatus } from "@/types";
import {
  FORMAT_OPTIONS,
  BINDING_OPTIONS,
  STATUS_OPTIONS,
  CURRENCY_OPTIONS,
} from "@/constants/book";
import {
  fetchAdminAuthors,
  fetchAdminPublishers,
  fetchAdminBookshelves,
} from "@/lib/lookup";
import { createBook, updateBook, deleteBook } from "@/lib/books";
import { fetchGoodreadsCover } from "@/lib/goodreads";
import { ApiError } from "@/lib/api";
import { FormSection, FormField, inputClass } from "./FormSection";
import { EntityPicker } from "./EntityPicker";
import { TagPicker } from "./TagPicker";

interface BookFormProps {
  book?: Book;
  mode: "create" | "edit";
  /** When true, book is saved to the To Purchase list (not library) */
  defaultToPurchase?: boolean;
  backPath?: string;
}

interface FormState {
  title: string;
  edition: string;
  format: BookFormat;
  binding: BindingType;
  numberOfPages: string;
  externalId: string;
  author: { id: string; name: string };
  additionalAuthors: { id: string; name: string }[];
  publisher: { id: string; name: string };
  isbn: string;
  isbn13: string;
  yearPublished: string;
  originalPublicationYear: string;
  purchasePrice: string;
  marketPrice: string;
  currency: string;
  status: ReadingStatus;
  dateAdded: string;
  dateStartedReading: string;
  dateFinishedReading: string;
  bookshelves: { id: string; name: string }[];
  isPubliclyVisible: boolean;
  toPurchase: boolean;
  coverImageUrl: string;
  notes: string;
}

function toDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function todayInput(): string {
  return new Date().toISOString().slice(0, 10);
}

function bookToFormState(book: Book): FormState {
  return {
    title: book.title,
    edition: book.edition ?? "",
    format: book.format,
    binding: book.binding,
    numberOfPages: book.numberOfPages?.toString() ?? "",
    externalId: book.externalId ?? "",
    author: { id: book.author.id, name: book.author.name },
    additionalAuthors: (book.additionalAuthors ?? []).map((a) => ({
      id: a.id,
      name: a.name,
    })),
    publisher: book.publisher
      ? { id: book.publisher.id, name: book.publisher.name }
      : { id: "", name: "" },
    isbn: book.isbn ?? "",
    isbn13: book.isbn13 ?? "",
    yearPublished: book.yearPublished?.toString() ?? "",
    originalPublicationYear: book.originalPublicationYear?.toString() ?? "",
    purchasePrice: book.purchasePrice?.toString() ?? "",
    marketPrice: book.marketPrice?.toString() ?? "",
    currency: book.currency ?? "SAR",
    status: book.status,
    dateAdded: toDateInput(book.dateAdded),
    dateStartedReading: toDateInput(book.dateStartedReading),
    dateFinishedReading: toDateInput(book.dateFinishedReading),
    bookshelves: (book.bookshelves ?? []).map((s) => ({
      id: s.id,
      name: s.name,
    })),
    isPubliclyVisible: book.isPubliclyVisible ?? true,
    toPurchase: book.toPurchase ?? false,
    coverImageUrl: book.coverImageUrl ?? "",
    notes: book.notes ?? "",
  };
}

const emptyForm = (toPurchase = false): FormState => ({
  title: "",
  edition: "",
  format: "PHYSICAL",
  binding: "PAPERBACK",
  numberOfPages: "",
  externalId: "",
  author: { id: "", name: "" },
  additionalAuthors: [],
  publisher: { id: "", name: "" },
  isbn: "",
  isbn13: "",
  yearPublished: "",
  originalPublicationYear: "",
  purchasePrice: "",
  marketPrice: "",
  currency: "SAR",
  status: "TO_READ",
  dateAdded: todayInput(),
  dateStartedReading: "",
  dateFinishedReading: "",
  bookshelves: [],
  isPubliclyVisible: true,
  toPurchase,
  coverImageUrl: "",
  notes: "",
});

function formToPayload(form: FormState): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    title: form.title.trim(),
    edition: form.edition.trim() || null,
    format: form.format,
    binding: form.binding,
    numberOfPages: form.numberOfPages ? Number(form.numberOfPages) : null,
    externalId: form.externalId.trim() || null,
    isbn: form.isbn.trim() || null,
    isbn13: form.isbn13.trim() || null,
    yearPublished: form.yearPublished ? Number(form.yearPublished) : null,
    originalPublicationYear: form.originalPublicationYear
      ? Number(form.originalPublicationYear)
      : null,
    purchasePrice: form.purchasePrice ? Number(form.purchasePrice) : null,
    marketPrice: form.marketPrice ? Number(form.marketPrice) : null,
    currency: form.currency,
    status: form.status,
    dateAdded: form.dateAdded ? new Date(form.dateAdded).toISOString() : undefined,
    dateStartedReading: form.dateStartedReading
      ? new Date(form.dateStartedReading).toISOString()
      : null,
    dateFinishedReading: form.dateFinishedReading
      ? new Date(form.dateFinishedReading).toISOString()
      : null,
    isPubliclyVisible: form.isPubliclyVisible,
    toPurchase: form.toPurchase,
    coverImageUrl: form.coverImageUrl.trim() || null,
    notes: form.notes.trim() || null,
    bookshelfIds: form.bookshelves.filter((s) => s.id).map((s) => s.id),
    bookshelfNames: form.bookshelves.filter((s) => !s.id).map((s) => s.name),
    additionalAuthorIds: form.additionalAuthors
      .filter((a) => a.id)
      .map((a) => a.id),
    additionalAuthorNames: form.additionalAuthors
      .filter((a) => !a.id)
      .map((a) => a.name),
  };

  if (form.author.id) {
    payload.authorId = form.author.id;
  } else {
    payload.authorName = form.author.name.trim();
  }

  if (form.publisher.id) {
    payload.publisherId = form.publisher.id;
  } else if (form.publisher.name.trim()) {
    payload.publisherName = form.publisher.name.trim();
  } else {
    payload.publisherId = null;
  }

  return payload;
}

export function BookForm({
  book,
  mode,
  defaultToPurchase = false,
  backPath = "/admin/books",
}: BookFormProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(() =>
    book ? bookToFormState(book) : emptyForm(defaultToPurchase),
  );
  const [fetchingCover, setFetchingCover] = useState(false);

  useEffect(() => {
    if (book) setForm(bookToFormState(book));
  }, [book]);

  const savings = useMemo(() => {
    const p = form.purchasePrice ? Number(form.purchasePrice) : null;
    const m = form.marketPrice ? Number(form.marketPrice) : null;
    if (p === null || m === null || Number.isNaN(p) || Number.isNaN(m)) return null;
    return p - m;
  }, [form.purchasePrice, form.marketPrice]);

  const saveMutation = useMutation({
    mutationFn: async (addAnother: boolean) => {
      const payload = formToPayload(form);
      if (mode === "edit" && book) {
        await updateBook(book.id, payload);
        return { addAnother: false };
      }
      await createBook(payload);
      return { addAnother };
    },
    onSuccess: ({ addAnother }) => {
      queryClient.invalidateQueries({ queryKey: ["books"] });
      toast.success(mode === "edit" ? "Book updated" : "Book created");
      if (addAnother) {
        setForm(emptyForm(defaultToPurchase));
      } else {
        navigate(backPath);
      }
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : "Save failed");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteBook(book!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["books"] });
      toast.success("Book deleted");
      navigate(backPath);
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : "Delete failed");
    },
  });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleFetchGoodreadsCover = async () => {
    const bookId = form.externalId.trim();
    if (!/^\d+$/.test(bookId)) {
      toast.error("Enter a numeric Goodreads Book Id first");
      return;
    }
    setFetchingCover(true);
    try {
      const result = await fetchGoodreadsCover(bookId);
      set("coverImageUrl", result.coverUrl);
      toast.success("Cover loaded from Goodreads");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Could not fetch Goodreads cover",
      );
    } finally {
      setFetchingCover(false);
    }
  };

  const handleSubmit = (e: React.FormEvent, addAnother = false) => {
    e.preventDefault();
    if (!form.author.name.trim()) {
      toast.error("Primary author is required");
      return;
    }
    saveMutation.mutate(addAnother);
  };

  return (
    <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-6">
      <FormSection title="Basic information">
        <FormField label="Title" required className="sm:col-span-2">
          <input
            required
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            className={inputClass}
            dir="auto"
          />
        </FormField>
        <FormField label="Edition">
          <input
            value={form.edition}
            onChange={(e) => set("edition", e.target.value)}
            className={inputClass}
            dir="auto"
          />
        </FormField>
        <FormField label="Goodreads Book Id" className="sm:col-span-2">
          <div className="flex flex-wrap gap-2">
            <input
              value={form.externalId}
              onChange={(e) => set("externalId", e.target.value)}
              className={`${inputClass} min-w-[12rem] flex-1`}
              placeholder="e.g. 9285857 (from CSV “Book Id”)"
            />
            <button
              type="button"
              disabled={fetchingCover || !form.externalId.trim()}
              onClick={() => void handleFetchGoodreadsCover()}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <ImageDown className="h-4 w-4" aria-hidden />
              {fetchingCover ? "Fetching…" : "Fetch cover"}
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Uses the Goodreads book page to find the cover image URL.
          </p>
        </FormField>
        <div className="sm:col-span-2">
          <span className="mb-2 block text-sm font-medium text-gray-700">
            Format
          </span>
          <div className="flex flex-wrap gap-4">
            {FORMAT_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="format"
                  checked={form.format === opt.value}
                  onChange={() => set("format", opt.value)}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>
        <FormField label="Binding">
          <select
            value={form.binding}
            onChange={(e) => set("binding", e.target.value as BindingType)}
            className={inputClass}
          >
            {BINDING_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Number of pages">
          <input
            type="number"
            min={0}
            value={form.numberOfPages}
            onChange={(e) => set("numberOfPages", e.target.value)}
            className={inputClass}
          />
        </FormField>
      </FormSection>

      <FormSection title="Authors">
        <div className="sm:col-span-2">
          <EntityPicker
            label="Primary author"
            required
            value={form.author}
            onChange={(author) => set("author", author)}
            queryKey="admin-authors"
            fetchFn={fetchAdminAuthors}
          />
        </div>
        <div className="sm:col-span-2">
          <TagPicker
            label="Additional authors"
            tags={form.additionalAuthors}
            onChange={(additionalAuthors) =>
              set("additionalAuthors", additionalAuthors)
            }
            queryKey="admin-authors-extra"
            fetchFn={fetchAdminAuthors}
          />
        </div>
      </FormSection>

      <FormSection title="Publishing details">
        <div className="sm:col-span-2">
          <EntityPicker
            label="Publisher"
            value={form.publisher}
            onChange={(publisher) => set("publisher", publisher)}
            queryKey="admin-publishers"
            fetchFn={fetchAdminPublishers}
          />
        </div>
        <FormField label="ISBN">
          <input
            value={form.isbn}
            onChange={(e) => set("isbn", e.target.value)}
            className={inputClass}
          />
        </FormField>
        <FormField label="ISBN-13">
          <input
            value={form.isbn13}
            onChange={(e) => set("isbn13", e.target.value)}
            className={inputClass}
          />
        </FormField>
        <FormField label="Year published">
          <input
            type="number"
            value={form.yearPublished}
            onChange={(e) => set("yearPublished", e.target.value)}
            className={inputClass}
          />
        </FormField>
        <FormField label="Original publication year">
          <input
            type="number"
            value={form.originalPublicationYear}
            onChange={(e) => set("originalPublicationYear", e.target.value)}
            className={inputClass}
          />
        </FormField>
      </FormSection>

      <FormSection title="Pricing">
        <FormField label={`Purchase price (${form.currency})`}>
          <input
            type="number"
            min={0}
            step="0.01"
            value={form.purchasePrice}
            onChange={(e) => set("purchasePrice", e.target.value)}
            className={inputClass}
          />
        </FormField>
        <FormField label={`Market / actual price (${form.currency})`}>
          <input
            type="number"
            min={0}
            step="0.01"
            value={form.marketPrice}
            onChange={(e) => set("marketPrice", e.target.value)}
            className={inputClass}
          />
        </FormField>
        <FormField label="Currency">
          <select
            value={form.currency}
            onChange={(e) => set("currency", e.target.value)}
            className={inputClass}
          >
            {CURRENCY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </FormField>
        <div>
          <span className="mb-1 block text-sm font-medium text-gray-700">
            Savings (purchase − market)
          </span>
          <p
            className={`rounded-lg border px-3 py-2 text-sm font-medium ${
              savings === null
                ? "border-gray-200 text-gray-400"
                : savings < 0
                  ? "border-green-200 bg-green-50 text-green-700"
                  : savings > 0
                    ? "border-red-200 bg-red-50 text-red-700"
                    : "border-gray-200 text-gray-600"
            }`}
          >
            {savings === null
              ? "N/A — enter both prices"
              : `${savings > 0 ? "Overpaid" : savings < 0 ? "Saved" : "Even"}: ${Math.abs(savings).toFixed(2)} ${form.currency}`}
          </p>
        </div>
      </FormSection>

      <FormSection title="Status & organization">
        <FormField label="Reading status">
          <select
            value={form.status}
            onChange={(e) => set("status", e.target.value as ReadingStatus)}
            className={inputClass}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Date added">
          <input
            type="date"
            value={form.dateAdded}
            onChange={(e) => set("dateAdded", e.target.value)}
            className={inputClass}
          />
        </FormField>
        <FormField label="Date started reading">
          <input
            type="date"
            value={form.dateStartedReading}
            onChange={(e) => set("dateStartedReading", e.target.value)}
            className={inputClass}
          />
        </FormField>
        <FormField label="Date finished reading">
          <input
            type="date"
            value={form.dateFinishedReading}
            onChange={(e) => set("dateFinishedReading", e.target.value)}
            className={inputClass}
          />
        </FormField>
        <TagPicker
          label="Bookshelves"
          tags={form.bookshelves}
          onChange={(bookshelves) => set("bookshelves", bookshelves)}
          queryKey="admin-bookshelves"
          fetchFn={fetchAdminBookshelves}
        />
        <div className="sm:col-span-2 space-y-3 rounded-lg border border-amber-200 bg-amber-50/50 p-4">
          <div className="flex items-center gap-3">
            <input
              id="toPurchase"
              type="checkbox"
              checked={form.toPurchase}
              onChange={(e) => set("toPurchase", e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
            />
            <label htmlFor="toPurchase" className="text-sm font-medium text-gray-900">
              To purchase (wishlist — not in library yet)
            </label>
          </div>
          <p className="text-xs text-gray-600">
            Checked books appear on the admin <strong>To Purchase</strong> list,
            not under Books. Uncheck when you own the book.
          </p>
        </div>
        <div className="flex items-center gap-3 sm:col-span-2">
          <input
            id="isPublic"
            type="checkbox"
            checked={form.isPubliclyVisible}
            onChange={(e) => set("isPubliclyVisible", e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          />
          <label htmlFor="isPublic" className="text-sm font-medium text-gray-700">
            {form.toPurchase
              ? "Publicly visible on wishlist page (/to-purchase)"
              : "Publicly visible in catalog"}
          </label>
        </div>
      </FormSection>

      <FormSection title="Additional">
        <FormField label="Cover image URL" className="sm:col-span-2">
          <div className="flex flex-wrap gap-2">
            <input
              type="url"
              value={form.coverImageUrl}
              onChange={(e) => set("coverImageUrl", e.target.value)}
              className={`${inputClass} min-w-[12rem] flex-1`}
              placeholder="https://… or use Fetch cover above"
            />
            {form.externalId.trim() && (
              <button
                type="button"
                disabled={fetchingCover}
                onClick={() => void handleFetchGoodreadsCover()}
                className="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
              >
                <ImageDown className="h-4 w-4" aria-hidden />
                {fetchingCover ? "…" : "From Goodreads"}
              </button>
            )}
          </div>
          {form.coverImageUrl && (
            <img
              src={form.coverImageUrl}
              alt=""
              className="mt-2 h-40 w-auto rounded-lg border object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          )}
        </FormField>
        <FormField label="Notes (admin only)" className="sm:col-span-2">
          <textarea
            rows={4}
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            className={inputClass}
            dir="auto"
          />
        </FormField>
      </FormSection>

      <div className="flex flex-wrap items-center gap-3 border-t border-gray-200 pt-6">
        <button
          type="submit"
          disabled={saveMutation.isPending}
          className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-60"
        >
          {saveMutation.isPending ? "Saving…" : "Save"}
        </button>
        {mode === "create" && (
          <button
            type="button"
            disabled={saveMutation.isPending}
            onClick={(e) => handleSubmit(e, true)}
            className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
          >
            Save & add another
          </button>
        )}
        <button
          type="button"
          onClick={() => navigate(backPath)}
          className="rounded-lg px-5 py-2.5 text-sm text-gray-600 hover:text-gray-900"
        >
          Cancel
        </button>
        {mode === "edit" && book && (
          <button
            type="button"
            disabled={deleteMutation.isPending}
            onClick={() => {
              if (confirm(`Delete "${book.title}"?`)) {
                deleteMutation.mutate();
              }
            }}
            className="ml-auto rounded-lg border border-red-300 px-5 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Delete book
          </button>
        )}
      </div>
    </form>
  );
}
