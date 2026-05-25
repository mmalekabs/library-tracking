import { apiFetch } from "./api";

export interface ManagedEntity {
  id: string;
  name: string;
  bookCount: number;
  createdAt?: string;
  primaryBookCount?: number;
}

export function fetchAuthors(search = "") {
  const q = search ? `?search=${encodeURIComponent(search)}` : "";
  return apiFetch<ManagedEntity[]>(`/admin/authors${q}`);
}

export function createAuthor(name: string) {
  return apiFetch<ManagedEntity>("/admin/authors", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function updateAuthor(id: string, name: string) {
  return apiFetch<ManagedEntity>(`/admin/authors/${id}`, {
    method: "PUT",
    body: JSON.stringify({ name }),
  });
}

export function deleteAuthor(id: string) {
  return apiFetch<{ message: string }>(`/admin/authors/${id}`, {
    method: "DELETE",
  });
}

export function fetchPublishers(search = "") {
  const q = search ? `?search=${encodeURIComponent(search)}` : "";
  return apiFetch<ManagedEntity[]>(`/admin/publishers${q}`);
}

export function createPublisher(name: string) {
  return apiFetch<ManagedEntity>("/admin/publishers", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function updatePublisher(id: string, name: string) {
  return apiFetch<ManagedEntity>(`/admin/publishers/${id}`, {
    method: "PUT",
    body: JSON.stringify({ name }),
  });
}

export function deletePublisher(id: string) {
  return apiFetch<{ message: string }>(`/admin/publishers/${id}`, {
    method: "DELETE",
  });
}
