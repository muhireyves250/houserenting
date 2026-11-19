import { PageSkeleton } from "@/components/ui/PageSkeleton";

/** Shown the first time this page opens, laid out like it, while it loads. */
export default function Loading() {
  return <PageSkeleton variant="listing" />;
}
