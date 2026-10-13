import { MessageSquare } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageContainer } from "@/components/ui/PageContainer";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/session";

export default async function ChatsPage() {
  await requireUser("/chats");
  const t = await getTranslations("Empty");
  const tNav = await getTranslations("Nav");
  const tFooter = await getTranslations("Footer");
  return (
    <PageContainer className="py-6">
      <h1 className="text-[32px] leading-10 font-bold tracking-[-0.03em]">{tNav("chats")}</h1>
      <EmptyState icon={<MessageSquare />} title={t("chatsTitle")} body={t("chatsBody")}
          action={<Link
            href="/"
            className="inline-flex items-center rounded-xl bg-primary px-7 py-3.5 text-[15px] font-semibold text-white shadow-[0_10px_24px_-10px_rgba(0,87,184,0.8)] transition-transform active:scale-[0.97]"
          >
            {tFooter("startSearching")}
          </Link>}
        />
    </PageContainer>
  );
}
