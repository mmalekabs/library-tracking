import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  GitMerge,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
  Check,
} from "lucide-react";
import toast from "react-hot-toast";
import { ApiError } from "@/lib/api";
import type {
  EntityCollection,
  EntityListParams,
  EntitySortBy,
  EntitySortOrder,
  ManagedEntity,
} from "@/lib/entities";
import { EntityBooksModal } from "./EntityBooksModal";
import { inputClass } from "./FormSection";

interface EntityManageTableProps {
  title: string;
  description: string;
  entityLabel: string;
  entityType: "author" | "publisher";
  queryKey: string;
  fetchList: (params: EntityListParams) => Promise<ManagedEntity[]>;
  createItem: (name: string) => Promise<ManagedEntity>;
  updateItem: (id: string, name: string) => Promise<ManagedEntity>;
  deleteItem: (id: string) => Promise<{ message: string }>;
  mergeItems?: (
    targetId: string,
    sourceIds: string[],
  ) => Promise<{ mergedNames: string[] }>;
}

function SortableHeader({
  label,
  active,
  sortOrder,
  onClick,
  align = "left",
}: {
  label: string;
  active: boolean;
  sortOrder: EntitySortOrder;
  onClick: () => void;
  align?: "left" | "right";
}) {
  const Icon = active
    ? sortOrder === "asc"
      ? ArrowUp
      : ArrowDown
    : ArrowUpDown;

  return (
    <th
      className={`px-4 py-3 font-medium ${align === "right" ? "text-right" : "text-left"}`}
    >
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 hover:text-gray-900 ${
          active ? "text-primary" : ""
        } ${align === "right" ? "ml-auto" : ""}`}
      >
        {label}
        <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
      </button>
    </th>
  );
}

export function EntityManageTable({
  title,
  description,
  entityLabel,
  entityType,
  queryKey,
  fetchList,
  createItem,
  updateItem,
  deleteItem,
  mergeItems,
}: EntityManageTableProps) {
  const queryClient = useQueryClient();
  const [collection, setCollection] = useState<EntityCollection>("library");
  const [sortBy, setSortBy] = useState<EntitySortBy>("name");
  const [sortOrder, setSortOrder] = useState<EntitySortOrder>("asc");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [booksEntity, setBooksEntity] = useState<ManagedEntity | null>(null);

  const handleSearch = (value: string) => {
    setSearch(value);
    window.clearTimeout((window as unknown as { _entTimer?: number })._entTimer);
    (window as unknown as { _entTimer?: number })._entTimer = window.setTimeout(
      () => setDebouncedSearch(value),
      300,
    );
  };

  const listParams: EntityListParams = {
    search: debouncedSearch || undefined,
    collection,
    sortBy,
    sortOrder,
  };

  const { data: items = [], isLoading } = useQuery({
    queryKey: [queryKey, collection, debouncedSearch, sortBy, sortOrder],
    queryFn: () => fetchList(listParams),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [queryKey] });
    queryClient.invalidateQueries({ queryKey: ["books"] });
    queryClient.invalidateQueries({ queryKey: ["admin-authors"] });
    queryClient.invalidateQueries({ queryKey: ["admin-publishers"] });
  };

  const createMutation = useMutation({
    mutationFn: () => createItem(newName.trim()),
    onSuccess: () => {
      setNewName("");
      invalidate();
      toast.success("Created");
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Create failed"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      updateItem(id, name),
    onSuccess: () => {
      setEditingId(null);
      invalidate();
      toast.success("Updated");
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Update failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteItem,
    onSuccess: () => {
      invalidate();
      toast.success("Deleted");
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Delete failed"),
  });

  const mergeMutation = useMutation({
    mutationFn: () => {
      const sourceIds = [...selectedIds].filter((id) => id !== mergeTargetId);
      return mergeItems!(mergeTargetId, sourceIds);
    },
    onSuccess: (result) => {
      setMergeOpen(false);
      setSelectedIds(new Set());
      setMergeTargetId("");
      invalidate();
      toast.success(
        `Merged ${result.mergedNames.length} ${entityLabel}(s) into one`,
      );
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Merge failed"),
  });

  const toggleSort = (column: EntitySortBy) => {
    if (sortBy === column) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortOrder(column === "name" ? "asc" : "desc");
    }
  };

  const switchCollection = (next: EntityCollection) => {
    setCollection(next);
    setSelectedIds(new Set());
    setEditingId(null);
  };

  const startEdit = (item: ManagedEntity) => {
    setEditingId(item.id);
    setEditName(item.name);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedItems = items.filter((item) => selectedIds.has(item.id));
  const canMerge = mergeItems && selectedIds.size >= 2;

  const openMerge = () => {
    if (selectedIds.size < 2) return;
    const first = selectedItems[0];
    setMergeTargetId(first?.id ?? "");
    setMergeOpen(true);
  };

  const openBooks = (item: ManagedEntity) => {
    if (item.bookCount === 0) return;
    setBooksEntity(item);
  };

  const collectionLabel =
    collection === "library" ? "My library" : "To purchase";

  return (
    <div>
      <div className="sticky top-14 z-20 -mx-4 mb-6 border-b border-gray-200/80 bg-gray-100 px-4 pb-4 md:top-16 md:-mx-8 md:px-8">
        <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
        <p className="mt-1 text-sm text-gray-600">{description}</p>

        <div
          className="mt-4 inline-flex rounded-lg border border-gray-300 bg-white p-0.5"
          role="tablist"
          aria-label="Collection"
        >
          <button
            type="button"
            role="tab"
            aria-selected={collection === "library"}
            onClick={() => switchCollection("library")}
            className={`rounded-md px-4 py-2 text-sm font-medium ${
              collection === "library"
                ? "bg-primary text-white"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            My library
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={collection === "to_purchase"}
            onClick={() => switchCollection("to_purchase")}
            className={`rounded-md px-4 py-2 text-sm font-medium ${
              collection === "to_purchase"
                ? "bg-primary text-white"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            To purchase
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <div className="relative min-w-[200px] flex-1 max-w-md">
            <Search
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              aria-hidden
            />
            <input
              type="search"
              placeholder="Search by name…"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className={`${inputClass} pl-9`}
            />
          </div>
          <form
            className="flex flex-1 gap-2 max-w-md"
            onSubmit={(e) => {
              e.preventDefault();
              if (newName.trim()) createMutation.mutate();
            }}
          >
            <input
              type="text"
              placeholder="New name…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className={inputClass}
              dir="auto"
            />
            <button
              type="submit"
              disabled={!newName.trim() || createMutation.isPending}
              className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-60"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Add
            </button>
          </form>
          {mergeItems && (
            <button
              type="button"
              disabled={!canMerge}
              onClick={openMerge}
              className="inline-flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
            >
              <GitMerge className="h-4 w-4" aria-hidden />
              Merge selected ({selectedIds.size})
            </button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="border-b bg-gray-50 text-left text-gray-600">
            <tr>
              {mergeItems && (
                <th className="w-10 px-4 py-3 font-medium">
                  <span className="sr-only">Select</span>
                </th>
              )}
              <SortableHeader
                label="Name"
                active={sortBy === "name"}
                sortOrder={sortOrder}
                onClick={() => toggleSort("name")}
              />
              <SortableHeader
                label="Books"
                active={sortBy === "bookCount"}
                sortOrder={sortOrder}
                onClick={() => toggleSort("bookCount")}
              />
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td
                  colSpan={mergeItems ? 4 : 3}
                  className="px-4 py-8 text-center text-gray-500"
                >
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && items.length === 0 && (
              <tr>
                <td
                  colSpan={mergeItems ? 4 : 3}
                  className="px-4 py-8 text-center text-gray-500"
                >
                  No {entityLabel}s with books in {collectionLabel.toLowerCase()}.
                </td>
              </tr>
            )}
            {items.map((item) => (
              <tr key={item.id} className="border-b border-gray-100">
                {mergeItems && (
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item.id)}
                      onChange={() => toggleSelect(item.id)}
                      aria-label={`Select ${item.name}`}
                    />
                  </td>
                )}
                <td className="px-4 py-3" dir="auto">
                  {editingId === item.id ? (
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className={inputClass}
                      autoFocus
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => openBooks(item)}
                      disabled={item.bookCount === 0}
                      className="text-left font-medium text-primary hover:underline disabled:cursor-default disabled:text-gray-900 disabled:no-underline"
                      dir="auto"
                      title={
                        item.bookCount > 0
                          ? `View ${item.bookCount} book(s)`
                          : "No books"
                      }
                    >
                      {item.name}
                    </button>
                  )}
                </td>
                <td className="px-4 py-3">
                  {item.bookCount > 0 ? (
                    <button
                      type="button"
                      onClick={() => openBooks(item)}
                      className="text-primary hover:underline"
                    >
                      {item.bookCount}
                    </button>
                  ) : (
                    <span className="text-gray-600">0</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    {editingId === item.id ? (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            updateMutation.mutate({
                              id: item.id,
                              name: editName,
                            })
                          }
                          className="rounded p-1.5 text-green-600 hover:bg-green-50"
                          aria-label="Save"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="rounded p-1.5 text-gray-500 hover:bg-gray-50"
                          aria-label="Cancel"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => startEdit(item)}
                          className="rounded p-1.5 text-gray-600 hover:bg-gray-50"
                          aria-label="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (item.bookCount > 0) {
                              toast.error(
                                `Cannot delete: ${item.bookCount} book(s) in ${collectionLabel.toLowerCase()} still linked.`,
                              );
                              return;
                            }
                            if (confirm(`Delete "${item.name}"?`)) {
                              deleteMutation.mutate(item.id);
                            }
                          }}
                          className="rounded p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-40"
                          aria-label="Delete"
                          disabled={item.bookCount > 0}
                          title={
                            item.bookCount > 0
                              ? "Remove books first"
                              : "Delete"
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-gray-500">
        {mergeItems
          ? "Select two or more entries to merge duplicates into one. All linked books are reassigned."
          : null}
        {mergeItems ? " " : ""}
        Showing {entityLabel}s with at least one book in{" "}
        <span className="font-medium">{collectionLabel.toLowerCase()}</span>.
        Click column headers to sort.
      </p>

      <EntityBooksModal
        entity={booksEntity}
        entityType={entityType}
        collection={collection}
        open={booksEntity !== null}
        onClose={() => setBooksEntity(null)}
      />

      {mergeOpen && mergeItems && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">
              Merge {entityLabel}s
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              Choose which name to keep. All books from the other selected{" "}
              {entityLabel}s will be reassigned, then the duplicates are removed.
            </p>
            <fieldset className="mt-4 space-y-2">
              {selectedItems.map((item) => (
                <label
                  key={item.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 hover:bg-gray-50"
                >
                  <input
                    type="radio"
                    name="merge-target"
                    checked={mergeTargetId === item.id}
                    onChange={() => setMergeTargetId(item.id)}
                  />
                  <span dir="auto">
                    {item.name}{" "}
                    <span className="text-gray-500">({item.bookCount} books)</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setMergeOpen(false)}
                disabled={mergeMutation.isPending}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!mergeTargetId || mergeMutation.isPending}
                onClick={() => mergeMutation.mutate()}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
              >
                {mergeMutation.isPending ? "Merging…" : "Merge"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
