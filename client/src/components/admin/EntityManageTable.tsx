import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Search, Trash2, X, Check } from "lucide-react";
import toast from "react-hot-toast";
import { ApiError } from "@/lib/api";
import type { ManagedEntity } from "@/lib/entities";
import { inputClass } from "./FormSection";

interface EntityManageTableProps {
  title: string;
  description: string;
  queryKey: string;
  fetchList: (search: string) => Promise<ManagedEntity[]>;
  createItem: (name: string) => Promise<ManagedEntity>;
  updateItem: (id: string, name: string) => Promise<ManagedEntity>;
  deleteItem: (id: string) => Promise<{ message: string }>;
}

export function EntityManageTable({
  title,
  description,
  queryKey,
  fetchList,
  createItem,
  updateItem,
  deleteItem,
}: EntityManageTableProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const handleSearch = (value: string) => {
    setSearch(value);
    window.clearTimeout((window as unknown as { _entTimer?: number })._entTimer);
    (window as unknown as { _entTimer?: number })._entTimer = window.setTimeout(
      () => setDebouncedSearch(value),
      300,
    );
  };

  const { data: items = [], isLoading } = useQuery({
    queryKey: [queryKey, debouncedSearch],
    queryFn: () => fetchList(debouncedSearch),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: [queryKey] });

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

  const startEdit = (item: ManagedEntity) => {
    setEditingId(item.id);
    setEditName(item.name);
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
      <p className="mt-1 text-sm text-gray-600">{description}</p>

      <div className="mt-6 flex flex-wrap gap-3">
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
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="border-b bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Books</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && items.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                  No results.
                </td>
              </tr>
            )}
            {items.map((item) => (
              <tr key={item.id} className="border-b border-gray-100">
                <td className="px-4 py-3" dir="auto">
                  {editingId === item.id ? (
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className={inputClass}
                      autoFocus
                    />
                  ) : (
                    <span className="font-medium text-gray-900">{item.name}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600">{item.bookCount}</td>
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
                                `Cannot delete: ${item.bookCount} book(s) still linked.`,
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
        Delete is only allowed when no books are linked to this entry.
      </p>
    </div>
  );
}
