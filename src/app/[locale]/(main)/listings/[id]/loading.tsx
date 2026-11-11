import { PageSkeleton } from "@/components/ui/PageSkeleton";

/** Shown instantly when a place is opened, while it loads. */
export default function Loading() {
  return <PageSkeleton variant="listing" />;
}
