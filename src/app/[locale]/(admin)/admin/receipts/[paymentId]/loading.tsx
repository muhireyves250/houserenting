import { DashSkeleton } from "@/components/ui/DashSkeleton";

/** Shown the first time a receipt opens, while it loads. */
export default function Loading() {
  return <DashSkeleton shape="form" />;
}
