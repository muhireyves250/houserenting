import { DashSkeleton } from "@/components/ui/DashSkeleton";

/** Shown the first time this page opens, laid out like it, while its data loads. */
export default function Loading() {
  return <DashSkeleton shape="tabsCards" />;
}
