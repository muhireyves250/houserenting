import { AdminModal } from "@/features/admin/components/AdminModal";
import EditListingPage from "../../../listings/[id]/page";

type Props = { params: Promise<{ id: string }> };

/** A place opened from the owner's dashboard (right after listing it, its room categories): the same editor, in a window. */
export default async function EditListingModal({ params }: Props) {
  return (
    <AdminModal>
      <EditListingPage params={params} />
    </AdminModal>
  );
}
