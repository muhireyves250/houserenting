import { DashSkeleton } from "@/components/ui/DashSkeleton";

/** Shown the first time a promo code opens, while it loads. */
export default function Loading() {
  return <DashSkeleton shape="detail" />;
}
