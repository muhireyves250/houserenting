"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

/**
 * A button that asks "Sure?" before running a server action (delete, remove…). Shows the action's error, if any.
 * `action` is a server action already bound to its item.
 */
export function ConfirmAction({
  label,
  question,
  action,
  errors = {},
  danger = true,
  small = true,
  then,
}: {
  label: string;
  question: string;
  action: () => Promise<{ ok: boolean; error?: string }>;
  /** Wording for each error the action may return. */
  errors?: Record<string, string>;
  danger?: boolean;
  small?: boolean;
  /** Where to go once it's done (e.g. back to the list after deleting the item this page shows). */
  then?: string;
}) {
  const t = useTranslations("Admin");
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const size = small ? "px-3.5 py-1.5 text-[13px]" : "px-4 py-2.5 text-[14px]";
  if (!asking)
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        className={cn(
          "rounded-full border font-semibold transition-colors",
          size,
          danger
            ? "border-line text-danger hover:border-danger"
            : "border-line text-ink hover:border-primary",
        )}
      >
        {label}
      </button>
    );
  return (
    <span className="inline-flex flex-wrap items-center gap-2 rounded-xl bg-red-50 px-3 py-1.5 text-[13px] text-red-900">
      {question}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await action();
            if (result.ok) {
              setAsking(false);
              if (then) router.replace(then);
              else router.refresh();
            } else setError(errors[result.error ?? ""] ?? t("actionFailed"));
          })
        }
        className="rounded-full bg-danger px-3 py-1 font-semibold text-white disabled:opacity-50"
      >
        {t("yes")}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => (setAsking(false), setError(null))}
        className="rounded-full px-2 py-1 font-semibold text-ink hover:bg-white"
      >
        {t("no")}
      </button>
      {error && (
        <span className="basis-full font-medium text-danger">{error}</span>
      )}
    </span>
  );
}
