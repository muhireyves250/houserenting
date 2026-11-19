import { AdminModal } from "@/features/admin/components/AdminModal";
import NewListingPage from "../../../listings/new/page";

/** "Add a place" opened from a staff page: the same form, in a window over the list. */
export default async function NewListingModal() {
  return (
    <AdminModal>
      <NewListingPage />
    </AdminModal>
  );
}
