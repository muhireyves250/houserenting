import { DashSkeleton } from "@/components/ui/DashSkeleton";
import { PageContainer } from "@/components/ui/PageContainer";

/** Shown the first time a conversation opens: its header, messages and answer box. */
export default function Loading() {
  return (
    <PageContainer className="max-w-3xl py-6 md:py-8">
      <DashSkeleton shape="chat" />
    </PageContainer>
  );
}
