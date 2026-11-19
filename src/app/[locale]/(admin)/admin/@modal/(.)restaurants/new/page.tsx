import { AdminModal } from "@/features/admin/components/AdminModal";
import NewRestaurantPage from "../../../restaurants/new/page";

/** "Add a restaurant" opened from a staff page: the same form, in a window over the list. */
export default async function NewRestaurantModal() {
  return (
    <AdminModal>
      <NewRestaurantPage />
    </AdminModal>
  );
}
