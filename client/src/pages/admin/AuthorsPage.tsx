import { EntityManageTable } from "@/components/admin/EntityManageTable";
import {
  fetchAuthors,
  createAuthor,
  updateAuthor,
  deleteAuthor,
  mergeAuthors,
} from "@/lib/entities";

export function AuthorsPage() {
  return (
    <EntityManageTable
      title="Authors"
      entityLabel="author"
      entityType="author"
      description="Manage authors by collection. Merge duplicates to combine books under one name."
      queryKey="admin-authors-manage"
      fetchList={fetchAuthors}
      createItem={createAuthor}
      updateItem={updateAuthor}
      deleteItem={deleteAuthor}
      mergeItems={mergeAuthors}
    />
  );
}
