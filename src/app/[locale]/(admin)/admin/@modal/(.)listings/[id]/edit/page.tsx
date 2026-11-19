import { AdminModal } from "@/features/admin/components/AdminModal";
import EditListingPage from "../../../../listings/[id]/edit/page";

type Props = { params: Promise<{ id: string }> };

/** "Edit" a place opened from a staff page: the same editor, in a window over the list. */
export default async function EditListingModal({ params }: Props) {
  return (
    <AdminModal>
      <EditListingPage params={params} />
    </AdminModal>
  );
}
