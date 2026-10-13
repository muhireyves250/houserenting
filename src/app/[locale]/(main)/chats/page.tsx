import { MessageSquare } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageContainer } from "@/components/ui/PageContainer";
import { requireUser } from "@/lib/session";

export default async function ChatsPage() {
  await requireUser("/chats");
  const t = await getTranslations("Empty");
  const tNav = await getTranslations("Nav");
  return (
    <PageContainer className="py-6">
      <h1 className="text-2xl font-bold tracking-[-0.02em]">{tNav("chats")}</h1>
      <EmptyState icon={<MessageSquare />} title={t("chatsTitle")} body={t("chatsBody")} />
    </PageContainer>
  );
}
