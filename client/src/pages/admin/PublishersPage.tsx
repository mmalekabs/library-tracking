import { EntityManageTable } from "@/components/admin/EntityManageTable";
import {
  fetchPublishers,
  createPublisher,
  updatePublisher,
  deletePublisher,
} from "@/lib/entities";

export function PublishersPage() {
  return (
    <EntityManageTable
      title="Publishers"
      description="Manage publishers. Delete is blocked while books still reference a publisher."
      queryKey="admin-publishers-manage"
      fetchList={fetchPublishers}
      createItem={createPublisher}
      updateItem={updatePublisher}
      deleteItem={deletePublisher}
    />
  );
}
