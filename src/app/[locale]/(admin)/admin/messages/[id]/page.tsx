import { House, Mail, Phone } from "lucide-react";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { PageIntro } from "@/features/admin/components/ui";
import { StatusBadge } from "@/features/bookings/components/StatusBadge";
import { formatStayDates } from "@/features/bookings/format";
import { Composer } from "@/features/chats/components/Composer";
import { ScrollToEnd } from "@/features/chats/components/ScrollToEnd";
import { openConversation } from "@/features/chats/service";
import { roomLabel } from "@/features/rooms/links";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/permissions";

type Props = { params: Promise<{ id: string }> };
const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * A client conversation for staff: the messages and the answer box; beside them (above on phones) who the client is,
 * how to call them, and their latest bookings.
 */
export default async function AdminConversationPage({ params }: Props) {
  const { id } = await params;
  const user = await requireStaff("messages", `/admin/messages/${id}`);
  const chat = await openConversation(user, id);
  if (!chat) notFound();
  const [t, tAdmin, tBookings, tRooms, locale, guest] = await Promise.all([
    getTranslations("Chats"),
    getTranslations("Admin"),
    getTranslations("Bookings"),
    getTranslations("Rooms"),
    getLocale(),
    db.user.findUnique({
      where: { id: chat.guestId },
      select: {
        email: true,
        phone: true,
        bookings: { orderBy: { checkIn: "desc" }, take: 4, select: { reference: true, status: true, checkIn: true, checkOut: true, roomNumber: true, room: { select: { name: true } }, listing: { select: { title: true } } } },
      },
    }),
  ]);
  const time = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Kigali" });
  return (
    <div className="flex flex-col">
      <PageIntro back={{ href: "/admin/messages", label: t("staffInbox") }} />
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Who this is: above the chat on phones, beside it on computers. */}
        <aside className="flex min-w-0 flex-col gap-3 rounded-2xl bg-surface p-4 ring-1 ring-line lg:sticky lg:top-24 lg:order-2">
          <div className="flex items-center gap-3">
            <span className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary-soft text-primary">
              {chat.listing.photos[0] ? <Image src={chat.listing.photos[0].url} alt="" fill sizes="48px" className="object-cover" /> : <House className="size-5" aria-hidden="true" />}
            </span>
            <div className="min-w-0 flex-1">
              <Link href={`/admin/users/${chat.guestId}`} className="block truncate text-[16px] font-bold text-ink hover:text-primary">
                {chat.guest.name}
              </Link>
              <Link href={`/admin/listings/${chat.listing.id}`} className="block truncate text-[13px] text-muted hover:text-primary">
                {chat.listing.title}
              </Link>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-[13px]">
            {guest?.phone && (
              <a href={`tel:${guest.phone}`} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 font-semibold text-white hover:bg-primary-hover">
                <Phone className="size-3.5" aria-hidden="true" />
                {guest.phone}
              </a>
            )}
            {guest?.email && (
              <a href={`mailto:${guest.email}`} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 font-semibold text-ink hover:border-primary">
                <Mail className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{guest.email}</span>
              </a>
            )}
          </div>
          {guest && guest.bookings.length > 0 && (
            <div className="border-t border-line pt-3">
              <p className="mb-2 text-[12px] font-semibold text-muted">{tAdmin("nav.bookings")}</p>
              <ul className="flex flex-col gap-2">
                {guest.bookings.map((b) => (
                  <li key={b.reference}>
                    <Link href={`/admin/bookings/${b.reference}`} className="flex flex-col gap-0.5 rounded-xl bg-canvas px-3 py-2 text-[13px] hover:ring-1 hover:ring-primary">
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-mono font-semibold text-primary">{b.reference}</span>
                        <StatusBadge status={b.status} label={tBookings(`status.${b.status}`)} />
                      </span>
                      <span className="truncate text-ink">
                        {b.listing.title}
                        {b.room && ` · ${[b.room.name, b.roomNumber && roomLabel(b.roomNumber, (number) => tRooms("roomNumber", { number }))].filter(Boolean).join(" ")}`}
                      </span>
                      <span className="text-muted">{formatStayDates(locale, iso(b.checkIn), iso(b.checkOut))}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>

        <div className="flex min-w-0 flex-col lg:order-1">
          <ol className="flex flex-col gap-2">
            {chat.messages.length === 0 && <li className="py-8 text-center text-[14px] text-muted">{t("noMessages")}</li>}
            {chat.messages.map((m) => (
              <li key={m.id} className={cn("flex", m.mine ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] leading-6 whitespace-pre-line md:max-w-[75%]", m.mine ? "rounded-br-md bg-primary text-white" : "rounded-bl-md bg-surface text-ink ring-1 ring-line")}>
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
          {/* The answer box stays at the bottom of the screen while scrolling. */}
          <Composer conversationId={chat.id} />
        </div>
      </div>
    </div>
  );
}
