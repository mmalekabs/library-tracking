import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import type { Book } from "@/types";
import { moveBookToLibrary } from "@/lib/books";
import { fetchAdminAuthors, fetchAdminPublishers } from "@/lib/lookup";
import { ApiError } from "@/lib/api";
import { EntityPicker } from "./EntityPicker";
import { FormField, inputClass } from "./FormSection";

interface MoveToLibraryModalProps {
  book: Book | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function MoveToLibraryModal({
  book,
  open,
  onClose,
  onSuccess,
}: MoveToLibraryModalProps) {
  const [numberOfPages, setNumberOfPages] = useState("");
  const [author, setAuthor] = useState({ id: "", name: "" });
  const [publisher, setPublisher] = useState({ id: "", name: "" });
  const [marketPrice, setMarketPrice] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");

  useEffect(() => {
    if (!book || !open) return;
    setNumberOfPages(book.numberOfPages?.toString() ?? "");
    setAuthor(
      book.author
        ? { id: book.author.id, name: book.author.name }
        : { id: "", name: "" },
    );
    setPublisher(
      book.publisher
        ? { id: book.publisher.id, name: book.publisher.name }
        : { id: "", name: "" },
    );
    setMarketPrice(book.marketPrice?.toString() ?? "");
    setPurchasePrice(book.purchasePrice?.toString() ?? "");
  }, [book, open]);

  const mutation = useMutation({
    mutationFn: () => {
      if (!book) throw new Error("No book selected");
      const pages = Number.parseInt(numberOfPages, 10);
      const market = Number(marketPrice);
      const payload = {
        numberOfPages: pages,
        marketPrice: market,
        purchasePrice: purchasePrice.trim() ? Number(purchasePrice) : null,
        ...(author.id
          ? { authorId: author.id }
          : { authorName: author.name.trim() }),
        ...(publisher.id
          ? { publisherId: publisher.id }
          : { publisherName: publisher.name.trim() }),
      };
      return moveBookToLibrary(book.id, payload);
    },
    onSuccess: () => {
      toast.success("Added to your library");
      onSuccess();
      onClose();
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Could not add to library"),
  });

  if (!open || !book) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!numberOfPages.trim() || Number.parseInt(numberOfPages, 10) < 1) {
      toast.error("Number of pages is required");
      return;
    }
    if (!author.name.trim()) {
      toast.error("Author is required");
      return;
    }
    if (!publisher.name.trim()) {
      toast.error("Publisher is required");
      return;
    }
    if (!marketPrice.trim() || Number.isNaN(Number(marketPrice))) {
      toast.error("Market / actual price is required");
      return;
    }
    mutation.mutate();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="move-to-library-title"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <h3
          id="move-to-library-title"
          className="text-lg font-semibold text-gray-900"
        >
          Add to library
        </h3>
        <p className="mt-1 text-sm text-gray-600" dir="auto">
          Complete these details for <span className="font-medium">{book.title}</span>{" "}
          before moving it to your library.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <FormField label="Number of pages" required>
            <input
              type="number"
              min={1}
              required
              value={numberOfPages}
              onChange={(e) => setNumberOfPages(e.target.value)}
              className={inputClass}
            />
          </FormField>

          <EntityPicker
            label="Author"
            required
            value={author}
            onChange={setAuthor}
            queryKey="admin-authors"
            fetchFn={fetchAdminAuthors}
            placeholder="Search or create author…"
          />

          <EntityPicker
            label="Publisher"
            required
            value={publisher}
            onChange={setPublisher}
            queryKey="admin-publishers"
            fetchFn={fetchAdminPublishers}
            placeholder="Search or create publisher…"
          />

          <FormField label="Market / actual price" required>
            <input
              type="number"
              min={0}
              step="0.01"
              required
              value={marketPrice}
              onChange={(e) => setMarketPrice(e.target.value)}
              className={inputClass}
            />
          </FormField>

          <FormField label="Purchase price (optional)">
            <input
              type="number"
              min={0}
              step="0.01"
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(e.target.value)}
              className={inputClass}
            />
          </FormField>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={mutation.isPending}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {mutation.isPending ? "Saving…" : "Add to library"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
