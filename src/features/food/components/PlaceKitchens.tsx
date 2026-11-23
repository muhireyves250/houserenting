"use client";

import { Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Select } from "@/components/ui/Select";
import { Link, useRouter } from "@/i18n/navigation";
import { setPlaceKitchensAction } from "../actions";

type Kitchen = { id: string; name: string; live: boolean };

/**
 * The restaurants that cook for guests at this place (VIIPA sets them; several are fine). Guests see one menu with
 * all their dishes and never the restaurant names; each restaurant gets the orders for its own dishes.
 */
export function PlaceKitchens({ listingId, assigned, all }: { listingId: string; assigned: Kitchen[]; all: Kitchen[] }) {
  const t = useTranslations("Food.placeKitchens");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pick, setPick] = useState("");
  const [error, setError] = useState(false);
  const others = all.filter((r) => !assigned.some((a) => a.id === r.id));

  const save = (ids: string[]) =>
    start(async () => {
      const ok = await setPlaceKitchensAction(listingId, ids);
      setError(!ok);
      if (ok) {
        setPick("");
        router.refresh();
      }
    });

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] text-muted">{t("intro")}</p>
      {assigned.length === 0 ? (
        <p className="text-[13px] font-medium text-amber-800">{t("none")}</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {assigned.map((r) => (
            <li key={r.id} className="inline-flex items-center gap-1.5 rounded-full bg-canvas py-1 pr-1 pl-3 text-[13px] text-ink ring-1 ring-line">
              <Link href={`/admin/restaurants/${r.id}`} className="font-semibold hover:text-primary">
                {r.name}
              </Link>
              {!r.live && <span className="text-[11px] text-muted">· {t("notLive")}</span>}
              <button type="button" disabled={pending} aria-label={t("remove", { name: r.name })} onClick={() => save(assigned.filter((a) => a.id !== r.id).map((a) => a.id))} className="flex size-6 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-danger">
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {others.length > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select aria-label={t("choose")} value={pick} onChange={(e) => setPick(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-line-strong bg-surface px-3 py-2 text-[14px] text-ink">
            <option value="">{t("choose")}</option>
            {others.map((r) => (
              <option key={r.id} value={r.id}>
                {r.live ? r.name : `${r.name} · ${t("notLive")}`}
              </option>
            ))}
          </Select>
          <button type="button" disabled={!pick || pending} onClick={() => save([...assigned.map((a) => a.id), pick])} className="inline-flex shrink-0 items-center justify-center gap-1 rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-white hover:bg-primary-hover disabled:opacity-50">
            <Plus className="size-4" aria-hidden="true" />
            {t("add")}
          </button>
        </div>
      )}
      {error && <p className="text-[13px] font-medium text-danger">{t("failed")}</p>}
    </div>
  );
}
