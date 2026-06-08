import { EntityManageTable } from "@/components/admin/EntityManageTable";
import {
  fetchPublishers,
  createPublisher,
  updatePublisher,
  deletePublisher,
  mergePublishers,
} from "@/lib/entities";

export function PublishersPage() {
  return (
    <EntityManageTable
      title="Publishers"
      entityLabel="publisher"
      description="Manage publishers. Merge duplicates to combine books under one name."
      queryKey="admin-publishers-manage"
      fetchList={fetchPublishers}
      createItem={createPublisher}
      updateItem={updatePublisher}
      deleteItem={deletePublisher}
      mergeItems={mergePublishers}
    />
  );
}
