"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { STAFF_AREAS, type StaffArea } from "@/lib/roles";
import { setStaffAreasAction } from "../actions";

/** Tick what an admin may manage; saved with one button. Read-only for staff who can't manage staff. */
export function StaffAreasForm({ userId, initial, canManage }: { userId: string; initial: readonly string[]; canManage: boolean }) {
  const t = useTranslations("Admin");
  const router = useRouter();
  const [areas, setAreas] = useState<StaffArea[]>(STAFF_AREAS.filter((a) => initial.includes(a)));
  const [pending, start] = useTransition();
  const [state, setState] = useState<"idle" | "saved" | "failed">("idle");
  const changed = areas.length !== initial.length || areas.some((a) => !initial.includes(a));

  const toggle = (area: StaffArea) => {
    setState("idle");
    setAreas((now) => (now.includes(area) ? now.filter((a) => a !== area) : STAFF_AREAS.filter((a) => a === area || now.includes(a))));
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] text-muted">{t("areasIntro")}</p>
      <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-1">
        {STAFF_AREAS.map((area) => {
          const on = areas.includes(area);
          return (
            <li key={area}>
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                disabled={!canManage || pending}
                onClick={() => toggle(area)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[14px] ring-1 transition-colors disabled:cursor-default",
                  on ? "bg-primary/[0.07] font-semibold text-ink ring-primary/40" : "text-ink/75 ring-line",
                  canManage && "hover:ring-primary",
                )}
              >
                <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-md ring-1", on ? "bg-primary text-white ring-primary" : "bg-surface ring-line-strong")}>
                  {on && <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />}
                </span>
                {t(`areas.${area}`)}
              </button>
            </li>
          );
        })}
      </ul>
      {canManage ? (
        <div className="flex items-center justify-end gap-3">
          {state === "saved" && <span role="status" className="text-[13px] text-emerald-700">{t("areasSaved")}</span>}
          {state === "failed" && <span role="alert" className="text-[13px] text-danger">{t("areasFailed")}</span>}
          <button
            type="button"
            disabled={!changed || pending}
            onClick={() =>
              start(async () => {
                const { ok } = await setStaffAreasAction(userId, areas);
                setState(ok ? "saved" : "failed");
                if (ok) router.refresh();
              })
            }
            className="rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-white hover:bg-primary-hover disabled:opacity-40"
          >
            {t("areasSave")}
          </button>
        </div>
      ) : (
        <p className="text-xs text-muted">{t("superAdminOnly")}</p>
      )}
    </div>
  );
}
