import { House, MessageSquare } from "lucide-react";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageContainer } from "@/components/ui/PageContainer";
import { listConversations } from "@/features/chats/service";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { requireUser } from "@/lib/session";

/** "12:40" today, otherwise "Oct 12". */
function when(locale: string, at: Date, now: Date) {
  const sameDay = at.toDateString() === now.toDateString();
  return new Intl.DateTimeFormat(locale, sameDay ? { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Kigali" } : { month: "short", day: "numeric", timeZone: "Africa/Kigali" }).format(at);
}

export default async function ChatsPage() {
  const user = await requireUser("/chats");
  const [t, tNav, tEmpty, tFooter, locale, chats] = await Promise.all([
    getTranslations("Chats"),
    getTranslations("Nav"),
    getTranslations("Empty"),
    getTranslations("Footer"),
    getLocale(),
    listConversations(user.id),
  ]);
  const now = new Date();

  return (
    <PageContainer className="max-w-3xl pt-5 pb-10 md:py-10">
      <h1 className="mb-1 text-[26px] leading-8 font-bold tracking-[-0.03em] md:text-[32px] md:leading-10">{tNav("chats")}</h1>
      <p className="mb-5 text-[14px] text-muted">{t("listIntro")}</p>
      {chats.length === 0 ? (
        <EmptyState
          icon={<MessageSquare />}
          title={tEmpty("chatsTitle")}
          body={tEmpty("chatsBody")}
          action={
            <Link
              href="/"
              className="inline-flex items-center rounded-xl bg-primary px-7 py-3.5 text-[15px] font-semibold text-white shadow-[0_10px_24px_-10px_rgba(0,87,184,0.8)] transition-transform active:scale-[0.97]"
            >
              {tFooter("startSearching")}
            </Link>
          }
        />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-3xl bg-surface shadow-[0_10px_30px_-14px_rgba(16,24,40,0.3)] ring-1 ring-black/[0.04] max-md:ring-line">
          {chats.map((chat) => (
            <li key={chat.id}>
              <Link href={`/chats/${chat.id}`} className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-canvas active:bg-canvas">
                {/* The place first (guests think by place), with the person's photo on its corner. */}
                <span className="relative shrink-0">
                  <span className="relative flex size-14 items-center justify-center overflow-hidden rounded-2xl bg-primary-soft text-primary">
                    {chat.listing.photo ? <Image src={chat.listing.photo} alt="" fill sizes="56px" className="object-cover" /> : <House className="size-6" aria-hidden="true" />}
                  </span>
                  <Avatar name={chat.other.name} image={chat.other.image} className="absolute -right-1.5 -bottom-1.5 size-7 text-[10px] ring-2 ring-surface" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={cn("truncate text-[15px] text-ink", chat.unread ? "font-bold" : "font-semibold")}>{chat.other.name}</span>
                    {chat.last && <span className={cn("shrink-0 text-xs", chat.unread ? "font-semibold text-primary" : "text-muted")}>{when(locale, chat.last.createdAt, now)}</span>}
                  </span>
                  <span className="truncate text-xs text-muted">
                    {chat.role === "host" ? t("aboutYourPlace", { title: chat.listing.title }) : chat.listing.title}
                  </span>
                  <span className={cn("truncate text-[13px]", chat.unread ? "font-semibold text-ink" : "text-ink/70")}>
                    {chat.last ? `${chat.last.senderId === user.id ? `${t("you")}: ` : ""}${chat.last.body}` : t("noMessages")}
                  </span>
                </span>
                {chat.unread && <span className="size-2.5 shrink-0 rounded-full bg-primary" aria-label={t("unread")} />}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  );
}
