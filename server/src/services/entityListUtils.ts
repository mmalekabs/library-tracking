import type { EntityListQuery } from "../validators/entity.js";

export function sortEntities<T extends { name: string; bookCount: number }>(
  items: T[],
  query: Pick<EntityListQuery, "sortBy" | "sortOrder">,
): T[] {
  const sorted = [...items];
  sorted.sort((a, b) => {
    if (query.sortBy === "bookCount") {
      const diff = a.bookCount - b.bookCount;
      return query.sortOrder === "asc" ? diff : -diff;
    }
    const cmp = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    return query.sortOrder === "asc" ? cmp : -cmp;
  });
  return sorted;
}

export function collectionToPurchase(
  collection: EntityListQuery["collection"],
): boolean {
  return collection === "to_purchase";
}
