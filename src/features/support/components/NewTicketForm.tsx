"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { AreaField, Field, SelectField } from "@/features/hosting/components/fields";
import { useRouter } from "@/i18n/navigation";
import { createTicketAction } from "../actions";
import { TICKET_CATEGORIES_LIST, type Category } from "../categories";

export function NewTicketForm({ bookingReference, bookings }: { bookingReference: string | null; bookings: { reference: string; label: string }[] }) {
  const t = useTranslations("Support");
  const router = useRouter();
  const [category, setCategory] = useState<Category>(bookingReference ? "BOOKING" : "QUESTION");
  const [booking, setBooking] = useState(bookingReference ?? "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField label={t("category")} value={category} onChange={(e) => setCategory(e.target.value as Category)}>
          {TICKET_CATEGORIES_LIST.map((c) => (
            <option key={c} value={c}>
              {t(`categories.${c}`)}
            </option>
          ))}
        </SelectField>
        <SelectField label={t("booking")} value={booking} onChange={(e) => setBooking(e.target.value)}>
          <option value="">{t("noBooking")}</option>
          {bookings.map((b) => (
            <option key={b.reference} value={b.reference}>
              {b.label}
            </option>
          ))}
        </SelectField>
      </div>
      <Field label={t("subject")} value={subject} maxLength={120} onChange={(e) => setSubject(e.target.value)} />
      <AreaField label={t("message")} value={body} maxLength={4000} rows={5} onChange={(e) => setBody(e.target.value)} />
      {failed && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {t("sendFailed")}
        </p>
      )}
      <Button
        size="lg"
        fullWidth
        loading={pending}
        disabled={subject.trim().length < 3 || body.trim().length < 2}
        onClick={() =>
          start(async () => {
            const result = await createTicketAction({ category, subject, body, bookingReference: booking || null });
            if ("reference" in result) router.push(`/support/${result.reference}`);
            else setFailed(true);
          })
        }
      >
        {t("send")}
      </Button>
    </div>
  );
}
