import { formatKigaliDateTime } from "@/features/bookings/format";
import { cn } from "@/lib/cn";

type Message = { id: string; body: string; fromStaff: boolean; createdAt: Date; author: { name: string } };

/** The conversation: the customer on one side, staff on the other (from the viewer's point of view). */
export function TicketThread({ messages, locale, viewerIsStaff, staffLabel }: { messages: Message[]; locale: string; viewerIsStaff: boolean; staffLabel: string }) {
  return (
    <ol className="flex flex-col gap-3">
      {messages.map((m) => {
        const mine = m.fromStaff === viewerIsStaff;
        return (
          <li key={m.id} className={cn("flex flex-col gap-1", mine ? "items-end" : "items-start")}>
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-3 text-[15px] leading-6 whitespace-pre-line",
                mine ? "rounded-br-md bg-primary text-white" : "rounded-bl-md bg-surface text-ink ring-1 ring-line",
              )}
            >
              {m.body}
            </div>
            <span className="text-xs text-muted">
              {m.fromStaff ? staffLabel : m.author.name} · {formatKigaliDateTime(locale, m.createdAt)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
