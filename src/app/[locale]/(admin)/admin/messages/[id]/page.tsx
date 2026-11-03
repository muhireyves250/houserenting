import Image from "next/image";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { PageIntro } from "@/features/admin/components/ui";
import { Composer } from "@/features/chats/components/Composer";
import { ScrollToEnd } from "@/features/chats/components/ScrollToEnd";
import { openConversation } from "@/features/chats/service";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { requireAdmin } from "@/lib/permissions";

type Props = { params: Promise<{ id: string }> };

/** A client conversation for staff: everything the client wrote, and the team's answers (each with who sent it). */
export default async function AdminConversationPage({ params }: Props) {
  const { id } = await params;
  const user = await requireAdmin(`/admin/messages/${id}`);
  const chat = await openConversation(user, id);
  if (!chat) notFound();
  const [t, locale] = await Promise.all([getTranslations("Chats"), getLocale()]);
  const time = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Kigali" });
  return (
    <div className="flex max-w-3xl flex-col">
      <PageIntro back={{ href: "/admin/messages", label: t("staffInbox") }} />
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
        <span className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-primary-soft">
          {chat.listing.photos[0] && <Image src={chat.listing.photos[0].url} alt="" fill sizes="48px" className="object-cover" />}
        </span>
        <div className="min-w-0 flex-1">
          <Link href={`/admin/users/${chat.guestId}`} className="block truncate text-[15px] font-semibold text-primary hover:underline">
            {chat.guest.name}
          </Link>
          <Link href={`/admin/listings/${chat.listing.id}`} className="block truncate text-[13px] text-muted hover:text-primary">
            {chat.listing.title}
          </Link>
        </div>
      </div>
      <ol className="flex flex-col gap-2 pt-4">
        {chat.messages.length === 0 && <li className="py-8 text-center text-[14px] text-muted">{t("noMessages")}</li>}
        {chat.messages.map((m) => (
          <li key={m.id} className={cn("flex", m.mine ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[80%] rounded-2xl px-4 py-2.5 text-[15px] leading-6 whitespace-pre-line", m.mine ? "rounded-br-md bg-primary text-white" : "rounded-bl-md bg-surface text-ink ring-1 ring-line")}>
              {m.body}
              <span className={cn("mt-0.5 block text-right text-[11px]", m.mine ? "text-white/75" : "text-muted")}>
                {m.mine ? `${m.sender.name} · ` : ""}
                {time.format(m.createdAt)}
              </span>
            </div>
          </li>
        ))}
      </ol>
      <ScrollToEnd count={chat.messages.length} />
      <Composer conversationId={chat.id} />
    </div>
  );
}
