import { apiFetch } from "./api";

export interface NamedEntity {
  id: string;
  name: string;
}

/** Lightweight list for book form autocomplete */
export function fetchAdminAuthors(search = "") {
  const q = search ? `?search=${encodeURIComponent(search)}` : "";
  return apiFetch<NamedEntity[]>(`/admin/lookup/authors${q}`);
}

export function fetchAdminPublishers(search = "") {
  const q = search ? `?search=${encodeURIComponent(search)}` : "";
  return apiFetch<NamedEntity[]>(`/admin/lookup/publishers${q}`);
}

