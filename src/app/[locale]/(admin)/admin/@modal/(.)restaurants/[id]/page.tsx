import { AdminModal } from "@/features/admin/components/AdminModal";
import RestaurantPage from "../../../restaurants/[id]/page";

type Props = { params: Promise<{ id: string }> };

/** A restaurant opened from the list (edit, menu, team): the same page, in a window over the list. */
export default async function RestaurantModal({ params }: Props) {
  return (
    <AdminModal>
      <RestaurantPage params={params} />
    </AdminModal>
  );
}
