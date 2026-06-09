import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImageDown } from "lucide-react";
import toast from "react-hot-toast";
import type { BindingType, BookFormat } from "@/types";
import { FORMAT_OPTIONS, BINDING_OPTIONS } from "@/constants/book";
import { fetchGoodreadsCover } from "@/lib/goodreads";
import {
  createReadingOnlyBook,
  updateReadingOnlyBook,
  type ReadingOnlyBookDetail,
  type CreateReadingOnlyBookInput,
} from "@/lib/reading";
import {
  emptyReadingBookDraft,
  type ReadingBookDraft,
} from "@/lib/goodreadsDraft";
import { ApiError } from "@/lib/api";
import { FormSection, FormField, inputClass } from "@/components/admin/FormSection";

interface ReadingBookFormProps {
  book?: ReadingOnlyBookDetail;
  mode: "create" | "edit";
  initialDraft?: ReadingBookDraft;
}

function bookToDraft(book: ReadingOnlyBookDetail): ReadingBookDraft {
  return {
    title: book.title,
    externalId: book.externalId ?? "",
    authorName: book.author?.name ?? "",
    additionalAuthorNames: book.additionalAuthors.map((a) => a.name),
    publisherName: book.publisher?.name ?? "",
    isbn: book.isbn ?? "",
    isbn13: book.isbn13 ?? "",
    edition: book.edition ?? "",
    format: book.format,
    binding: book.binding,
    numberOfPages: book.numberOfPages?.toString() ?? "",
    yearPublished: book.yearPublished?.toString() ?? "",
    originalPublicationYear: book.originalPublicationYear?.toString() ?? "",
    coverImageUrl: book.coverImageUrl ?? "",
    notes: book.notes ?? "",
  };
}

function draftToPayload(draft: ReadingBookDraft): CreateReadingOnlyBookInput {
  const pages = draft.numberOfPages.trim()
    ? Number.parseInt(draft.numberOfPages, 10)
    : null;
  const year = draft.yearPublished.trim()
    ? Number.parseInt(draft.yearPublished, 10)
    : null;
  const origYear = draft.originalPublicationYear.trim()
    ? Number.parseInt(draft.originalPublicationYear, 10)
    : null;

  return {
    title: draft.title.trim(),
    externalId: draft.externalId.trim() || null,
    authorName: draft.authorName.trim() || null,
    additionalAuthorNames: draft.additionalAuthorNames
      .map((n) => n.trim())
      .filter(Boolean),
    publisherName: draft.publisherName.trim() || null,
    isbn: draft.isbn.trim() || null,
    isbn13: draft.isbn13.trim() || null,
    edition: draft.edition.trim() || null,
    format: draft.format,
    binding: draft.binding,
    numberOfPages: pages && !Number.isNaN(pages) ? pages : null,
    yearPublished: year && !Number.isNaN(year) ? year : null,
    originalPublicationYear: origYear && !Number.isNaN(origYear) ? origYear : null,
    coverImageUrl: draft.coverImageUrl.trim() || null,
    notes: draft.notes.trim() || null,
  };
}

export function ReadingBookForm({
  book,
  mode,
  initialDraft,
}: ReadingBookFormProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ReadingBookDraft>(() =>
    book
      ? bookToDraft(book)
      : initialDraft ?? emptyReadingBookDraft(),
  );
  const [additionalAuthorInput, setAdditionalAuthorInput] = useState("");
  const [fetchingCover, setFetchingCover] = useState(false);

  useEffect(() => {
    if (book) setForm(bookToDraft(book));
  }, [book]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = draftToPayload(form);
      if (mode === "edit" && book) {
        return updateReadingOnlyBook(book.id, payload);
      }
      return createReadingOnlyBook(payload);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["reading"] });
      toast.success(mode === "edit" ? "Book updated" : "Book saved");
      const id =
        mode === "edit" && book
          ? book.id
          : (result as { book: { id: string } }).book.id;
      navigate(`/admin/reading/books/${id}/edit`);
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Save failed"),
  });

  const set = <K extends keyof ReadingBookDraft>(
    key: K,
    value: ReadingBookDraft[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleFetchCover = async () => {
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

  const addAdditionalAuthor = () => {
    const name = additionalAuthorInput.trim();
    if (!name) return;
    if (!form.additionalAuthorNames.includes(name)) {
      set("additionalAuthorNames", [...form.additionalAuthorNames, name]);
    }
    setAdditionalAuthorInput("");
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!form.title.trim()) {
          toast.error("Title is required");
          return;
        }
        saveMutation.mutate();
      }}
      className="space-y-6"
    >
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
              placeholder="e.g. 2767052"
            />
            <button
              type="button"
              onClick={handleFetchCover}
              disabled={fetchingCover}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <ImageDown className="h-4 w-4" aria-hidden />
              {fetchingCover ? "Loading…" : "Fetch cover"}
            </button>
          </div>
        </FormField>
        <FormField label="Author">
          <input
            value={form.authorName}
            onChange={(e) => set("authorName", e.target.value)}
            className={inputClass}
            dir="auto"
          />
        </FormField>
        <FormField label="Publisher">
          <input
            value={form.publisherName}
            onChange={(e) => set("publisherName", e.target.value)}
            className={inputClass}
            dir="auto"
          />
        </FormField>
        <FormField label="Format">
          <select
            value={form.format}
            onChange={(e) => set("format", e.target.value as BookFormat)}
            className={inputClass}
          >
            {FORMAT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Binding">
          <select
            value={form.binding}
            onChange={(e) => set("binding", e.target.value as BindingType)}
            className={inputClass}
          >
            {BINDING_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Pages">
          <input
            type="number"
            min={1}
            value={form.numberOfPages}
            onChange={(e) => set("numberOfPages", e.target.value)}
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
        <FormField label="Cover image URL" className="sm:col-span-2">
          <input
            type="url"
            value={form.coverImageUrl}
            onChange={(e) => set("coverImageUrl", e.target.value)}
            className={inputClass}
            placeholder="https://…"
          />
        </FormField>
        <FormField label="Additional authors" className="sm:col-span-2">
          <div className="flex flex-wrap gap-2">
            <input
              value={additionalAuthorInput}
              onChange={(e) => setAdditionalAuthorInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addAdditionalAuthor();
                }
              }}
              className={`${inputClass} min-w-[12rem] flex-1`}
              placeholder="Add co-author"
              dir="auto"
            />
            <button
              type="button"
              onClick={addAdditionalAuthor}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Add
            </button>
          </div>
          {form.additionalAuthorNames.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2">
              {form.additionalAuthorNames.map((name) => (
                <li
                  key={name}
                  className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700"
                >
                  {name}
                  <button
                    type="button"
                    onClick={() =>
                      set(
                        "additionalAuthorNames",
                        form.additionalAuthorNames.filter((n) => n !== name),
                      )
                    }
                    className="text-gray-500 hover:text-gray-800"
                    aria-label={`Remove ${name}`}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </FormField>
        <FormField label="Notes" className="sm:col-span-2">
          <textarea
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            rows={3}
            className={inputClass}
            dir="auto"
          />
        </FormField>
      </FormSection>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={saveMutation.isPending}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
        >
          {saveMutation.isPending
            ? "Saving…"
            : mode === "edit"
              ? "Save changes"
              : "Save book"}
        </button>
        <button
          type="button"
          onClick={() => navigate("/admin/reading")}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
