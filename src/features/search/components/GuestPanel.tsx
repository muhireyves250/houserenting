"use client";

import { Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { canStep, stepGuests, type GuestCounts, type GuestKey } from "@/features/search/guests";

const ROWS: { key: GuestKey; label: "adults" | "children" | "pets"; hint: "adultsHint" | "childrenHint" | "petsHint" }[] = [
  { key: "adults", label: "adults", hint: "adultsHint" },
  { key: "children", label: "children", hint: "childrenHint" },
  { key: "pets", label: "pets", hint: "petsHint" },
];

export function GuestPanel({ counts, onChange }: { counts: GuestCounts; onChange: (counts: GuestCounts) => void }) {
  const t = useTranslations("Home");

  return (
    <ul className="flex flex-col divide-y divide-line">
      {ROWS.map(({ key, label, hint }) => (
        <li key={key} className="flex items-center gap-4 py-4">
          <div className="flex-1">
            <p className="text-base text-ink">{t(label)}</p>
            <p className="text-sm text-muted">{t(hint)}</p>
          </div>
          <StepButton label={t("decrease", { label: t(label) })} disabled={!canStep(counts, key, -1)} onClick={() => onChange(stepGuests(counts, key, -1))}>
            <Minus className="size-4" aria-hidden="true" />
          </StepButton>
          <span className="w-6 text-center tabular-nums" aria-live="polite">
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
      className="flex size-8 items-center justify-center rounded-full border border-line text-ink transition-colors hover:border-ink disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-line"
    >
      {children}
    </button>
  );
}
