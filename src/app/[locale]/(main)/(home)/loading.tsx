import { PageSkeleton } from "@/components/ui/PageSkeleton";

/** Shown the first time the home page opens: the blue search top and rows of places. */
export default function Loading() {
  return <PageSkeleton variant="home" />;
}
