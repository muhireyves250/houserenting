import { AdminModal } from "@/features/admin/components/AdminModal";
import NewListingPage from "../../../listings/new/page";

/** "List a place" opened from the owner's dashboard: the same form, in a window over the current page. */
export default async function NewListingModal() {
  return (
    <AdminModal>
      <NewListingPage />
    </AdminModal>
  );
}
