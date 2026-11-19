import { ChevronDown, ChevronLeft, House, Mail, Phone } from "lucide-react";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
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
 * A client conversation for staff, fitting the screen: the messages and the answer box; beside them (folded under the
 * name on phones) how to reach the client and their latest bookings.
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
  const call = guest?.phone && (
    <a href={`tel:${guest.phone}`} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-[13px] font-semibold text-white hover:bg-primary-hover">
      <Phone className="size-3.5" aria-hidden="true" />
      <span className="max-sm:hidden">{guest.phone}</span>
    </a>
  );
  const details = (
    <>
      {guest?.email && (
        <a href={`mailto:${guest.email}`} className="inline-flex max-w-full items-center gap-1.5 self-start rounded-full border border-line px-3.5 py-1.5 text-[13px] font-semibold text-ink hover:border-primary">
          <Mail className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{guest.email}</span>
        </a>
      )}
      {guest && guest.bookings.length > 0 && (
        <div>
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
    </>
  );

  return (
    // The whole conversation fits the screen: the messages scroll inside their box, the answer box stays at its foot.
    <div className="grid h-[calc(100dvh-64px-48px)] min-h-[26rem] grid-cols-[minmax(0,1fr)] gap-4 md:h-[calc(100dvh-64px-64px)] lg:grid-cols-[minmax(0,1fr)_300px]">
      <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
        {/* Who this is, in one line; their email and bookings fold open on phones (beside the chat on computers). */}
        <header className="shrink-0 border-b border-line">
          <div className="flex items-center gap-3 px-3 py-2.5 md:px-4">
            <Link href="/admin/messages" aria-label={t("staffInbox")} className="flex size-9 shrink-0 items-center justify-center rounded-full text-ink hover:bg-canvas">
              <ChevronLeft className="size-5" aria-hidden="true" />
            </Link>
            <span className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary-soft text-primary">
              {chat.listing.photos[0] ? <Image src={chat.listing.photos[0].url} alt="" fill sizes="40px" className="object-cover" /> : <House className="size-5" aria-hidden="true" />}
            </span>
            <div className="min-w-0 flex-1">
              <Link href={`/admin/users/${chat.guestId}`} className="block truncate text-[15px] font-bold text-ink hover:text-primary">
                {chat.guest.name}
              </Link>
              <Link href={`/admin/listings/${chat.listing.id}`} className="block truncate text-[12px] text-muted hover:text-primary">
                {chat.listing.title}
              </Link>
            </div>
            {call}
          </div>
          {(guest?.email || (guest && guest.bookings.length > 0)) && (
            <details className="group border-t border-line lg:hidden">
              <summary className="list-none px-4 py-2 text-[12px] font-semibold text-primary [&::-webkit-details-marker]:hidden">
                <span className="inline-flex items-center gap-1">
                  {tAdmin("clientDetails")}
                  <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" aria-hidden="true" />
                </span>
              </summary>
              <div className="no-scrollbar flex max-h-[40dvh] flex-col gap-3 overflow-y-auto px-4 pb-3">{details}</div>
            </details>
          )}
        </header>

        <ol id="chat-messages" className="no-scrollbar flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain bg-canvas/50 px-3 py-4 md:px-5">
          {chat.messages.length === 0 && <li className="m-auto text-center text-[14px] text-muted">{t("noMessages")}</li>}
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
        <ScrollToEnd count={chat.messages.length} targetId="chat-messages" />
        <div className="shrink-0 border-t border-line px-2 pb-2 [&>div]:static [&>div]:mt-2">
          <Composer conversationId={chat.id} />
        </div>
      </section>

      {/* Computers: who the client is, beside the chat. */}
      <aside className="no-scrollbar hidden min-h-0 flex-col gap-4 overflow-y-auto rounded-2xl bg-surface p-4 ring-1 ring-line lg:flex">
        <p className="text-[13px] font-semibold text-muted">{tAdmin("clientDetails")}</p>
        {guest?.phone && (
          <a href={`tel:${guest.phone}`} className="inline-flex items-center gap-1.5 self-start rounded-full bg-primary px-3.5 py-1.5 text-[13px] font-semibold text-white hover:bg-primary-hover">
            <Phone className="size-3.5" aria-hidden="true" />
            {guest.phone}
          </a>
        )}
        {details}
      </aside>
    </div>
  );
}
