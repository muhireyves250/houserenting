import { House, MessageSquare } from "lucide-react";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { Avatar } from "@/components/ui/Avatar";
import { PageIntro, Panel } from "@/features/admin/components/ui";
import { listConversations } from "@/features/chats/service";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { requireAdmin } from "@/lib/permissions";

/** Staff inbox: every client conversation (clients talk to VIIPA, never directly to owners). Unanswered ones first. */
export default async function AdminMessagesPage() {
  const user = await requireAdmin("/admin/messages");
  const [t, tAdmin, locale, chats] = await Promise.all([getTranslations("Chats"), getTranslations("Admin"), getLocale(), listConversations(user)]);
  const time = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Kigali" });
  const sorted = [...chats.filter((c) => c.unread), ...chats.filter((c) => !c.unread)];
  return (
    <div className="flex flex-col gap-5">
      <PageIntro description={t("staffIntro")} />
      <Panel flush>
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-14 text-center">
            <MessageSquare className="size-8 text-line-strong" aria-hidden="true" />
            <p className="text-[14px] text-muted">{tAdmin("nothingHere")}</p>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {sorted.map((c) => (
              <li key={c.id}>
                <Link href={`/admin/messages/${c.id}`} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-canvas">
                  <span className="relative shrink-0">
                    <span className="relative flex size-12 items-center justify-center overflow-hidden rounded-xl bg-primary-soft text-primary">
                      {c.listing.photo ? <Image src={c.listing.photo} alt="" fill sizes="48px" className="object-cover" /> : <House className="size-5" aria-hidden="true" />}
                    </span>
                    <Avatar name={c.other.name} image={c.other.image} className="absolute -right-1.5 -bottom-1.5 size-6 text-[9px] ring-2 ring-surface" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={cn("truncate text-[15px] text-ink", c.unread ? "font-bold" : "font-semibold")}>{c.other.name}</span>
                      {c.last && <span className={cn("shrink-0 text-xs", c.unread ? "font-semibold text-primary" : "text-muted")}>{time.format(c.last.createdAt)}</span>}
                    </span>
                    <span className="block truncate text-xs text-muted">{c.listing.title}</span>
                    <span className={cn("block truncate text-[13px]", c.unread ? "font-semibold text-ink" : "text-ink/70")}>
                      {c.last ? `${c.mine ? `${t("you")}: ` : ""}${c.last.body}` : t("noMessages")}
                    </span>
                  </span>
                  {c.unread && <span className="size-2.5 shrink-0 rounded-full bg-primary" aria-label={t("unread")} />}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
