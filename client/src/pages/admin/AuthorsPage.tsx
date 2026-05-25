import { EntityManageTable } from "@/components/admin/EntityManageTable";
import {
  fetchAuthors,
  createAuthor,
  updateAuthor,
  deleteAuthor,
} from "@/lib/entities";

export function AuthorsPage() {
  return (
    <EntityManageTable
      title="Authors"
      description="Manage authors. Names are shared across all books."
      queryKey="admin-authors-manage"
      fetchList={fetchAuthors}
      createItem={createAuthor}
      updateItem={updateAuthor}
      deleteItem={deleteAuthor}
    />
  );
}
