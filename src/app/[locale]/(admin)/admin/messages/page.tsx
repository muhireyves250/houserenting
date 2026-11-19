import { House, MessageSquare } from "lucide-react";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { Avatar } from "@/components/ui/Avatar";
import { Chip, FillScreen, ScrollArea, StatTiles, Toolbar } from "@/features/admin/components/kit";
import { listConversations } from "@/features/chats/service";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { requireStaff } from "@/lib/permissions";

type Props = { searchParams: Promise<{ show?: string }> };

/** Staff inbox: every client conversation (clients talk to VIIPA, never directly to owners). Waiting ones first. */
export default async function AdminMessagesPage({ searchParams }: Props) {
  const user = await requireStaff("messages", "/admin/messages");
  const waitingOnly = (await searchParams).show === "waiting";
  const [t, tAdmin, locale, chats] = await Promise.all([getTranslations("Chats"), getTranslations("Admin"), getLocale(), listConversations(user)]);
  const time = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Kigali" });
  const waiting = chats.filter((c) => c.unread);
  const sorted = waitingOnly ? waiting : [...waiting, ...chats.filter((c) => !c.unread)];
  return (
    <FillScreen>
      <Toolbar>
        <StatTiles
          items={[
            { label: t("waitingReply"), count: waiting.length, href: { pathname: "/admin/messages", query: { show: "waiting" } }, on: waitingOnly, tone: "text-primary" },
            { label: t("allConversations"), count: chats.length, href: { pathname: "/admin/messages" }, on: !waitingOnly },
          ]}
        />
      </Toolbar>
      <ScrollArea className="flex flex-col gap-5">
      {sorted.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-surface py-14 text-center ring-1 ring-line">
          <MessageSquare className="size-8 text-line-strong" aria-hidden="true" />
          <p className="text-[14px] text-muted">{tAdmin("nothingHere")}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {sorted.map((c) => (
            <li key={c.id}>
              <Link
                href={`/admin/messages/${c.id}`}
                className={cn("flex items-center gap-3 rounded-2xl bg-surface p-3.5 ring-1 transition-colors hover:ring-primary", c.unread ? "ring-primary/50" : "ring-line")}
              >
                <span className="relative shrink-0">
                  <span className="relative flex size-12 items-center justify-center overflow-hidden rounded-xl bg-primary-soft text-primary">
                    {c.listing.photo ? <Image src={c.listing.photo} alt="" fill sizes="48px" className="object-cover" /> : <House className="size-5" aria-hidden="true" />}
                  </span>
                  <Avatar name={c.other.name} image={c.other.image} className="absolute -right-1.5 -bottom-1.5 size-6 text-[9px] ring-2 ring-surface" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className={cn("truncate text-[15px] text-ink", c.unread ? "font-bold" : "font-semibold")}>{c.other.name}</span>
                    {c.last && <span className={cn("shrink-0 text-xs", c.unread ? "font-semibold text-primary" : "text-muted")}>{time.format(c.last.createdAt)}</span>}
                  </span>
                  <span className="block truncate text-xs text-muted">{c.listing.title}</span>
                  <span className="mt-0.5 flex items-center gap-2">
                    <span className={cn("min-w-0 flex-1 truncate text-[13px]", c.unread ? "font-semibold text-ink" : "text-ink/70")}>
                      {c.last ? `${c.mine ? `${t("you")}: ` : ""}${c.last.body}` : t("noMessages")}
                    </span>
                    {c.unread && <Chip tone="bg-primary text-white">{t("waitingReply")}</Chip>}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      </ScrollArea>
    </FillScreen>
  );
}
