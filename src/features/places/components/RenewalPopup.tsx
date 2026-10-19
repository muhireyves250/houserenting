"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, useSyncExternalStore } from "react";
import { Modal } from "@/components/ui/Modal";
import { Link } from "@/i18n/navigation";

const KEY = "sr_renewal_seen";
const noSubscribe = () => () => {};
function seenOn(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** Pops up (once a day per browser) when management agreements end within a month, so staff start renewals. */
export function RenewalPopup({ places }: { places: { id: string; title: string; contractEnd: string; owner: string }[] }) {
  const t = useTranslations("Places");
  const locale = useLocale();
  const today = new Date().toISOString().slice(0, 10);
  // On the server (and the first paint) it counts as seen, so the pop-up only appears in the browser.
  const seen = useSyncExternalStore(noSubscribe, seenOn, () => today);
  const [closed, setClosed] = useState(false);

  if (places.length === 0 || closed || seen === today) return null;
  const close = () => {
    try {
      localStorage.setItem(KEY, today);
    } catch {}
    setClosed(true);
  };
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" });
  return (
    <Modal title={t("renewalTitle")} closeLabel={t("close")} onClose={close}>
      <p className="-mt-2 mb-4 text-center text-[14px] text-muted">{t("renewalBody", { count: places.length })}</p>
      <ul className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
        {places.map((p) => (
          <li key={p.id}>
            <Link href={`/admin/listings/${p.id}`} onClick={close} className="flex flex-col rounded-xl border border-line px-3 py-2.5 hover:border-primary">
              <span className="text-[14px] font-semibold text-ink">{p.title}</span>
              <span className="text-xs text-muted">{t("renewalEnds", { date: date.format(new Date(p.contractEnd)), owner: p.owner })}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
