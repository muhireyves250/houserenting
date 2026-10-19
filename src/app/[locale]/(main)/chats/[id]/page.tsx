import { ArrowLeft, House } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Avatar } from "@/components/ui/Avatar";
import { PageContainer } from "@/components/ui/PageContainer";
import { Composer } from "@/features/chats/components/Composer";
import { ScrollToEnd } from "@/features/chats/components/ScrollToEnd";
import { openConversation } from "@/features/chats/service";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { requireUser } from "@/lib/session";

type Props = { params: Promise<{ id: string }> };
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function ConversationPage({ params }: Props) {
  const { id } = await params;
  const user = await requireUser(`/chats/${id}`);
  const chat = await openConversation(user.id, id);
  if (!chat) notFound();
  const [t, tNav, locale] = await Promise.all([getTranslations("Chats"), getTranslations("Nav"), getLocale()]);
  const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Kigali" });
  const day = new Intl.DateTimeFormat(locale, { weekday: "short", month: "short", day: "numeric", timeZone: "Africa/Kigali" });
  const dayOf = (d: Date) => day.format(d);

  return (
    <PageContainer className="-mb-24 flex min-h-dvh max-w-3xl flex-col pb-2 md:mb-0 md:min-h-0 md:py-8">
      {/* Who and which place */}
      <div className="sticky top-0 z-20 -mx-4 flex items-center gap-3 border-b border-line bg-canvas/95 px-4 py-2.5 backdrop-blur md:top-[73px] md:mx-0 md:rounded-2xl md:border md:bg-surface md:py-3">
        <Link href="/chats" aria-label={tNav("chats")} className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-ink shadow-sm transition-transform active:scale-90 md:bg-canvas">
          <ArrowLeft className="size-5" aria-hidden="true" />
        </Link>
        <Avatar name={chat.other.name} image={chat.other.image} className="size-10 text-sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-ink">{chat.other.name}</p>
          <p className="truncate text-xs text-muted">
            {chat.role === "guest" ? t("host") : t("guest")} · {chat.listing.title}
          </p>
        </div>
        <Link href={`/listings/${chat.listing.id}`} aria-label={chat.listing.title} className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary-soft text-primary ring-1 ring-line">
          {chat.listing.photos[0] ? <Image src={chat.listing.photos[0].url} alt="" fill sizes="40px" className="object-cover" /> : <House className="size-4" aria-hidden="true" />}
        </Link>
      </div>

      {/* Messages */}
      <ol className="flex flex-1 flex-col gap-1.5 pt-4">
        {chat.messages.length === 0 && <li className="py-10 text-center text-[15px] text-muted">{t("startHint", { name: chat.other.name.split(" ")[0] ?? "" })}</li>}
        {chat.messages.map((m, i) => {
          const mine = m.senderId === user.id;
          const newDay = i === 0 || dayOf(chat.messages[i - 1]!.createdAt) !== dayOf(m.createdAt);
          return (
            <li key={m.id} className="flex flex-col">
              {newDay && <span className="my-3 self-center rounded-full bg-surface px-3 py-1 text-xs font-medium text-muted ring-1 ring-line">{dayOf(m.createdAt)}</span>}
              <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-2.5 text-[15px] leading-6 whitespace-pre-line",
                    mine ? "rounded-br-md bg-primary text-white" : "rounded-bl-md bg-surface text-ink ring-1 ring-line",
                  )}
                >
                  {m.body}
                  <span className={cn("mt-0.5 block text-right text-[11px]", mine ? "text-white/70" : "text-muted")}>{time.format(m.createdAt)}</span>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <ScrollToEnd count={chat.messages.length} />
      <Composer conversationId={chat.id} />
    </PageContainer>
  );
}
