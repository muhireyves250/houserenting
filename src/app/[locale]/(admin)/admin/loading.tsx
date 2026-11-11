import { PageSkeleton } from "@/components/ui/PageSkeleton";

/** Shown instantly when an admin page is opened, while it loads. */
export default function Loading() {
  return <PageSkeleton variant="admin" />;
}
