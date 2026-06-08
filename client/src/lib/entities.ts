import { apiFetch } from "./api";
import type { PaginatedBooks } from "./books";
import { AUTH_TOKEN_KEY } from "./constants";

export type EntityCollection = "library" | "to_purchase";
export type EntitySortBy = "name" | "bookCount";
export type EntitySortOrder = "asc" | "desc";

export interface EntityListParams {
  search?: string;
  collection?: EntityCollection;
  sortBy?: EntitySortBy;
  sortOrder?: EntitySortOrder;
}

export interface ManagedEntity {
  id: string;
  name: string;
  bookCount: number;
  createdAt?: string;
  primaryBookCount?: number;
}

function entityListQuery(params: EntityListParams = {}): string {
  const qs = new URLSearchParams();
  if (params.search?.trim()) qs.set("search", params.search.trim());
  qs.set("collection", params.collection ?? "library");
  qs.set("sortBy", params.sortBy ?? "name");
  qs.set("sortOrder", params.sortOrder ?? "asc");
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export function fetchAuthors(params: EntityListParams = {}) {
  return apiFetch<ManagedEntity[]>(`/admin/authors${entityListQuery(params)}`);
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

export function mergeAuthors(targetId: string, sourceIds: string[]) {
  return apiFetch<{
    target: ManagedEntity;
    mergedCount: number;
    mergedNames: string[];
  }>("/admin/authors/merge", {
    method: "POST",
    body: JSON.stringify({ targetId, sourceIds }),
  });
}

export function fetchPublishers(params: EntityListParams = {}) {
  return apiFetch<ManagedEntity[]>(
    `/admin/publishers${entityListQuery(params)}`,
  );
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

async function fetchEntityBooks(
  path: string,
  page = 1,
  limit = 25,
  collection?: EntityCollection,
): Promise<PaginatedBooks> {
  const API_BASE =
    import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? "/api";
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  const headers: HeadersInit = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (collection) qs.set("collection", collection);
  const response = await fetch(`${API_BASE}${path}?${qs}`, { headers });
  const json = await response.json();

  if (!response.ok || json.success === false) {
    throw new Error(json.error?.message ?? "Failed to fetch books");
  }

  return { data: json.data, pagination: json.pagination };
}

export function fetchAuthorBooks(
  authorId: string,
  page = 1,
  limit = 25,
  collection?: EntityCollection,
) {
  return fetchEntityBooks(
    `/admin/authors/${authorId}/books`,
    page,
    limit,
    collection,
  );
}

export function fetchPublisherBooks(
  publisherId: string,
  page = 1,
  limit = 25,
  collection?: EntityCollection,
) {
  return fetchEntityBooks(
    `/admin/publishers/${publisherId}/books`,
    page,
    limit,
    collection,
  );
}

export function mergePublishers(targetId: string, sourceIds: string[]) {
  return apiFetch<{
    target: ManagedEntity;
    mergedCount: number;
    mergedNames: string[];
  }>("/admin/publishers/merge", {
    method: "POST",
    body: JSON.stringify({ targetId, sourceIds }),
  });
}
