"use client";

import { Baby, Minus, PawPrint, Plus, Users, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { canStep, stepGuests, type GuestCounts, type GuestKey } from "@/features/search/guests";

const ROWS: { key: GuestKey; label: "adults" | "children" | "pets"; hint: "adultsHint" | "childrenHint" | "petsHint"; icon: LucideIcon }[] = [
  { key: "adults", label: "adults", hint: "adultsHint", icon: Users },
  { key: "children", label: "children", hint: "childrenHint", icon: Baby },
  { key: "pets", label: "pets", hint: "petsHint", icon: PawPrint },
];

export function GuestPanel({ counts, onChange }: { counts: GuestCounts; onChange: (counts: GuestCounts) => void }) {
  const t = useTranslations("Home");

  return (
    <ul className="flex flex-col divide-y divide-line">
      {ROWS.map(({ key, label, hint, icon: Icon }) => (
        <li key={key} className="flex items-center gap-4 py-4 first:pt-1 last:pb-1">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary" aria-hidden="true">
            <Icon className="size-5" />
          </span>
          <div className="flex-1">
            <p className="text-[15px] font-semibold text-ink">{t(label)}</p>
            <p className="text-sm text-muted">{t(hint)}</p>
          </div>
          <StepButton label={t("decrease", { label: t(label) })} disabled={!canStep(counts, key, -1)} onClick={() => onChange(stepGuests(counts, key, -1))}>
            <Minus className="size-4" aria-hidden="true" />
          </StepButton>
          <span className={cn("w-7 text-center text-base font-bold tabular-nums", counts[key] === 0 ? "text-muted" : "text-ink")} aria-live="polite">
            {counts[key]}
          </span>
          <StepButton label={t("increase", { label: t(label) })} disabled={!canStep(counts, key, 1)} onClick={() => onChange(stepGuests(counts, key, 1))}>
            <Plus className="size-4" aria-hidden="true" />
          </StepButton>
        </li>
      ))}
    </ul>
  );
}

function StepButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex size-9 items-center justify-center rounded-full border border-line text-ink transition-[background-color,border-color,color,transform] duration-200",
        "hover:border-primary hover:bg-primary/[0.06] hover:text-primary active:scale-90",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        "disabled:pointer-events-none disabled:opacity-30",
      )}
    >
      {children}
    </button>
  );
}
