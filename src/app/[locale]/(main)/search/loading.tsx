import { ListSkeleton } from "@/components/ui/Skeletons";

/** Shown the first time search is opened, while results load. */
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6">
      <ListSkeleton />
    </div>
  );
}
